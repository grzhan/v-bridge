from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.models import User, UserRole, UserStatus, WalletAccount
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenPayload, UserBrief
from app.schemas.common import ApiResponse, ok

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/register', response_model=ApiResponse[UserBrief])
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> ApiResponse[UserBrief]:
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=400, detail='用户名已存在')

    user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.flush()

    wallet = WalletAccount(user_id=user.id, balance=0)
    db.add(wallet)
    db.commit()
    db.refresh(user)
    return ok(UserBrief.model_validate(user))


@router.post('/login', response_model=ApiResponse[TokenPayload])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> ApiResponse[TokenPayload]:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='用户名或密码错误')
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail='账号已被禁用')

    token = create_access_token(user.username, extra={'role': user.role.value})
    return ok(TokenPayload(access_token=token, role=user.role.value))


@router.post('/logout', response_model=ApiResponse[dict])
def logout() -> ApiResponse[dict]:
    return ok({'logged_out': True})


@router.get('/me', response_model=ApiResponse[UserBrief])
def me(current_user: User = Depends(get_current_user)) -> ApiResponse[UserBrief]:
    return ok(UserBrief.model_validate(current_user))


@router.post('/change-password', response_model=ApiResponse[dict])
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[dict]:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail='当前密码不正确')
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail='新密码不能与当前密码相同')

    current_user.password_hash = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()
    return ok({'changed': True})
