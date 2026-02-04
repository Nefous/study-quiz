from fastapi import APIRouter, Depends, HTTPException, Query
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.repositories.question_favorite_repo import QuestionFavoriteRepository
from app.repositories.question_repo import QuestionRepository
from app.schemas.question import QuestionOut
from app.utils.enums import Difficulty, QuestionType, Topic
from app.services.auth_service import get_current_user

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


@router.get("/favorites", response_model=list[QuestionOut])
async def list_favorite_questions(
    topic: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[QuestionOut]:
    repo = QuestionFavoriteRepository(session)
    topic_enum = parse_enum(topic, Topic, "topic") if topic else None
    difficulty_enum = parse_enum(difficulty, Difficulty, "difficulty") if difficulty else None

    favorites = await repo.list_favorites(
        user_id=user.id,
        topic=topic_enum,
        difficulty=difficulty_enum,
        limit=limit,
        offset=offset,
    )
    return [QuestionOut.model_validate(q) for q in favorites]


@router.post("/{question_id}/favorite")
async def favorite_question(
    question_id: UUID,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    question_repo = QuestionRepository(session)
    question = await question_repo.get_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    repo = QuestionFavoriteRepository(session)
    await repo.add_favorite(user.id, question_id)
    return {"ok": True}


@router.delete("/{question_id}/favorite")
async def unfavorite_question(
    question_id: UUID,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = QuestionFavoriteRepository(session)
    await repo.remove_favorite(user.id, question_id)
    return {"ok": True}


