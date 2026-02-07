from __future__ import annotations

import importlib
from math import ceil

from fastapi import Request, Response
from fastapi.security.utils import get_authorization_scheme_param
from starlette.responses import JSONResponse

from app.services.auth_service import decode_access_token
def _load_rate_limiter():
    for name in ("fastapi_limiter.depends", "fastapi_limiter"):
        try:
            module = importlib.import_module(name)
        except ModuleNotFoundError:
            continue
        if hasattr(module, "RateLimiter"):
            return module.RateLimiter
    raise ImportError("RateLimiter not found in fastapi_limiter")


RateLimiter = _load_rate_limiter()



def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _get_user_id(request: Request) -> str | None:
    scheme, token = get_authorization_scheme_param(request.headers.get("Authorization"))
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        payload = decode_access_token(token)
    except Exception:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return str(user_id)


def user_or_ip_identifier(request: Request) -> str:
    user_id = _get_user_id(request)
    if user_id:
        return f"user:{user_id}"
    return f"ip:{_get_client_ip(request)}"


async def async_user_or_ip_identifier(request: Request) -> str:
    return user_or_ip_identifier(request)


async def rate_limit_callback(
    request: Request,
    response: Response,
    pexpire: int,
) -> JSONResponse:
    retry_after = max(1, int(ceil(pexpire / 1000)))
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "message": "Rate limit reached. Please try again later.",
                "status": 429,
                "retry_after": retry_after,
            }
        },
        headers={"Retry-After": str(retry_after)},
    )


def build_rate_limiter(
    *,
    user_times: int,
    user_seconds: int,
    anon_times: int = 10,
    anon_seconds: int = 3600,
    require_user: bool = False,
):
    async def dependency(request: Request, response: Response) -> None:
        user_id = _get_user_id(request)
        if require_user and not user_id:
            return
        if user_id:
            limiter = RateLimiter(
                times=user_times,
                seconds=user_seconds,
                identifier=async_user_or_ip_identifier,
                callback=rate_limit_callback,
            )
        else:
            limiter = RateLimiter(
                times=anon_times,
                seconds=anon_seconds,
                identifier=async_user_or_ip_identifier,
                callback=rate_limit_callback,
            )
        await limiter(request, response)

    return dependency


ai_hint_rate_limiter = build_rate_limiter(user_times=20, user_seconds=3600)
ai_review_rate_limiter = build_rate_limiter(user_times=10, user_seconds=86400, require_user=True)
ai_coach_rate_limiter = build_rate_limiter(user_times=5, user_seconds=3600, require_user=True)
