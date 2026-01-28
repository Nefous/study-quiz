from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.schemas.attempts import AttemptCreate, AttemptOut, AttemptStats, AttemptTopicStats

router = APIRouter(prefix="/attempts", tags=["attempts"])


def _to_out(attempt) -> AttemptOut:
    return AttemptOut(
        id=attempt.id,
        topic=attempt.topic,
        difficulty=attempt.difficulty,
        mode=attempt.mode,
        size=attempt.size,
        correct_count=attempt.correct_count,
        total_count=attempt.total_count,
        answers=attempt.answers,
        meta=getattr(attempt, "meta", None),
        created_at=attempt.created_at,
        score_percent=attempt.score_percent,
    )


@router.post("", response_model=AttemptOut)
async def create_attempt(
    body: AttemptCreate,
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    if body.total_count <= 0:
        raise HTTPException(status_code=400, detail="total_count must be > 0")
    if body.correct_count < 0 or body.correct_count > body.total_count:
        raise HTTPException(status_code=400, detail="Invalid correct_count")

    repo = QuizAttemptRepository(session)
    attempt = await repo.create_attempt(body.model_dump())
    return _to_out(attempt)


@router.get("", response_model=list[AttemptOut])
async def list_attempts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[AttemptOut]:
    repo = QuizAttemptRepository(session)
    attempts = await repo.list_attempts(limit=limit, offset=offset)
    return [_to_out(item) for item in attempts]


@router.get("/stats", response_model=AttemptStats)
async def get_attempt_stats(
    session: AsyncSession = Depends(get_session),
) -> AttemptStats:
    repo = QuizAttemptRepository(session)
    stats = await repo.stats()
    return AttemptStats(
        total_attempts=stats["total_attempts"],
        avg_score_percent=stats["avg_score_percent"],
        best_score_percent=stats["best_score_percent"],
        last_attempt_at=stats["last_attempt_at"],
        by_topic=[AttemptTopicStats(**item) for item in stats["by_topic"]],
    )
