from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from pydantic import ValidationError

from app.integrations.next_quiz_recommendation_chain import (
    generate_next_quiz_recommendation,
)
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.schemas.recommendations import (
    NextQuizRecommendation,
    NextQuizRecommendationGenerated,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

_CACHE_TTL = timedelta(hours=6)
_GENERATED_CACHE: dict[str, dict[str, Any]] = {}


def _get_cached_generated(user_id: str) -> dict[str, Any] | None:
    cached = _GENERATED_CACHE.get(user_id)
    if not cached:
        return None
    if cached["expires_at"] <= datetime.utcnow():
        _RECOMMENDATION_CACHE.pop(user_id, None)
        return None
    return cached["payload"]


def _set_cached_generated(user_id: str, payload: dict[str, Any]) -> None:
    _GENERATED_CACHE[user_id] = {
        "expires_at": datetime.utcnow() + _CACHE_TTL,
        "payload": payload,
    }
def _build_base_recommendation(attempts: list) -> tuple[dict[str, Any], str]:
    if not attempts:
        base = {
            "topic": "mixed",
            "difficulty": "junior",
            "size": 10,
            "based_on": "no_attempts",
        }
        context = "No attempts yet. Provide a gentle starter recommendation."
        return base, context

    scores = [int(getattr(attempt, "score_percent", 0) or 0) for attempt in attempts]
    avg_score = int(round(sum(scores) / len(scores))) if scores else 0

    bucket = _topic_bucket(attempts)
    candidates = {
        topic: scores
        for topic, scores in bucket.items()
        if len(scores) >= 5
    }

    weakest_topic = None
    if candidates:
        weakest_topic = min(
            candidates.items(),
            key=lambda item: sum(item[1]) / len(item[1]),
        )[0]

    base = {
        "topic": weakest_topic or "mixed",
        "difficulty": "junior" if avg_score < 45 else "middle",
        "size": 15 if avg_score > 60 else 10,
        "based_on": "last_20_attempts",
    }
    context = (
        f"Average score: {avg_score}%. "
        f"Weakest topic: {weakest_topic or 'none (insufficient data)'}"
    )
    return base, context



def _topic_bucket(attempts: list) -> dict[str, list[int]]:
    bucket: dict[str, list[int]] = {}
    for attempt in attempts:
        topic = getattr(attempt, "topic", None)
        score = int(getattr(attempt, "score_percent", 0) or 0)
        meta = getattr(attempt, "meta", None)

        meta_topics = []
        if topic in {"mix", "random"} and isinstance(meta, dict):
            meta_topics = meta.get("topics") or []

        if topic in {"mix", "random"} and meta_topics:
            for item in meta_topics:
                if not item or item == "random":
                    continue
                bucket.setdefault(item, []).append(score)
            continue

        if not topic or topic in {"mix", "random"}:
            continue

        bucket.setdefault(topic, []).append(score)
    return bucket


@router.get("/next-quiz", response_model=NextQuizRecommendation)
async def get_next_quiz_recommendation(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NextQuizRecommendation:
    repo = QuizAttemptRepository(session)
    attempts = await repo.list_attempts(user_id=user.id, limit=20, offset=0)
    base, _ = _build_base_recommendation(attempts)
    return NextQuizRecommendation(**base)


@router.post("/next-quiz:generate", response_model=NextQuizRecommendationGenerated)
async def generate_next_quiz_recommendation_endpoint(
    user=Depends(get_current_user),
    force: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
) -> NextQuizRecommendationGenerated:
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI recommendation not configured")

    cached = _get_cached_generated(str(user.id))
    if cached and not force:
        return NextQuizRecommendationGenerated(**cached)

    repo = QuizAttemptRepository(session)
    attempts = await repo.list_attempts(user_id=user.id, limit=20, offset=0)
    base, context = _build_base_recommendation(attempts)
    ai_payload = await generate_next_quiz_recommendation(
        {
            **base,
            "context": context,
            "allowed_topics": "python_core, big_o, algorithms, data_structures, mixed",
        }
    )
    merged = {
        **base,
        "topic": ai_payload.get("topic") or base["topic"],
        "difficulty": ai_payload.get("difficulty") or base["difficulty"],
        "size": ai_payload.get("size") or base["size"],
        "based_on": ai_payload.get("based_on") or base["based_on"],
        "reason": ai_payload.get("reason") or "Focus on steady improvement.",
        "prep": ai_payload.get("prep") or [],
    }

    try:
        validated = NextQuizRecommendationGenerated(**merged)
        payload = validated.model_dump()
    except ValidationError:
        payload = {
            **base,
            "reason": merged["reason"],
            "prep": merged["prep"],
        }

    _set_cached_generated(str(user.id), payload)
    return NextQuizRecommendationGenerated(**payload)
