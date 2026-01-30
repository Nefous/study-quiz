from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.db.session import get_session
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.repositories.question_repo import QuestionRepository
from app.schemas.attempts import AttemptCreate, AttemptOut, AttemptStats, AttemptTopicStats
from app.services.auth_service import get_current_user

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
        started_at=getattr(attempt, "started_at", None),
        finished_at=getattr(attempt, "finished_at", None),
        time_limit_seconds=getattr(attempt, "time_limit_seconds", None),
        time_spent_seconds=getattr(attempt, "time_spent_seconds", None),
        timed_out=getattr(attempt, "timed_out", None),
        created_at=attempt.created_at,
        score_percent=attempt.score_percent,
    )


def _normalize(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


@router.post("", response_model=AttemptOut)
async def create_attempt(
    body: AttemptCreate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    if body.total_count <= 0:
        raise HTTPException(status_code=400, detail="total_count must be > 0")
    if body.correct_count < 0 or body.correct_count > body.total_count:
        raise HTTPException(status_code=400, detail="Invalid correct_count")

    repo = QuizAttemptRepository(session)
    data = body.model_dump()
    if body.mode == "exam":
        question_ids: list[UUID] = []
        for item in body.answers:
            try:
                question_ids.append(UUID(str(item.question_id)))
            except ValueError:
                continue

        question_repo = QuestionRepository(session)
        questions = await question_repo.get_by_ids(question_ids)
        question_map = {str(item.id): item.correct_answer for item in questions}

        correct_count = 0
        answers_payload = []
        for item in body.answers:
            expected = question_map.get(item.question_id)
            provided = item.user_answer or ""
            is_correct = False
            if expected is not None:
                is_correct = _normalize(expected) == _normalize(provided)
            if is_correct:
                correct_count += 1
            answers_payload.append(
                {
                    "question_id": item.question_id,
                    "user_answer": item.user_answer,
                    "is_correct": is_correct,
                }
            )

        data["correct_count"] = correct_count
        data["answers"] = answers_payload
    data["user_id"] = user.id
    attempt = await repo.create_attempt(data)
    return _to_out(attempt)


@router.get("", response_model=list[AttemptOut])
async def list_attempts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AttemptOut]:
    repo = QuizAttemptRepository(session)
    attempts = await repo.list_attempts(user_id=user.id, limit=limit, offset=offset)
    return [_to_out(item) for item in attempts]


@router.get("/stats", response_model=AttemptStats)
async def get_attempt_stats(
    topics: list[str] | None = Query(default=None),
    mode: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AttemptStats:
    repo = QuizAttemptRepository(session)
    stats = await repo.stats(
        user_id=user.id,
        topics=topics,
        mode=mode,
        date_from=date_from,
        date_to=date_to,
    )
    return AttemptStats(
        total_attempts=stats["total_attempts"],
        avg_score_percent=stats["avg_score_percent"],
        best_score_percent=stats["best_score_percent"],
        last_attempt_at=stats["last_attempt_at"],
        by_topic=[AttemptTopicStats(**item) for item in stats["by_topic"]],
    )


@router.get("/{attempt_id}", response_model=AttemptOut)
async def get_attempt(
    attempt_id: UUID,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    repo = QuizAttemptRepository(session)
    attempt = await repo.get_by_id(attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return _to_out(attempt)
