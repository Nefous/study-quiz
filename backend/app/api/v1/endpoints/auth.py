from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.repositories.user_repo import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.auth_service import (
    clear_refresh_cookie,
    create_access_token,
    get_current_user,
    hash_refresh_token,
    issue_refresh_token,
    rotate_refresh_token,
    set_refresh_cookie,
)
from app.core.config import get_settings
from passlib.context import CryptContext

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    password_bytes = body.password.encode("utf-8")
    if len(password_bytes) < 8:
        raise HTTPException(status_code=422, detail="Password too short (min 8 characters)")
    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=422,
            detail="Password too long (max 72 bytes for bcrypt)",
        )

    repo = UserRepository(session)
    existing = await repo.get_by_email(body.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="EMAIL_TAKEN")

    user = await repo.create(email=body.email.lower(), password_hash=_hash_password(body.password))
    refresh_token = await issue_refresh_token(session, user.id)
    set_refresh_cookie(response, refresh_token)
    access_token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    repo = UserRepository(session)
    user = await repo.get_by_email(body.email.lower())
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")

    refresh_token = await issue_refresh_token(session, user.id)
    set_refresh_cookie(response, refresh_token)
    access_token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    new_token, user_id = await rotate_refresh_token(session, refresh_token)
    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    set_refresh_cookie(response, new_token)
    access_token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if refresh_token:
        from app.repositories.refresh_token_repo import RefreshTokenRepository
        repo = RefreshTokenRepository(session)
        stored = await repo.get_by_hash(hash_refresh_token(refresh_token))
        if stored:
            await repo.revoke(stored.id)

    clear_refresh_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user=Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
