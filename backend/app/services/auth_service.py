from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from hashlib import sha256
from pathlib import Path
import secrets
import uuid
import json

import jwt
from fastapi import Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis_client import get_redis
from app.db.session import get_session
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import UserOut

settings = get_settings()
http_bearer = HTTPBearer(auto_error=False)


def hash_refresh_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


@lru_cache
def _load_private_key() -> str:
    path = Path(settings.JWT_PRIVATE_KEY_PATH)
    return path.read_text(encoding="utf-8") 


@lru_cache
def _load_public_key() -> str:
    path = Path(settings.JWT_PUBLIC_KEY_PATH)
    return path.read_text(encoding="utf-8")


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MIN)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALG)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, _load_public_key(), algorithms=[settings.JWT_ALG])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Access token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc


async def create_oauth_state(payload: dict) -> str:
    state_id = secrets.token_urlsafe(32)
    key = f"quizstudy:oauth_state:{state_id}"
    redis = await get_redis()
    await redis.set(key, json.dumps(payload, separators=(",", ":")), ex=600)
    return state_id


async def verify_oauth_state(state: str) -> dict:
    key = f"quizstudy:oauth_state:{state}"
    redis = await get_redis()
    raw = await redis.get(key)
    if raw is None:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    await redis.delete(key)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc
    exp = payload.get("exp")
    if exp and datetime.now(timezone.utc).timestamp() > float(exp):
        raise HTTPException(status_code=400, detail="OAuth state expired")
    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    session: AsyncSession = Depends(get_session),
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing access token")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid access token")

    try:
        user_uuid = uuid.UUID(str(user_id))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc

    repo = UserRepository(session)
    user = await repo.get_by_id(user_uuid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_admin_user(user=Depends(get_current_user)):
    if getattr(user, "is_admin", False) or getattr(user, "role", None) == "admin":
        return user
    email = (user.email or "").lower()
    if (
        settings.ENV.lower() in {"dev", "development", "local"}
        and settings.ADMIN_EMAILS
        and email in settings.ADMIN_EMAILS
    ):
        return user
    raise HTTPException(status_code=403, detail="Admin access required")


def build_user_out(user) -> UserOut:
    payload = UserOut.model_validate(user).model_dump()
    is_admin = bool(payload.get("is_admin") or payload.get("role") == "admin")
    email = (payload.get("email") or "").lower()
    if (
        not is_admin
        and settings.ENV.lower() in {"dev", "development", "local"}
        and settings.ADMIN_EMAILS
        and email in settings.ADMIN_EMAILS
    ):
        is_admin = True
    if is_admin:
        payload["is_admin"] = True
        payload["role"] = payload.get("role") or "admin"
    return UserOut(**payload)
    return user


def set_refresh_cookie(response: Response, token: str) -> None:
    max_age = int(timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS).total_seconds())
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite="lax",
        max_age=max_age,
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path="/")


async def issue_refresh_token(session: AsyncSession, user_id) -> str:
    token = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS)
    repo = RefreshTokenRepository(session)
    await repo.create(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    redis = await get_redis()
    ttl = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    await redis.set(
        f"quizstudy:refresh:{token_hash}",
        str(user_id),
        ex=max(ttl, 1),
    )
    return token


async def rotate_refresh_token(session: AsyncSession, token: str):
    token_hash = hash_refresh_token(token)
    redis = await get_redis()
    repo = RefreshTokenRepository(session)
    stored = await repo.get_by_hash(token_hash)
    if not stored or stored.revoked:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    cached_user_id = await redis.get(f"quizstudy:refresh:{token_hash}")
    if cached_user_id is None:
        ttl = int((stored.expires_at - datetime.now(timezone.utc)).total_seconds())
        await redis.set(
            f"quizstudy:refresh:{token_hash}",
            str(stored.user_id),
            ex=max(ttl, 1),
        )

    await repo.revoke(stored.id)
    await redis.delete(f"quizstudy:refresh:{token_hash}")
    new_token = await issue_refresh_token(session, stored.user_id)
    return new_token, stored.user_id
