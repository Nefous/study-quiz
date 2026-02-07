from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from pydantic import ValidationError

from app.integrations.next_quiz_recommendation_chain import (
    generate_next_quiz_recommendation,
)
from app.repositories.ai_recommendation_repo import AiRecommendationRepository
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.schemas.recommendations import (
    NextQuizRecommendation,
    NextQuizRecommendationGenerateInput,
    NextQuizRecommendationGenerated,
)
from app.services.auth_service import get_current_user
from app.utils.rate_limit import ai_coach_rate_limiter

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

_ALLOWED_TOPICS = {"python_core", "big_o", "algorithms", "data_structures", "mixed"}
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


@router.get("/next-quiz", response_model=NextQuizRecommendation, response_model_exclude_none=True)
async def get_next_quiz_recommendation(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NextQuizRecommendation:
    repo = AiRecommendationRepository(session)
    active = await repo.get_active(user.id)
    if not active:
        return NextQuizRecommendation()

    tips = active.tips_json or {}
    return NextQuizRecommendation(
        id=str(active.id),
        topic=active.topic,
        difficulty=active.difficulty,
        size=active.size,
        based_on=tips.get("based_on"),
        reason=tips.get("reason"),
        prep=tips.get("prep"),
    )


@router.post("/next-quiz/generate", response_model=NextQuizRecommendationGenerated)
async def generate_next_quiz_recommendation_endpoint(
    user=Depends(get_current_user),
    _rate_limiter=Depends(ai_coach_rate_limiter),
    session: AsyncSession = Depends(get_session),
) -> NextQuizRecommendationGenerated:
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI recommendation not configured")

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
        validated = NextQuizRecommendationGenerateInput(**merged)
        topic = validated.topic
        difficulty = validated.difficulty
        size = validated.size
        reason = validated.reason
        prep = validated.prep
    except ValidationError:
        topic = "mixed"
        difficulty = "junior"
        size = 10
        reason = merged.get("reason") or "Focus on steady improvement."
        prep = merged.get("prep") or []

    if topic not in _ALLOWED_TOPICS:
        topic = "mixed"

    recommendation_repo = AiRecommendationRepository(session)
    stored = await recommendation_repo.create_active(
        user_id=user.id,
        topic=topic,
        difficulty=difficulty,
        size=size,
        tips_json={
            "reason": reason,
            "prep": prep,
            "based_on": merged.get("based_on"),
        },
    )

    return NextQuizRecommendationGenerated(
        id=str(stored.id),
        topic=stored.topic,
        difficulty=stored.difficulty,
        size=stored.size,
        based_on=stored.tips_json.get("based_on") if stored.tips_json else None,
        reason=stored.tips_json.get("reason") if stored.tips_json else reason,
        prep=stored.tips_json.get("prep") if stored.tips_json else prep,
    )


@router.post("/{recommendation_id}/start")
async def start_recommendation_quiz(
    recommendation_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    recommendation_repo = AiRecommendationRepository(session)
    recommendation = await recommendation_repo.get_by_id(recommendation_id)
    if not recommendation or recommendation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if recommendation.status != "active":
        raise HTTPException(status_code=400, detail="Recommendation is not active")

    if recommendation.attempt_id:
        return {"attempt_id": str(recommendation.attempt_id)}

    attempt_repo = QuizAttemptRepository(session)
    attempt = await attempt_repo.create_attempt(
        {
            "user_id": user.id,
            "topic": recommendation.topic,
            "difficulty": recommendation.difficulty,
            "mode": "practice",
            "size": recommendation.size,
            "correct_count": 0,
            "total_count": recommendation.size,
            "answers": [],
            "meta": {"recommendation_id": str(recommendation.id), "pending": True},
        }
    )
    await recommendation_repo.set_attempt_id(recommendation.id, attempt.id)
    return {"attempt_id": str(attempt.id)}
