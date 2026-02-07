from __future__ import annotations

import asyncio
from typing import Any

from redis import asyncio as redis_asyncio

from app.core.config import get_settings


_redis: redis_asyncio.Redis | None = None
_redis_lock = asyncio.Lock()


def _build_redis() -> redis_asyncio.Redis:
    settings = get_settings()
    return redis_asyncio.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )


async def get_redis() -> redis_asyncio.Redis:
    global _redis
    if _redis is None:
        async with _redis_lock:
            if _redis is None:
                _redis = _build_redis()
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is None:
        return
    await _redis.close()
    _redis = None
