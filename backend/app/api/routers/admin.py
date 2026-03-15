from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.security import get_password_hash
from app.models.models import (
    Order,
    OrderStatus,
    Product,
    ResourcePool,
    ResourceStatus,
    User,
    UserRole,
    UserStatus,
    WalletAccount,
    WalletTransaction,
    WalletTransactionType,
)
from app.schemas.common import ApiResponse, ok
from app.schemas.order import OrderOut
from app.schemas.product import ProductCreate, ProductOut
from app.schemas.resource import (
    BatchImportResult,
    BatchResourceImportRequest,
    ResourceCreate,
    ResourceOut,
    ResourceUpdate,
)
from app.schemas.user import UserAdminOut, UserCreateRequest, UserStatusUpdateRequest
from app.schemas.wallet import TopupRequest
from app.services.order_service import cleanup_order_gateway_access
from app.services.resource_service import health_check_resource

router = APIRouter(prefix='/admin', tags=['admin'])


def _resource_to_schema(resource: ResourcePool) -> ResourceOut:
    return ResourceOut(
        id=resource.id,
        name=resource.name,
        host=resource.host,
        port=resource.port,
        protocol=resource.protocol,
        status=resource.status.value,
        enabled=resource.enabled,
        current_user_id=resource.current_user_id,
        lease_expire_at=resource.lease_expire_at,
        group_tag=resource.group_tag,
        health_status=resource.health_status,
    )


def _user_to_schema(user: User, balance: Decimal | int | float | None) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        username=user.username,
        role=user.role.value,
        status=user.status.value,
        created_at=user.created_at,
        balance=Decimal(str(balance if balance is not None else 0)),
    )


