from datetime import datetime, timezone
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.cache import cached, invalidate_pattern
from app.core.config import get_settings
from app.db.session import get_session
from app.integrations.ai_review_chain import generate_ai_review, normalize_next_quiz_difficulty
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.repositories.ai_recommendation_repo import AiRecommendationRepository
from app.repositories.attempt_answer_repo import AttemptAnswerRepository
from app.repositories.question_repo import QuestionRepository
from app.schemas.attempts import (
    AiReviewResponse,
    AttemptCreate,
    AttemptListResponse,
    AttemptSubmit,
    AttemptOut,
    AttemptReviewItem,
    AttemptStats,
    AttemptTopicStats,
)
from app.utils.enums import QuestionType
from app.utils.rate_limit import ai_review_rate_limiter
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/attempts", tags=["attempts"])
logger = logging.getLogger(__name__)

STATS_CACHE_TTL = 120


def _to_out(attempt) -> AttemptOut:
    return AttemptOut(
        id=attempt.id,
        topic=attempt.topic,
        difficulty=attempt.difficulty,
        mode=attempt.mode,
        attempt_type=attempt.attempt_type or "normal",
        size=attempt.size,
        correct_count=attempt.correct_count,
        total_count=attempt.total_count,
        answers=attempt.answers,
        meta=attempt.meta,
        started_at=attempt.started_at,
        finished_at=attempt.finished_at,
        submitted_at=attempt.submitted_at,
        time_limit_seconds=attempt.time_limit_seconds,
        time_spent_seconds=attempt.time_spent_seconds,
        timed_out=attempt.timed_out,
        created_at=attempt.created_at,
        score_percent=attempt.score_percent,
    )


async def _recheck_exam_answers(
    answers: list, question_repo: QuestionRepository
) -> tuple[int, list[dict]]:
    """Score exam answers server-side. Returns (correct_count, answers_payload)."""
    question_ids: list[UUID] = []
    for item in answers:
        try:
            question_ids.append(UUID(str(item.question_id)))
        except ValueError:
            continue

    questions = await question_repo.get_by_ids(question_ids)
    question_map = {str(q.id): q.correct_answer for q in questions}

    correct_count = 0
    answers_payload: list[dict] = []
    for item in answers:
        expected = question_map.get(str(item.question_id))
        provided = item.selected_answer or ""
        is_correct = False
        if expected is not None:
            is_correct = _normalize(expected) == _normalize(provided)
        if is_correct:
            correct_count += 1
        answers_payload.append(
            {
                "question_id": str(item.question_id),
                "selected_answer": item.selected_answer,
                "is_correct": is_correct,
            }
        )

    return correct_count, answers_payload


def _normalize(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


def _format_question_block(
    question,
    answer: dict,
    hint_level: int | None,
    hint_penalty: int | None,
) -> str:
    user_answer = answer.get("selected_answer") or answer.get("user_answer", "")
    choices_text = ""
    if question.choices:
        choices_text = "\n".join(f"{k}) {v}" for k, v in question.choices.items())
    return "\n".join(
        [
            f"Question: {question.prompt}",
            f"Topic: {question.topic}",
            f"Difficulty: {question.difficulty}",
            f"Type: {question.type}",
            f"Choices: {choices_text}" if choices_text else "Choices: (none)",
            f"Correct Answer: {question.correct_answer}",
            f"User Answer: {user_answer}",
            f"Is Correct: {answer.get('is_correct', False)}",
            f"Hint Level: {hint_level or 0}",
            f"Hint Penalty: {hint_penalty or 0}%",
        ]
    )


def _compact_text(value: str, max_len: int = 160) -> str:
    text = " ".join(str(value or "").strip().split())
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 3]}..."


def _apply_next_quiz_guard(review_json: dict[str, Any]) -> dict[str, Any]:
    next_quiz = review_json.get("next_quiz") or {}
    normalized_difficulty = normalize_next_quiz_difficulty(next_quiz.get("difficulty"))
    review_json["next_quiz"] = {
        "topic": next_quiz.get("topic") or "",
        "difficulty": normalized_difficulty,
        "size": int(next_quiz.get("size") or 10),
    }
    next_quiz_suggestion = review_json.get("next_quiz_suggestion") or {}
    review_json["next_quiz_suggestion"] = {
        "topics": next_quiz_suggestion.get("topics")
        or [review_json["next_quiz"]["topic"] or ""],
        "difficulty": normalized_difficulty,
        "size": int(next_quiz_suggestion.get("size") or review_json["next_quiz"]["size"]),
    }
    return review_json


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
    if data.get("answers"):
        data["answers"] = [
            {**a, "question_id": str(a["question_id"])} for a in data["answers"]
        ]
    if not data.get("attempt_type"):
        data["attempt_type"] = "normal"
    if not data.get("submitted_at") and data.get("finished_at"):
        data["submitted_at"] = datetime.now(timezone.utc)
    if body.mode == "exam":
        question_repo = QuestionRepository(session)
        correct_count, answers_payload = await _recheck_exam_answers(
            body.answers, question_repo
        )
        data["correct_count"] = correct_count
        data["answers"] = answers_payload
    data["user_id"] = user.id

    if body.attempt_id:
        attempt = await repo.get_by_id(UUID(str(body.attempt_id)))
        if not attempt or attempt.user_id != user.id:
            raise HTTPException(status_code=404, detail="Attempt not found")
        data.pop("attempt_id", None)
        attempt = await repo.update_attempt(attempt, data)
    else:
        data.pop("attempt_id", None)
        attempt = await repo.create_attempt(data)

    answer_repo = AttemptAnswerRepository(session)
    await answer_repo.replace_for_attempt(attempt.id, user.id, attempt.answers or [])

    await invalidate_pattern(f"quizstudy:user:{user.id}:stats:*")

    return _to_out(attempt)


