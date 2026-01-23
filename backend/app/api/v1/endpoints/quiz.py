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
    if "topic" not in body or "difficulty" not in body or "mode" not in body:
        raise HTTPException(status_code=400, detail="Missing topic/difficulty/mode")

    topic = parse_enum(body.get("topic"), Topic, "topic")
    difficulty = parse_enum(body.get("difficulty"), Difficulty, "difficulty")
    mode = parse_enum(body.get("mode"), QuizMode, "mode")

    size = body.get("size")
    if size is not None:
        if not isinstance(size, int) or size <= 0:
            raise HTTPException(status_code=400, detail="Invalid size")

    payload = QuizGenerateRequest(
        topic=topic,
        difficulty=difficulty,
        mode=mode,
        size=size,
    )

    service = QuizService(session)
    try:
        return await service.generate_quiz(
            topic=payload.topic,
            difficulty=payload.difficulty,
            mode=payload.mode,
            size=payload.size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
