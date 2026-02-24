from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from redis import asyncio as redis_asyncio

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis: redis_asyncio.Redis | None = None
_redis_failed_at: float | None = None
_REDIS_RETRY_INTERVAL = 30  # seconds
_redis_lock = asyncio.Lock()


class MemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, tuple[str, float | None]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> str | None:
        async with self._lock:
            value = self._data.get(key)
            if value is None:
                return None
            payload, expires_at = value
            if expires_at is not None and expires_at <= time.monotonic():
                self._data.pop(key, None)
                return None
            return payload

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        expires_at = time.monotonic() + ex if ex else None
        async with self._lock:
            self._data[key] = (value, expires_at)

    async def delete(self, key: str) -> int:
        async with self._lock:
            return 1 if self._data.pop(key, None) is not None else 0

    async def close(self) -> None:
        return None


_memory_store = MemoryStore()


def _build_redis() -> redis_asyncio.Redis:
    settings = get_settings()
    return redis_asyncio.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )


async def _connect_redis() -> redis_asyncio.Redis:
    client = _build_redis()
    await client.ping()
    return client


async def get_redis_real() -> redis_asyncio.Redis | None:
    global _redis, _redis_failed_at
    if _redis is not None:
        return _redis
    if _redis_failed_at is not None:
        if (time.monotonic() - _redis_failed_at) < _REDIS_RETRY_INTERVAL:
            return None
    async with _redis_lock:
        if _redis is not None:
            return _redis
        if _redis_failed_at is not None:
            if (time.monotonic() - _redis_failed_at) < _REDIS_RETRY_INTERVAL:
                return None
        try:
            _redis = await _connect_redis()
            _redis_failed_at = None
        except Exception:
            settings = get_settings()
            if settings.ENV.lower() not in {"dev", "development", "local"}:
                raise RuntimeError(
                    "Redis is required in production but connection failed. "
                    "Set ENV=dev to allow MemoryStore fallback."
                )
            logger.critical(
                "Redis unavailable — falling back to in-memory store. "
                "Will retry in %ds.",
                _REDIS_RETRY_INTERVAL,
            )
            _redis_failed_at = time.monotonic()
            return None
    return _redis


async def get_redis() -> redis_asyncio.Redis | MemoryStore:
    redis = await get_redis_real()
    if redis is None:
        return _memory_store
    return redis


async def close_redis() -> None:
    global _redis
    if _redis is None:
        return
    await _redis.close()
    _redis = None

