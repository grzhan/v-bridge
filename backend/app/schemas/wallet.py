from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class WalletOut(BaseModel):
    balance: Decimal


class WalletTransactionOut(BaseModel):
    id: int
    user_id: int
    type: str
    amount: Decimal
    balance_after: Decimal
    remark: str | None
    created_by: str | None
    created_at: datetime

    model_config = {'from_attributes': True}


class TopupRequest(BaseModel):
    user_id: int
    amount: Decimal = Field(gt=0)
    remark: str | None = None
