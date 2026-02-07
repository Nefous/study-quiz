from fastapi import APIRouter, Body, Depends, HTTPException
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.quiz import QuizGenerateResponse, QuizQuestionOut
from app.services.quiz_service import QuizService
from app.utils.enums import AttemptType, Difficulty, QuizMode, Topic
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.repositories.question_repo import QuestionRepository
from datetime import datetime
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/quiz")


def parse_enum(value: str, enum_cls, field: str):
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    try:
        return enum_cls(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field}") from exc


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    body: dict = Body(...),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> QuizGenerateResponse:
    attempt_type = parse_enum(body.get("attempt_type"), AttemptType, "attempt_type") if body.get("attempt_type") else AttemptType.NORMAL
    mode_value = body.get("mode")
    if attempt_type != AttemptType.MISTAKES_REVIEW and "mode" not in body:
        raise HTTPException(status_code=400, detail="Missing mode")
    if attempt_type != AttemptType.MISTAKES_REVIEW and "difficulty" not in body:
        raise HTTPException(status_code=400, detail="Missing difficulty")

    mode = parse_enum(mode_value, QuizMode, "mode") if mode_value else QuizMode.PRACTICE

    topic_raw = body.get("topic")
    topics_raw = body.get("topics")
    topics: list[Topic] | None = None

    if attempt_type != AttemptType.MISTAKES_REVIEW:
        if topics_raw is not None:
            if not isinstance(topics_raw, list) or not topics_raw:
                raise HTTPException(status_code=400, detail="Invalid topics")
            topics = [parse_enum(item, Topic, "topics") for item in topics_raw]
            if Topic.RANDOM in topics:
                topics = [t for t in Topic if t != Topic.RANDOM]
        elif topic_raw is not None:
            topic = parse_enum(topic_raw, Topic, "topic")
            if topic == Topic.RANDOM:
                topics = [t for t in Topic if t != Topic.RANDOM]
            else:
                topics = [topic]
        else:
            raise HTTPException(status_code=400, detail="Missing topic or topics")
    else:
        if topics_raw is not None:
            if not isinstance(topics_raw, list) or not topics_raw:
                raise HTTPException(status_code=400, detail="Invalid topics")
            topics = [parse_enum(item, Topic, "topics") for item in topics_raw]
            if Topic.RANDOM in topics:
                topics = [t for t in Topic if t != Topic.RANDOM]
        elif topic_raw is not None:
            topic = parse_enum(topic_raw, Topic, "topic")
            topics = [topic]

    topics = list(dict.fromkeys(topics)) if topics else None
    difficulty_raw = body.get("difficulty")
    difficulty = parse_enum(difficulty_raw, Difficulty, "difficulty") if difficulty_raw else None

    size = body.get("size")
    limit = body.get("limit")
    if size is None and limit is not None:
        size = limit
    if size is not None:
        if not isinstance(size, int) or size <= 0:
            raise HTTPException(status_code=400, detail="Invalid size")

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
                    question_map = {str(q.id): q for q in questions}
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
            topic = topics[0] if topics else None
            response = await service.generate_mistakes_review(
                user_id=user.id,
                topic=topic,
                difficulty=difficulty,
                limit=size,
            )
            question_ids = [str(item.id) for item in response.questions]
            topic_value = "random"
            meta = None
            if topics:
                if len(topics) == 1:
                    topic_value = topics[0].value
                else:
                    topic_value = "mix"
                    meta = {"topics": [item.value for item in topics]}
            if meta is None:
                meta = {}
            meta["questions"] = question_ids
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
                        "started_at": existing.started_at or datetime.utcnow(),
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
                        "started_at": datetime.utcnow(),
                    }
                )
            response.attempt_id = attempt.id
            return response
        if difficulty is None:
            raise HTTPException(status_code=400, detail="Missing difficulty")
        response = await service.generate_quiz(
            topics=topics,
            difficulty=difficulty,
            mode=mode,
            size=size,
        )
        attempt_repo = QuizAttemptRepository(session)
        topic_value = "random"
        meta = None
        if topics:
            if len(topics) == 1:
                topic_value = topics[0].value
            else:
                topic_value = "mix"
                meta = {"topics": [item.value for item in topics]}
        if meta is None:
            meta = {}
        meta["questions"] = [str(item.id) for item in response.questions]
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
                "started_at": datetime.utcnow(),
            }
        )
        response.attempt_id = attempt.id
        return response
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
