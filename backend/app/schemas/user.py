from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class UserAdminOut(BaseModel):
    id: int
    username: str
    role: str
    status: str
    created_at: datetime
    balance: Decimal


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default='user', pattern='^(admin|user)$')
    status: str = Field(default='active', pattern='^(active|disabled)$')
    initial_balance: Decimal = Field(default=Decimal('0'), ge=0)


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(pattern='^(active|disabled)$')