@router.get('/products', response_model=ApiResponse[list[ProductOut]])
def list_products_admin(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> ApiResponse[list[ProductOut]]:
    del admin
    rows = db.query(Product).order_by(Product.id.asc()).all()
    data = [
        ProductOut(
            id=p.id,
            name=p.name,
            duration_minutes=p.duration_minutes,
            price=p.price,
            enabled=p.enabled,
            group_tag=p.group_tag,
            available_stock=0,
        )
        for p in rows
    ]
    return ok(data)


@router.post('/products', response_model=ApiResponse[ProductOut])
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[ProductOut]:
    del admin
    exists = db.query(Product).filter(Product.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=400, detail='套餐名称已存在')

    product = Product(
        name=payload.name,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        enabled=payload.enabled,
        group_tag=payload.group_tag,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return ok(
        ProductOut(
            id=product.id,
            name=product.name,
            duration_minutes=product.duration_minutes,
            price=product.price,
            enabled=product.enabled,
            group_tag=product.group_tag,
            available_stock=0,
        )
    )


@router.delete('/products/{product_id}', response_model=ApiResponse[dict])
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[dict]:
    del admin
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail='套餐不存在')

    active_order = db.query(Order.id).filter(Order.product_id == product_id, Order.status == OrderStatus.ACTIVE).first()
    if active_order is not None:
        raise HTTPException(status_code=400, detail='套餐存在生效中的订单，无法删除')

    history_order = db.query(Order.id).filter(Order.product_id == product_id).first()
    if history_order is not None:
        raise HTTPException(status_code=400, detail='套餐已有订单历史，不允许删除')

    db.delete(product)
    db.commit()
    return ok({'product_id': product_id, 'deleted': True})


@router.post('/resources', response_model=ApiResponse[ResourceOut])
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[ResourceOut]:
    del admin
    exists = db.query(ResourcePool).filter((ResourcePool.name == payload.name) | (ResourcePool.host == payload.host)).first()
    if exists:
        raise HTTPException(status_code=400, detail='资源名称或主机地址已存在')

    resource = ResourcePool(
        name=payload.name,
        host=payload.host,
        port=payload.port,
        protocol=payload.protocol,
        auth_user=payload.auth_user,
        auth_pass=payload.auth_pass,
        status=ResourceStatus.IDLE,
        enabled=True,
        group_tag=payload.group_tag,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return ok(_resource_to_schema(resource))


@router.get('/resources', response_model=ApiResponse[list[ResourceOut]])
def list_resources(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> ApiResponse[list[ResourceOut]]:
    del admin
    rows = db.query(ResourcePool).order_by(ResourcePool.id.asc()).all()
    return ok([_resource_to_schema(row) for row in rows])


@router.patch('/resources/{resource_id}', response_model=ApiResponse[ResourceOut])
def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[ResourceOut]:
    del admin
    resource = db.query(ResourcePool).filter(ResourcePool.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail='资源不存在')

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if key == 'status' and value:
            setattr(resource, key, ResourceStatus(value))
        else:
            setattr(resource, key, value)

    db.add(resource)
    db.commit()
    db.refresh(resource)
    return ok(_resource_to_schema(resource))


@router.delete('/resources/{resource_id}', response_model=ApiResponse[dict])
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[dict]:
    del admin
    resource = db.query(ResourcePool).filter(ResourcePool.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail='资源不存在')

    if resource.status == ResourceStatus.BUSY or resource.current_user_id is not None:
        raise HTTPException(status_code=400, detail='资源正在使用中，无法删除')

    active_order = db.query(Order.id).filter(Order.resource_id == resource_id, Order.status == OrderStatus.ACTIVE).first()
    if active_order is not None:
        raise HTTPException(status_code=400, detail='资源存在生效中的订单，无法删除')

    history_order = db.query(Order.id).filter(Order.resource_id == resource_id).first()
    if history_order is not None:
        raise HTTPException(status_code=400, detail='资源已有订单历史，不允许删除，请改为停用')

    db.delete(resource)
    db.commit()
    return ok({'resource_id': resource_id, 'deleted': True})


@router.post('/resources/batch-import', response_model=ApiResponse[BatchImportResult])
def batch_import_resources(
    payload: BatchResourceImportRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[BatchImportResult]:
    del admin
    created = 0
    failed = 0
    errors: list[str] = []

    for idx, item in enumerate(payload.items, start=1):
        exists = db.query(ResourcePool).filter((ResourcePool.name == item.name) | (ResourcePool.host == item.host)).first()
        if exists:
            failed += 1
            errors.append(f'第 {idx} 行：名称或主机地址重复')
            continue

        resource = ResourcePool(
            name=item.name,
            host=item.host,
            port=item.port,
            protocol=item.protocol,
            auth_user=item.auth_user,
            auth_pass=item.auth_pass,
            status=ResourceStatus.IDLE,
            enabled=True,
            group_tag=item.group_tag,
        )
        db.add(resource)
        created += 1

    db.commit()
    return ok(BatchImportResult(created=created, failed=failed, errors=errors))


@router.post('/resources/{resource_id}/health-check', response_model=ApiResponse[dict])
async def resource_health_check(
    resource_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[dict]:
    del admin
    resource = db.query(ResourcePool).filter(ResourcePool.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail='资源不存在')

    status = await health_check_resource(db=db, resource=resource)
    return ok({'resource_id': resource_id, 'health_status': status})


@router.get('/orders', response_model=ApiResponse[list[OrderOut]])
def list_orders(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> ApiResponse[list[OrderOut]]:
    del admin
    rows = (
        db.query(Order, ResourcePool.name)
        .join(ResourcePool, ResourcePool.id == Order.resource_id)
        .order_by(Order.id.desc())
        .limit(500)
        .all()
    )

    data = [
        OrderOut(
            id=order.id,
            order_no=order.order_no,
            user_id=order.user_id,
            product_id=order.product_id,
            resource_id=order.resource_id,
            amount=order.amount,
            status=order.status.value,
            start_at=order.start_at,
            expire_at=order.expire_at,
            created_at=order.created_at,
            resource_name=resource_name,
        )
        for order, resource_name in rows
    ]
    return ok(data)


@router.post('/orders/{order_id}/force-expire', response_model=ApiResponse[dict])
async def force_expire_order(
    order_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[dict]:
    del admin
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail='订单不存在')

    resource = db.query(ResourcePool).filter(ResourcePool.id == order.resource_id).first()
    await cleanup_order_gateway_access(db=db, order=order, resource=resource)

    order.status = OrderStatus.EXPIRED
    order.expire_at = datetime.now(timezone.utc)

    if resource:
        resource.status = ResourceStatus.IDLE
        resource.current_user_id = None
        resource.lease_expire_at = None

    db.commit()
    return ok({'order_id': order_id, 'status': 'EXPIRED'})


@router.post('/wallet/topup', response_model=ApiResponse[dict])
def topup_wallet(
    payload: TopupRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[dict]:
    user = db.query(User).filter(User.id == payload.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail='用户不存在')

    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == payload.user_id).with_for_update().first()
    if wallet is None:
        wallet = WalletAccount(user_id=payload.user_id, balance=0)
        db.add(wallet)
        db.flush()

    wallet.balance = Decimal(str(wallet.balance)) + payload.amount
    tx = WalletTransaction(
        user_id=payload.user_id,
        type=WalletTransactionType.MANUAL_TOPUP,
        amount=payload.amount,
        balance_after=wallet.balance,
        remark=payload.remark,
        created_by=admin.username,
    )

    db.add(tx)
    db.commit()
    return ok({'user_id': payload.user_id, 'balance': str(wallet.balance)})


@router.get('/users', response_model=ApiResponse[list[UserAdminOut]])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> ApiResponse[list[UserAdminOut]]:
    del admin
    rows = (
        db.query(User, WalletAccount.balance)
        .outerjoin(WalletAccount, WalletAccount.user_id == User.id)
        .order_by(User.id.asc())
        .all()
    )

    data = [_user_to_schema(user, balance) for user, balance in rows]
    return ok(data)


@router.post('/users', response_model=ApiResponse[UserAdminOut])
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[UserAdminOut]:
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=400, detail='用户名已存在')

    user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        role=UserRole(payload.role),
        status=UserStatus(payload.status),
    )
    db.add(user)
    db.flush()

    wallet = WalletAccount(user_id=user.id, balance=payload.initial_balance)
    db.add(wallet)

    if payload.initial_balance > 0:
        tx = WalletTransaction(
            user_id=user.id,
            type=WalletTransactionType.MANUAL_TOPUP,
            amount=payload.initial_balance,
            balance_after=payload.initial_balance,
            remark='管理员创建用户初始余额',
            created_by=admin.username,
        )
        db.add(tx)

    db.commit()
    db.refresh(user)
    return ok(_user_to_schema(user, wallet.balance))


@router.patch('/users/{user_id}/status', response_model=ApiResponse[UserAdminOut])
def update_user_status(
    user_id: int,
    payload: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[UserAdminOut]:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail='用户不存在')
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail='不能修改当前登录账号的状态')

    user.status = UserStatus(payload.status)
    db.add(user)
    db.commit()
    db.refresh(user)

    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    return ok(_user_to_schema(user, wallet.balance if wallet else 0))


@router.delete('/users/{user_id}', response_model=ApiResponse[dict])
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ApiResponse[dict]:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail='用户不存在')
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail='不能删除当前登录账号')

    active_order = db.query(Order.id).filter(Order.user_id == user_id, Order.status == OrderStatus.ACTIVE).first()
    if active_order is not None:
        raise HTTPException(status_code=400, detail='该用户存在生效中的订单，请先处理订单')

    resources = db.query(ResourcePool).filter(ResourcePool.current_user_id == user_id).all()
    for resource in resources:
        resource.current_user_id = None
        resource.lease_expire_at = None
        if resource.status == ResourceStatus.BUSY:
            resource.status = ResourceStatus.IDLE
        db.add(resource)

    db.delete(user)
    db.commit()
    return ok({'user_id': user_id, 'deleted': True})
