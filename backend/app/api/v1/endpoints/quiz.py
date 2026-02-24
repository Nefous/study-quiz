from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.db.session import get_session
from app.schemas.quiz import QuizGenerateRequest, QuizGenerateResponse, QuizQuestionOut
from app.services.quiz_service import QuizService
from app.core.exceptions import InsufficientQuestionsError
from app.utils.enums import AttemptType, Difficulty, QuizMode, Topic
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.repositories.question_repo import QuestionRepository
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/quiz")


def _parse_topics(body: QuizGenerateRequest) -> list[Topic] | None:
    if body.topics is not None:
        if not body.topics:
            raise ValueError("Invalid topics")
        topics = list(body.topics)
        if Topic.RANDOM in topics:
            topics = [t for t in Topic if t != Topic.RANDOM]
        return topics
    if body.topic is not None:
        if body.topic == Topic.RANDOM:
            return [t for t in Topic if t != Topic.RANDOM]
        return [body.topic]
    return None


def _build_meta(
    topics: list[Topic] | None, question_ids: list[str]
) -> tuple[str, dict]:
    topic_value = "random"
    meta: dict = {}
    if topics:
        if len(topics) == 1:
            topic_value = topics[0].value
        else:
            topic_value = "mix"
            meta["topics"] = [item.value for item in topics]
    meta["questions"] = question_ids
    return topic_value, meta


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    body: QuizGenerateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> QuizGenerateResponse:
    attempt_id = body.attempt_id
    attempt_type = body.attempt_type or AttemptType.NORMAL
    if attempt_type != AttemptType.MISTAKES_REVIEW and body.mode is None:
        raise HTTPException(status_code=400, detail="Missing mode")
    if attempt_type != AttemptType.MISTAKES_REVIEW and body.difficulty is None:
        raise HTTPException(status_code=400, detail="Missing difficulty")

    mode = body.mode or QuizMode.PRACTICE

    try:
        topics = _parse_topics(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if attempt_type != AttemptType.MISTAKES_REVIEW and topics is None:
        raise HTTPException(status_code=400, detail="Missing topic or topics")

    topics = list(dict.fromkeys(topics)) if topics else None
    difficulty = body.difficulty

    size = body.size
    if size is None and body.limit is not None:
        size = body.limit

    service = QuizService(session)
    try:
        if attempt_type == AttemptType.MISTAKES_REVIEW:
            attempt_repo = QuizAttemptRepository(session)
            existing = await attempt_repo.get_in_progress_attempt(
                user.id,
                AttemptType.MISTAKES_REVIEW.value,
            )
            if existing:
                meta = existing.meta if isinstance(existing.meta, dict) else {}
                question_ids_raw = meta.get("questions") or []
                if question_ids_raw:
                    question_repo = QuestionRepository(session)
                    question_ids = []
                    for item in question_ids_raw:
                        try:
                            question_ids.append(UUID(str(item)))
                        except Exception:
                            continue
                    questions = await question_repo.get_by_ids(question_ids)
                    question_map = {q.id: q for q in questions}
                    ordered = [question_map[qid] for qid in question_ids if qid in question_map]
                    if ordered:
                        response = QuizGenerateResponse(
                            quiz_id=existing.id,
                            questions=[
                                QuizQuestionOut.model_validate(q) for q in ordered
                            ],
                            attempt_id=existing.id,
                        )
                        return response
            if difficulty is None:
                difficulty = Difficulty.JUNIOR
            topic = topics[0] if topics and len(topics) == 1 else None
            response = await service.generate_mistakes_review(
                user_id=user.id,
                topic=topic,
                difficulty=difficulty,
                limit=size,
            )
            question_ids_str = [str(item.id) for item in response.questions]
            topic_value, meta = _build_meta(topics, question_ids_str)
            if existing:
                attempt = await attempt_repo.update_attempt(
                    existing,
                    {
                        "topic": topic_value,
                        "difficulty": difficulty.value,
                        "mode": mode.value,
                        "attempt_type": AttemptType.MISTAKES_REVIEW.value,
                        "size": size,
                        "correct_count": 0,
                        "total_count": len(response.questions),
                        "answers": [],
                        "meta": meta,
                        "started_at": existing.started_at or datetime.now(timezone.utc),
                    },
                )
            else:
                attempt = await attempt_repo.create_attempt(
                    {
                        "user_id": user.id,
                        "topic": topic_value,
                        "difficulty": difficulty.value,
                        "mode": mode.value,
                        "attempt_type": AttemptType.MISTAKES_REVIEW.value,
                        "size": size,
                        "correct_count": 0,
                        "total_count": len(response.questions),
                        "answers": [],
                        "meta": meta,
                        "started_at": datetime.now(timezone.utc),
                    }
                )
            response.attempt_id = attempt.id
            return response
        response = await service.generate_quiz(
            topics=topics,
            difficulty=difficulty,
            mode=mode,
            size=size,
        )
        attempt_repo = QuizAttemptRepository(session)
        question_ids_str = [str(item.id) for item in response.questions]
        topic_value, meta = _build_meta(topics, question_ids_str)
        if attempt_id:
            attempt = await attempt_repo.get_by_id(attempt_id)
            if not attempt or attempt.user_id != user.id:
                raise HTTPException(status_code=404, detail="Attempt not found")
            attempt = await attempt_repo.update_attempt(
                attempt,
                {
                    "topic": topic_value,
                    "difficulty": difficulty.value,
                    "mode": mode.value,
                    "attempt_type": AttemptType.NORMAL.value,
                    "size": size,
                    "correct_count": 0,
                    "total_count": len(response.questions),
                    "answers": [],
                    "meta": meta,
                    "started_at": attempt.started_at or datetime.now(timezone.utc),
                },
            )
        else:
            attempt = await attempt_repo.create_attempt(
                {
                    "user_id": user.id,
                    "topic": topic_value,
                    "difficulty": difficulty.value,
                    "mode": mode.value,
                    "attempt_type": AttemptType.NORMAL.value,
                    "size": size,
                    "correct_count": 0,
                    "total_count": len(response.questions),
                    "answers": [],
                    "meta": meta,
                    "started_at": datetime.now(timezone.utc),
                }
            )
        response.attempt_id = attempt.id
        return response
    except InsufficientQuestionsError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
