from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.models import Order, ResourcePool, User, WalletAccount, WalletTransaction
from app.schemas.common import ApiResponse, ok
from app.schemas.order import EnterOrderResponse, OrderCreateRequest, OrderOut, ReleaseOrderResponse
from app.schemas.wallet import WalletOut, WalletTransactionOut
from app.services.order_service import create_order_for_user, enter_order, release_order

router = APIRouter(prefix='/me', tags=['me'])


@router.get('/wallet', response_model=ApiResponse[WalletOut])
def get_my_wallet(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ApiResponse[WalletOut]:
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == current_user.id).first()
    if wallet is None:
        wallet = WalletAccount(user_id=current_user.id, balance=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return ok(WalletOut(balance=wallet.balance))


@router.get('/wallet/transactions', response_model=ApiResponse[list[WalletTransactionOut]])
def get_my_wallet_transactions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ApiResponse[list[WalletTransactionOut]]:
    records = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == current_user.id)
        .order_by(WalletTransaction.id.desc())
        .limit(100)
        .all()
    )
    return ok([WalletTransactionOut.model_validate(x) for x in records])


@router.post('/orders', response_model=ApiResponse[OrderOut])
async def create_my_order(
    payload: OrderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[OrderOut]:
    order = await create_order_for_user(db=db, user=current_user, product_id=payload.product_id)
    resource = db.query(ResourcePool).filter(ResourcePool.id == order.resource_id).first()
    return ok(
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
            resource_name=resource.name if resource else None,
        )
    )


@router.get('/orders', response_model=ApiResponse[list[OrderOut]])
def list_my_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ApiResponse[list[OrderOut]]:
    rows = (
        db.query(Order, ResourcePool.name)
        .join(ResourcePool, ResourcePool.id == Order.resource_id)
        .filter(Order.user_id == current_user.id)
        .order_by(Order.id.desc())
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


@router.post('/orders/{order_id}/enter', response_model=ApiResponse[EnterOrderResponse])
async def enter_my_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[EnterOrderResponse]:
    launch_url = await enter_order(db=db, user=current_user, order_id=order_id)
    return ok(EnterOrderResponse(order_id=order_id, guac_entry_url=launch_url))


@router.post('/orders/{order_id}/release', response_model=ApiResponse[ReleaseOrderResponse])
async def release_my_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[ReleaseOrderResponse]:
    result = await release_order(db=db, user=current_user, order_id=order_id)
    return ok(ReleaseOrderResponse(**result), message='释放成功')
