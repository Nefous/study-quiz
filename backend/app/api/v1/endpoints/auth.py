from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.repositories.oauth_account_repo import OAuthAccountRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.core.redis_client import get_redis
from app.services.auth_service import (
    build_user_out,
    clear_refresh_cookie,
    create_access_token,
    create_oauth_state,
    get_current_user,
    hash_refresh_token,
    issue_refresh_token,
    rotate_refresh_token,
    set_refresh_cookie,
    verify_oauth_state,
)
from app.core.config import get_settings
from passlib.context import CryptContext

from app.utils.rate_limit import build_rate_limiter

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
auth_rate_limiter = build_rate_limiter(
    user_times=5, user_seconds=300,
    anon_times=10, anon_seconds=600,
)


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _oauth_configured(provider: str) -> None:
    if provider == "google":
        if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI):
            raise HTTPException(status_code=500, detail="GOOGLE_OAUTH_NOT_CONFIGURED")
    if provider == "github":
        if not (settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET and settings.GITHUB_REDIRECT_URI):
            raise HTTPException(status_code=500, detail="GITHUB_OAUTH_NOT_CONFIGURED")


def _frontend_callback_url(success: bool, return_url: str | None = None, error: str | None = None) -> str:
    base = settings.FRONTEND_URL.rstrip("/") + "/auth/callback"
    params = {"success": "1" if success else "0"}
    if return_url:
        params["returnUrl"] = return_url
    if error:
        params["error"] = error
    return f"{base}?{urlencode(params)}"


async def _get_or_create_oauth_user(
    session: AsyncSession,
    provider: str,
    provider_user_id: str,
    email: str | None,
):
    oauth_repo = OAuthAccountRepository(session)
    user_repo = UserRepository(session)

    oauth = await oauth_repo.get_by_provider_user_id(provider, provider_user_id)
    if oauth:
        user = await user_repo.get_by_id(oauth.user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        await oauth_repo.upsert(user.id, provider, provider_user_id, email)
        return user

    if not email:
        raise HTTPException(status_code=400, detail="OAUTH_EMAIL_REQUIRED")

    email_lower = email.lower()
    user = await user_repo.get_by_email(email_lower)
    if not user:
        user = await user_repo.create(email=email_lower, password_hash=None)
    await oauth_repo.upsert(user.id, provider, provider_user_id, email_lower)
    return user


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    response: Response,
    _rate_limiter=Depends(auth_rate_limiter),
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
    return TokenResponse(access_token=access_token, user=build_user_out(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    _rate_limiter=Depends(auth_rate_limiter),
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    repo = UserRepository(session)
    user = await repo.get_by_email(body.email.lower())
    if not user or not user.password_hash or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")

    refresh_token = await issue_refresh_token(session, user.id)
    set_refresh_cookie(response, refresh_token)
    access_token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=access_token, user=build_user_out(user))


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
    return TokenResponse(access_token=access_token, user=build_user_out(user))


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
        redis = await get_redis()
        await redis.delete(f"quizstudy:refresh:{hash_refresh_token(refresh_token)}")

    clear_refresh_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user=Depends(get_current_user)) -> UserOut:
    return build_user_out(user)


@router.get("/google/login")
async def google_login(return_url: str | None = Query(default=None)):
    _oauth_configured("google")
    state = await create_oauth_state(
        {
            "provider": "google",
            "returnUrl": return_url or "/",
            "exp": (datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp(),
        }
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    if not code or not state:
        return RedirectResponse(url=_frontend_callback_url(False, error="missing_code"))
    _oauth_configured("google")
    try:
        payload = await verify_oauth_state(state)
    except HTTPException:
        return RedirectResponse(url=_frontend_callback_url(False, error="invalid_state"))
    if payload.get("provider") != "google":
        return RedirectResponse(url=_frontend_callback_url(False, error="invalid_state"))

    async with httpx.AsyncClient(timeout=10) as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_response.status_code >= 400:
            return RedirectResponse(url=_frontend_callback_url(False, error="token_exchange_failed"))
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url=_frontend_callback_url(False, error="missing_access_token"))

        userinfo_response = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_response.status_code >= 400:
            return RedirectResponse(url=_frontend_callback_url(False, error="user_info_failed"))
        userinfo = userinfo_response.json()

    provider_user_id = str(userinfo.get("sub") or "")
    email = userinfo.get("email")
    email_verified = userinfo.get("email_verified")
    if email and email_verified is False:
        email = None
    if not provider_user_id:
        return RedirectResponse(url=_frontend_callback_url(False, error="missing_provider_id"))

    try:
        user = await _get_or_create_oauth_user(session, "google", provider_user_id, email)
    except HTTPException as exc:
        return RedirectResponse(url=_frontend_callback_url(False, error=quote(str(exc.detail))))

    refresh_token = await issue_refresh_token(session, user.id)
    response = RedirectResponse(
        url=_frontend_callback_url(True, return_url=payload.get("returnUrl") or "/"),
    )
    set_refresh_cookie(response, refresh_token)
    return response


@router.get("/github/login")
async def github_login(return_url: str | None = Query(default=None)):
    _oauth_configured("github")
    state = await create_oauth_state(
        {
            "provider": "github",
            "returnUrl": return_url or "/",
            "exp": (datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp(),
        }
    )
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
    }
    url = "https://github.com/login/oauth/authorize?" + urlencode(params)
    return RedirectResponse(url=url)


@router.get("/github/callback")
async def github_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    if not code or not state:
        return RedirectResponse(url=_frontend_callback_url(False, error="missing_code"))
    _oauth_configured("github")
    try:
        payload = await verify_oauth_state(state)
    except HTTPException:
        return RedirectResponse(url=_frontend_callback_url(False, error="invalid_state"))
    if payload.get("provider") != "github":
        return RedirectResponse(url=_frontend_callback_url(False, error="invalid_state"))

    async with httpx.AsyncClient(timeout=10) as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        if token_response.status_code >= 400:
            return RedirectResponse(url=_frontend_callback_url(False, error="token_exchange_failed"))
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url=_frontend_callback_url(False, error="missing_access_token"))

        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        if user_response.status_code >= 400:
            return RedirectResponse(url=_frontend_callback_url(False, error="user_info_failed"))
        userinfo = user_response.json()

        emails_response = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        emails = []
        if emails_response.status_code < 400:
            emails = emails_response.json()

    provider_user_id = str(userinfo.get("id") or "")
    email = userinfo.get("email")
    if not email and emails:
        primary = next((item for item in emails if item.get("primary") and item.get("verified")), None)
        if primary:
            email = primary.get("email")
        else:
            verified = next((item for item in emails if item.get("verified")), None)
            if verified:
                email = verified.get("email")

    if not provider_user_id:
        return RedirectResponse(url=_frontend_callback_url(False, error="missing_provider_id"))

    try:
        user = await _get_or_create_oauth_user(session, "github", provider_user_id, email)
    except HTTPException as exc:
        return RedirectResponse(url=_frontend_callback_url(False, error=quote(str(exc.detail))))

    refresh_token = await issue_refresh_token(session, user.id)
    response = RedirectResponse(
        url=_frontend_callback_url(True, return_url=payload.get("returnUrl") or "/"),
    )
    set_refresh_cookie(response, refresh_token)
    return response
