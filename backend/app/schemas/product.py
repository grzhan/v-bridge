from decimal import Decimal

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str
    duration_minutes: int = Field(gt=0)
    price: Decimal = Field(gt=0)
    enabled: bool = True
    group_tag: str | None = None


class ProductOut(BaseModel):
    id: int
    name: str
    duration_minutes: int
    price: Decimal
    enabled: bool
    group_tag: str | None = None
    available_stock: int = 0

    model_config = {'from_attributes': True}