@router.post("/{attempt_id}/submit", response_model=AttemptOut)
async def submit_attempt(
    attempt_id: UUID,
    body: AttemptSubmit,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    logger.info(
        "attempt submit payload attempt_id=%s user_id=%s keys=%s total=%s answers=%s",
        attempt_id,
        user.id,
        list(body.model_dump().keys()),
        body.total_count,
        len(body.answers or []),
    )
    logger.debug(
        "attempt submit payload body=%s",
        body.model_dump(),
    )
    if body.total_count <= 0:
        raise HTTPException(status_code=400, detail="total_count must be > 0")
    if body.correct_count < 0 or body.correct_count > body.total_count:
        raise HTTPException(status_code=400, detail="Invalid correct_count")
    if not body.answers:
        raise HTTPException(status_code=400, detail="answers missing")

    repo = QuizAttemptRepository(session)
    attempt = await repo.get_by_id(attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if getattr(attempt, "submitted_at", None):
        return _to_out(attempt)

    attempt_meta = attempt.meta if isinstance(attempt.meta, dict) else {}
    attempt_question_ids = set(str(qid) for qid in (attempt_meta.get("questions") or []))
    if attempt_question_ids:
        for item in body.answers:
            if str(item.question_id) not in attempt_question_ids:
                logger.warning(
                    "attempt submit invalid question %s for %s",
                    item.question_id,
                    attempt_id,
                )
                raise HTTPException(
                    status_code=400,
                    detail="question_id not in attempt",
                )

    data = body.model_dump()
    if data.get("answers"):
        data["answers"] = [
            {**a, "question_id": str(a["question_id"])} for a in data["answers"]
        ]
    if not data.get("attempt_type"):
        data["attempt_type"] = getattr(attempt, "attempt_type", "normal")
    if not data.get("topic"):
        fallback = "mistakes" if data.get("attempt_type") == "mistakes_review" else "mixed"
        data["topic"] = attempt.topic or fallback

    if body.mode == "exam":
        question_repo = QuestionRepository(session)
        correct_count, answers_payload = await _recheck_exam_answers(
            body.answers, question_repo
        )
        data["correct_count"] = correct_count
        data["answers"] = answers_payload

    data["user_id"] = user.id
    data.pop("attempt_id", None)
    data["submitted_at"] = datetime.now(timezone.utc)
    if not data.get("finished_at"):
        data["finished_at"] = data["submitted_at"]

    attempt = await repo.update_attempt(attempt, data)

    answer_repo = AttemptAnswerRepository(session)
    await answer_repo.replace_for_attempt(attempt.id, user.id, attempt.answers or [])

    recommendation_repo = AiRecommendationRepository(session)
    await recommendation_repo.complete_by_attempt(user.id, attempt.id)

    await invalidate_pattern(f"quizstudy:user:{user.id}:stats:*")

    logger.info("attempt submitted %s at %s", attempt.id, attempt.submitted_at)
    return _to_out(attempt)


@router.get("/{attempt_id}/review", response_model=list[AttemptReviewItem])
async def get_attempt_review(
    attempt_id: UUID,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AttemptReviewItem]:
    repo = QuizAttemptRepository(session)
    attempt = await repo.get_by_id(attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answer_repo = AttemptAnswerRepository(session)
    answers = await answer_repo.list_for_attempt(attempt_id, user.id)
    answer_map = {str(item.question_id): item for item in answers}

    ordered_ids: list[str] = []
    if attempt.answers:
        for item in attempt.answers:
            question_id = item.get("question_id") if isinstance(item, dict) else None
            if question_id:
                ordered_ids.append(str(question_id))
    if not ordered_ids:
        ordered_ids = [str(item.question_id) for item in answers]

    question_ids: list[UUID] = []
    for item in ordered_ids:
        try:
            question_ids.append(UUID(str(item)))
        except Exception:
            continue

    question_repo = QuestionRepository(session)
    questions = await question_repo.get_by_ids(question_ids)
    question_map = {str(q.id): q for q in questions}

    output: list[AttemptReviewItem] = []
    for question_id in ordered_ids:
        question = question_map.get(question_id)
        if not question:
            continue
        answer = answer_map.get(question_id)
        user_answer = answer.selected_answer if answer else None
        is_correct = bool(answer.is_correct) if answer else False
        correct_answer_text = None
        if question.type == QuestionType.MCQ:
            if question.choices and question.correct_answer:
                choice_text = question.choices.get(question.correct_answer)
                if choice_text:
                    correct_answer_text = f"{question.correct_answer} — {choice_text}"
                else:
                    correct_answer_text = question.correct_answer
            else:
                correct_answer_text = question.correct_answer
        else:
            correct_answer_text = question.correct_answer

        output.append(
            AttemptReviewItem(
                question_id=str(question.id),
                prompt=question.prompt,
                code=question.code,
                choices=question.choices,
                correct_answer=question.correct_answer,
                correct_answer_text=correct_answer_text,
                user_answer=user_answer,
                is_correct=is_correct,
                explanation=question.explanation,
            )
        )

    return output


@router.get("", response_model=AttemptListResponse)
async def list_attempts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AttemptListResponse:
    repo = QuizAttemptRepository(session)
    attempts, total = await repo.list_attempts(
        user_id=user.id, limit=limit, offset=offset
    )
    return AttemptListResponse(items=[_to_out(item) for item in attempts], total=total)


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
    cache_key = f"quizstudy:user:{user.id}:stats:{topics}:{mode}:{date_from}:{date_to}"

    stats = await cached(
        cache_key,
        STATS_CACHE_TTL,
        lambda: repo.stats(
            user_id=user.id,
            topics=topics,
            mode=mode,
            date_from=date_from,
            date_to=date_to,
        ),
    )
    return AttemptStats(
        total_attempts=stats["total_attempts"],
        avg_score_percent=stats["avg_score_percent"],
        best_score_percent=stats["best_score_percent"],
        last_attempt_at=stats["last_attempt_at"],
        by_topic=[AttemptTopicStats(**item) for item in stats["by_topic"]],
        current_streak_days=stats["current_streak_days"],
        strongest_topic=stats["strongest_topic"],
        weakest_topic=stats["weakest_topic"],
        recent_scores=stats["recent_scores"],
        recent_attempts=stats["recent_attempts"],
    )


@router.get("/{attempt_id}/ai-review", response_model=AiReviewResponse)
async def get_attempt_ai_review(
    attempt_id: UUID,
    generate: bool = Query(default=False),
    user=Depends(get_current_user),
    _rate_limiter=Depends(ai_review_rate_limiter),
    session: AsyncSession = Depends(get_session),
) -> AiReviewResponse:
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI review not configured")

    repo = QuizAttemptRepository(session)
    attempt = await repo.get_by_id(attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.ai_review_json:
        guarded = _apply_next_quiz_guard({**attempt.ai_review_json})
        return AiReviewResponse(status="ready", **guarded)

    if not generate:
        return AiReviewResponse(status="not_generated", ai_review=None)

    answers = attempt.answers or []
    question_ids: list[UUID] = []
    for item in answers:
        try:
            question_ids.append(UUID(str(item.get("question_id"))))
        except Exception:
            continue

    question_repo = QuestionRepository(session)
    questions = await question_repo.get_by_ids(question_ids)
    question_map = {str(q.id): q for q in questions}

    incorrect_count = 0
    correct_count = 0
    incorrect_items: list[dict] = []
    correct_items: list[dict] = []

    for item in answers:
        question = question_map.get(str(item.get("question_id")))
        if not question:
            continue
        entry = {
            "question": _compact_text(question.prompt, 160),
            "correct_answer": _compact_text(question.correct_answer, 120),
            "your_answer": _compact_text(
                item.get("selected_answer") or item.get("user_answer", ""),
                120,
            ),
        }
        if item.get("is_correct"):
            correct_count += 1
            correct_items.append(entry)
        else:
            incorrect_count += 1
            incorrect_items.append(entry)

    questions_compact: list[dict] = []
    for entry in (incorrect_items + correct_items):
        if len(questions_compact) >= 12:
            break
        questions_compact.append(
            {
                "question_ref": f"Question(№{len(questions_compact) + 1})",
                **entry,
            }
        )

    payload = {
        "total": attempt.total_count,
        "correct": correct_count,
        "incorrect": incorrect_count,
        "percent": attempt.score_percent,
        "mode": attempt.mode,
        "questions_compact_json": json.dumps(questions_compact, ensure_ascii=False),
    }

    review_json = await generate_ai_review(payload)
    review_json = {
        "headline": "",
        "score_line": "",
        "top_mistakes": [],
        "strengths": [],
        "micro_drills": [],
        "next_quiz": {"topic": "", "difficulty": "", "size": 10},
        **(review_json or {}),
    }
    top_mistakes = review_json.get("top_mistakes") or []
    review_json["summary"] = review_json.get("headline") or ""
    review_json["weaknesses"] = [
        f"{item.get('question_ref')}: {item.get('why')}".strip()
        for item in top_mistakes
        if isinstance(item, dict) and (item.get("question_ref") or item.get("why"))
    ]
    review_json = _apply_next_quiz_guard(review_json)
    if review_json.get("status") == "error":
        return AiReviewResponse(**review_json)
    await repo.set_ai_review(attempt_id, review_json)
    return AiReviewResponse(status="ready", **review_json)


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
