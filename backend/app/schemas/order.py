from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class OrderCreateRequest(BaseModel):
    product_id: int


class OrderOut(BaseModel):
    id: int
    order_no: str
    user_id: int
    product_id: int
    resource_id: int
    amount: Decimal
    status: str
    start_at: datetime
    expire_at: datetime
    created_at: datetime
    resource_name: str | None = None


class EnterOrderResponse(BaseModel):
    order_id: int
    guac_entry_url: str


class ReleaseOrderResponse(BaseModel):
    order_id: int
    status: str
    refund_ratio: Decimal
    refund_amount: Decimal
    balance: Decimal
    released_at: datetime
