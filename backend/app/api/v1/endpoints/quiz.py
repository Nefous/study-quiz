from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.quiz import QuizGenerateRequest, QuizGenerateResponse
from app.services.quiz_service import QuizService
from app.utils.enums import Difficulty, QuizMode, Topic

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
    session: AsyncSession = Depends(get_session),
) -> QuizGenerateResponse:
    if "difficulty" not in body or "mode" not in body:
        raise HTTPException(status_code=400, detail="Missing difficulty/mode")

    topic_raw = body.get("topic")
    topics_raw = body.get("topics")
    topics: list[Topic] | None = None

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

    topics = list(dict.fromkeys(topics)) if topics else None
    difficulty = parse_enum(body.get("difficulty"), Difficulty, "difficulty")
    mode = parse_enum(body.get("mode"), QuizMode, "mode")

    size = body.get("size")
    if size is not None:
        if not isinstance(size, int) or size <= 0:
            raise HTTPException(status_code=400, detail="Invalid size")

    payload = QuizGenerateRequest(
        topic=None,
        topics=topics,
        difficulty=difficulty,
        mode=mode,
        size=size,
    )

    service = QuizService(session)
    try:
        return await service.generate_quiz(
            topics=payload.topics,
            difficulty=payload.difficulty,
            mode=payload.mode,
            size=payload.size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
