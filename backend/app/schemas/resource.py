from datetime import datetime

from pydantic import BaseModel, Field


class ResourceCreate(BaseModel):
    name: str
    host: str
    port: int = 3389
    protocol: str = 'rdp'
    auth_user: str
    auth_pass: str
    group_tag: str | None = None


class ResourceUpdate(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    protocol: str | None = None
    auth_user: str | None = None
    auth_pass: str | None = None
    enabled: bool | None = None
    status: str | None = Field(default=None, pattern='^(IDLE|BUSY|DISABLED)$')
    group_tag: str | None = None


class BatchResourceItem(BaseModel):
    name: str
    host: str
    port: int = 3389
    protocol: str = 'rdp'
    auth_user: str
    auth_pass: str
    group_tag: str | None = None


class BatchResourceImportRequest(BaseModel):
    items: list[BatchResourceItem]


class ResourceOut(BaseModel):
    id: int
    name: str
    host: str
    port: int
    protocol: str
    status: str
    enabled: bool
    current_user_id: int | None = None
    lease_expire_at: datetime | None = None
    group_tag: str | None = None
    health_status: str

    model_config = {'from_attributes': True}


class BatchImportResult(BaseModel):
    created: int
    failed: int
    errors: list[str]
