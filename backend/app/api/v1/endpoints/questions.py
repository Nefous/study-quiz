from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.integrations.hint_chain import generate_hint
from app.repositories.question_repo import QuestionRepository
from app.schemas.hint import HintRequest, HintResponse
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


@router.post("/{question_id}/hint", response_model=HintResponse)
async def generate_question_hint(
    question_id: UUID,
    payload: HintRequest,
    session: AsyncSession = Depends(get_session),
) -> HintResponse:
    settings = get_settings()
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI hints not configured")

    repo = QuestionRepository(session)
    question = await repo.get_question_by_id(question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    choices_text = ""
    if question.type == QuestionType.MCQ and question.choices:
        choices_text = "\n".join(
            [f"{key}) {value}" for key, value in question.choices.items()]
        )

    hint_payload = {
        "question_prompt": question.prompt,
        "question_type": question.type.value,
        "choices_text": choices_text or "(none)",
        "user_answer": payload.user_answer or "(none)",
        "level": payload.level,
    }

    hint = await generate_hint(hint_payload)
    return HintResponse(hint=hint)
