from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.models import (
    GuacIdentityMap,
    GuacOrderIdentityMap,
    Order,
    OrderStatus,
    Product,
    ResourcePool,
    ResourceStatus,
    User,
    WalletAccount,
    WalletTransaction,
    WalletTransactionType,
)
from app.services.guac_client import GuacAuth, GuacClient

_GUAC_AUTH_CACHE: dict[int, GuacAuth] = {}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _normalize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _calculate_refund(order: Order, now: datetime) -> tuple[Decimal, Decimal]:
    start_at = _as_aware_utc(order.start_at)
    expire_at = _as_aware_utc(order.expire_at)
    total_seconds = Decimal(str((expire_at - start_at).total_seconds()))
    remaining_seconds = Decimal(str((expire_at - now).total_seconds()))

    if total_seconds <= 0 or remaining_seconds <= 0:
        return Decimal('0.00'), Decimal('0.00')

    ratio = remaining_seconds / total_seconds
    ratio = max(Decimal('0'), min(Decimal('1'), ratio))
    amount = Decimal(str(order.amount))

    refund_ratio = _normalize_money(ratio * Decimal('100'))
    refund_amount = _normalize_money(amount * ratio)
    return refund_ratio, refund_amount


def _ensure_user_identity_local(db: Session, user: User) -> GuacIdentityMap:
    identity = (
        db.query(GuacIdentityMap)
        .filter(GuacIdentityMap.user_id == user.id)
        .with_for_update()
        .first()
    )
    if identity is not None:
        return identity

    identity = GuacIdentityMap(user_id=user.id, guac_username=f'rg_{user.id}_{user.username}')
    db.add(identity)
    db.flush()
    return identity


async def _ensure_user_identity_remote(guac_client: GuacClient, user: User, identity: GuacIdentityMap) -> None:
    guac_username, guac_user_id = await guac_client.ensure_user(user.id, user.username)
    identity.guac_username = guac_username
    identity.guac_user_id = guac_user_id


async def _ensure_resource_connection(guac_client: GuacClient, resource: ResourcePool) -> None:
    if resource.guac_connection_id:
        return

    resource.guac_connection_id = await guac_client.ensure_connection(
        resource_id=resource.id,
        name=resource.name,
        protocol=resource.protocol,
        host=resource.host,
        port=resource.port,
        auth_user=resource.auth_user,
        auth_pass=resource.auth_pass,
    )


async def _get_or_refresh_user_auth(guac_client: GuacClient, user: User, identity: GuacIdentityMap) -> GuacAuth:
    cached_auth = _GUAC_AUTH_CACHE.get(user.id)
    if cached_auth is not None:
        try:
            if await guac_client.validate_token(cached_auth):
                return cached_auth
        except Exception:
            pass

    fresh_auth = await guac_client.authenticate_as_managed_user(
        user_id=user.id,
        username=user.username,
        guac_username=identity.guac_username,
    )
    _GUAC_AUTH_CACHE[user.id] = fresh_auth
    return fresh_auth


async def cleanup_order_gateway_access(db: Session, order: Order, resource: ResourcePool | None = None) -> None:
    guac_client = GuacClient()
    shared_identity = db.query(GuacIdentityMap).filter(GuacIdentityMap.user_id == order.user_id).first()
    legacy_order_identity = db.query(GuacOrderIdentityMap).filter(GuacOrderIdentityMap.order_id == order.id).first()

    if resource and resource.guac_connection_id:
        if shared_identity is not None:
            try:
                await guac_client.revoke_user_connection(
                    guac_username=shared_identity.guac_username,
                    guac_connection_id=resource.guac_connection_id,
                )
            except Exception:
                pass

        # Compatibility path: clean legacy order-scoped identity permission.
        if legacy_order_identity and legacy_order_identity.guac_username != (shared_identity.guac_username if shared_identity else ''):
            try:
                await guac_client.revoke_user_connection(
                    guac_username=legacy_order_identity.guac_username,
                    guac_connection_id=resource.guac_connection_id,
                )
            except Exception:
                pass

    if legacy_order_identity is not None:
        try:
            await guac_client.delete_user(legacy_order_identity.guac_username)
        except Exception:
            # Deletion failures should not block state transition.
            pass
        db.delete(legacy_order_identity)


