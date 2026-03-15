from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.models import Product, ResourcePool, ResourceStatus, User
from app.schemas.common import ApiResponse, ok
from app.schemas.product import ProductOut

router = APIRouter(prefix='/products', tags=['products'])


@router.get('', response_model=ApiResponse[list[ProductOut]])
def list_products(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ApiResponse[list[ProductOut]]:
    del current_user
    products = db.query(Product).filter(Product.enabled.is_(True)).order_by(Product.id.asc()).all()
    result: list[ProductOut] = []
    for product in products:
        stock_query = db.query(func.count(ResourcePool.id)).filter(
            ResourcePool.status == ResourceStatus.IDLE,
            ResourcePool.enabled.is_(True),
            ResourcePool.protocol == 'rdp',
            ResourcePool.current_user_id.is_(None),
        )
        if product.group_tag:
            stock_query = stock_query.filter(ResourcePool.group_tag == product.group_tag)
        stock = stock_query.scalar() or 0
        result.append(
            ProductOut(
                id=product.id,
                name=product.name,
                duration_minutes=product.duration_minutes,
                price=product.price,
                enabled=product.enabled,
                group_tag=product.group_tag,
                available_stock=stock,
            )
        )
    return ok(result)
