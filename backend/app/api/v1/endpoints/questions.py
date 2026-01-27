from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.repositories.question_repo import QuestionRepository
from app.schemas.question import QuestionOut
from app.utils.enums import Difficulty, QuestionType, Topic

router = APIRouter()


def parse_enum(value: str, enum_cls, field: str):
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    try:
        return enum_cls(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field}") from exc


@router.get("/", response_model=list[QuestionOut])
async def list_questions(
    topic: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    qtype: str | None = Query(default=None, alias="type"),
    limit: int | None = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[QuestionOut]:
    repo = QuestionRepository(session)
    topic_enum = parse_enum(topic, Topic, "topic") if topic else None
    difficulty_enum = parse_enum(difficulty, Difficulty, "difficulty") if difficulty else None
    type_enum = parse_enum(qtype, QuestionType, "type") if qtype else None

    questions = await repo.list_questions_filtered(
        topic=topic_enum,
        difficulty=difficulty_enum,
        qtype=type_enum,
        limit=limit,
    )
    return [QuestionOut.model_validate(q) for q in questions]