async def create_order_for_user(db: Session, user: User, product_id: int) -> Order:
    product = db.query(Product).filter(Product.id == product_id, Product.enabled.is_(True)).first()
    if not product:
        raise HTTPException(status_code=404, detail='套餐不存在')

    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).with_for_update().first()
    if wallet is None:
        wallet = WalletAccount(user_id=user.id, balance=0)
        db.add(wallet)
        db.flush()

    price = Decimal(str(product.price))
    balance = Decimal(str(wallet.balance))
    if balance < price:
        raise HTTPException(status_code=400, detail='余额不足')

    resource_query = (
        db.query(ResourcePool)
        .filter(
            ResourcePool.status == ResourceStatus.IDLE,
            ResourcePool.enabled.is_(True),
            ResourcePool.protocol == 'rdp',
            ResourcePool.current_user_id.is_(None),
        )
        .order_by(ResourcePool.id.asc())
        .with_for_update(skip_locked=True)
    )

    if product.group_tag:
        resource_query = resource_query.filter(ResourcePool.group_tag == product.group_tag)

    resource = resource_query.first()
    if not resource:
        raise HTTPException(status_code=400, detail='当前无可用空闲资源')

    start_at = utcnow()
    expire_at = start_at + timedelta(minutes=product.duration_minutes)

    wallet.balance = balance - price
    tx = WalletTransaction(
        user_id=user.id,
        type=WalletTransactionType.PURCHASE,
        amount=-price,
        balance_after=wallet.balance,
        remark=f'Purchase {product.name}',
        created_by='system',
    )

    order = Order(
        order_no=f'RG{start_at.strftime("%Y%m%d%H%M%S")}{uuid4().hex[:6].upper()}',
        user_id=user.id,
        product_id=product.id,
        resource_id=resource.id,
        amount=price,
        status=OrderStatus.ACTIVE,
        start_at=start_at,
        expire_at=expire_at,
    )

    resource.status = ResourceStatus.BUSY
    resource.current_user_id = user.id
    resource.lease_expire_at = expire_at

    db.add(tx)
    db.add(order)
    db.flush()

    guac_client = GuacClient()
    try:
        identity = _ensure_user_identity_local(db=db, user=user)
        await _ensure_user_identity_remote(guac_client=guac_client, user=user, identity=identity)
        await _ensure_resource_connection(guac_client=guac_client, resource=resource)
        if not resource.guac_connection_id:
            raise RuntimeError('Guacamole 连接创建失败')
        await guac_client.grant_user_connection(
            guac_username=identity.guac_username,
            guac_connection_id=resource.guac_connection_id,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail='远程网关不可用，请联系管理员检查网关配置') from exc

    db.commit()
    db.refresh(order)
    return order


async def enter_order(db: Session, user: User, order_id: int) -> str:
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.user_id == user.id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail='订单不存在')

    expire_at = _as_aware_utc(order.expire_at)
    if order.status != OrderStatus.ACTIVE or expire_at <= utcnow():
        raise HTTPException(status_code=400, detail='订单已失效或未激活')

    guac_client = GuacClient()
    if not guac_client.enabled:
        return guac_client.build_launch_url()

    resource = db.query(ResourcePool).filter(ResourcePool.id == order.resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail='资源不存在')

    identity = _ensure_user_identity_local(db=db, user=user)
    await _ensure_user_identity_remote(guac_client=guac_client, user=user, identity=identity)
    await _ensure_resource_connection(guac_client=guac_client, resource=resource)
    if not resource.guac_connection_id:
        raise HTTPException(status_code=502, detail='远程网关连接创建失败')

    await guac_client.grant_user_connection(
        guac_username=identity.guac_username,
        guac_connection_id=resource.guac_connection_id,
    )

    try:
        user_auth = await _get_or_refresh_user_auth(guac_client=guac_client, user=user, identity=identity)
    except Exception as exc:
        raise HTTPException(status_code=502, detail='远程网关鉴权失败，请稍后重试') from exc

    db.commit()
    return guac_client.build_client_launch_url(auth=user_auth, guac_connection_id=resource.guac_connection_id)


async def release_order(db: Session, user: User, order_id: int) -> dict[str, Decimal | str | int | datetime]:
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.user_id == user.id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail='订单不存在')
    if order.status != OrderStatus.ACTIVE:
        raise HTTPException(status_code=400, detail='仅进行中的订单可主动释放')

    now = utcnow()
    expire_at = _as_aware_utc(order.expire_at)
    expired = expire_at <= now

    refund_ratio = Decimal('0.00')
    refund_amount = Decimal('0.00')

    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).with_for_update().first()
    if wallet is None:
        wallet = WalletAccount(user_id=user.id, balance=0)
        db.add(wallet)
        db.flush()

    if not expired:
        refund_ratio, refund_amount = _calculate_refund(order, now)
        if refund_amount > 0:
            balance_after = Decimal(str(wallet.balance)) + refund_amount
            wallet.balance = balance_after
            db.add(
                WalletTransaction(
                    user_id=user.id,
                    type=WalletTransactionType.REFUND,
                    amount=refund_amount,
                    balance_after=balance_after,
                    remark=f'主动释放订单 {order.order_no}，退款比例 {refund_ratio}%',
                    created_by='system',
                )
            )

    resource = db.query(ResourcePool).filter(ResourcePool.id == order.resource_id).with_for_update().first()
    await cleanup_order_gateway_access(db=db, order=order, resource=resource)

    if resource:
        resource.status = ResourceStatus.IDLE
        resource.current_user_id = None
        resource.lease_expire_at = None

    order.status = OrderStatus.EXPIRED if expired else OrderStatus.CANCELLED
    order.expire_at = now

    db.commit()
    return {
        'order_id': order.id,
        'status': order.status.value,
        'refund_ratio': refund_ratio,
        'refund_amount': refund_amount,
        'balance': Decimal(str(wallet.balance)),
        'released_at': now,
    }


async def expire_overdue_orders(db: Session) -> int:
    now = utcnow()
    orders = db.query(Order).filter(and_(Order.status == OrderStatus.ACTIVE, Order.expire_at <= now)).all()
    if not orders:
        return 0

    expired_count = 0

    for order in orders:
        resource = db.query(ResourcePool).filter(ResourcePool.id == order.resource_id).first()
        await cleanup_order_gateway_access(db=db, order=order, resource=resource)

        order.status = OrderStatus.EXPIRED
        if resource:
            resource.status = ResourceStatus.IDLE
            resource.current_user_id = None
            resource.lease_expire_at = None

        expired_count += 1

    db.commit()
    return expired_count
