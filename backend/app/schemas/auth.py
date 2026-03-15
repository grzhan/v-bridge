from datetime import datetime

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class TokenPayload(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    role: str


class UserBrief(BaseModel):
    id: int
    username: str
    role: str
    status: str
    created_at: datetime

    model_config = {'from_attributes': True}
