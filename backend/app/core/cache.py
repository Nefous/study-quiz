from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)


async def cached(
    key: str,
    ttl: int,
    fetch_fn: Callable[[], Awaitable[Any]],
) -> Any:
    redis = await get_redis()
    raw = await redis.get(key)
    if raw is not None:
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Bad cache payload for key=%s – refetching", key)

    result = await fetch_fn()
    try:
        await redis.set(key, json.dumps(result, default=str), ex=ttl)
    except Exception:
        logger.warning("Failed to write cache key=%s", key, exc_info=True)
    return result


async def invalidate(*keys: str) -> None:
    if not keys:
        return
    redis = await get_redis()
    for key in keys:
        try:
            await redis.delete(key)
        except Exception:
            logger.warning("Failed to invalidate key=%s", key, exc_info=True)


async def invalidate_pattern(pattern: str) -> None:
    redis = await get_redis()

    if hasattr(redis, "_data"):
        async with redis._lock:
            to_delete = [k for k in redis._data if _match_glob(pattern, k)]
            for k in to_delete:
                redis._data.pop(k, None)
        return

    cursor: int | str = 0
    deleted = 0
    try:
        while True:
            cursor, keys = await redis.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await redis.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
    except Exception:
        logger.warning(
            "Failed to invalidate pattern=%s (deleted %d)", pattern, deleted, exc_info=True,
        )


def _match_glob(pattern: str, key: str) -> bool:
    if pattern.endswith("*"):
        return key.startswith(pattern[:-1])
    return key == pattern
