import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.integrations.hint_chain import generate_hint
from app.repositories.hint_usage_repo import HintUsageRepository
from app.repositories.question_repo import QuestionRepository
from app.repositories.quiz_attempt_repo import QuizAttemptRepository
from app.schemas.hint import HintRequest, HintResponse
from app.utils.enums import QuestionType

router = APIRouter(prefix="/questions", tags=["hints"])
logger = logging.getLogger(__name__)


@router.post("/{question_id}/hint", response_model=HintResponse)
async def hint(
    question_id: UUID,
    body: HintRequest,
    session: AsyncSession = Depends(get_session),
) -> HintResponse:
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI hints not configured")
    
    if body.attempt_id:
        attempt_repo = QuizAttemptRepository(session)
        attempt = await attempt_repo.get_by_id(body.attempt_id)
        if attempt and attempt.mode == "exam":
            raise HTTPException(status_code=403, detail="HINTS_DISABLED_IN_EXAM")

    repo = QuestionRepository(session)
    question = await repo.get_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    choices_text = ""
    if question.type == QuestionType.MCQ and question.choices:
        choices_text = "\n".join(f"{k}) {v}" for k, v in question.choices.items())

    payload = {
        "question_prompt": question.prompt,
        "question_type": question.type,  # Already a string, no .value needed
        "choices_text": choices_text,
        "user_answer": body.user_answer or "",
        "level": body.level,
    }

    hint_text = await generate_hint(payload)

    try:
        penalty_points = int(body.level)
        usage_repo = HintUsageRepository(session)
        await usage_repo.create_usage(
            attempt_id=body.attempt_id,
            question_id=question.id,
            level=body.level,
            penalty_points=penalty_points,
        )
    except Exception:
        logger.exception("Failed to log hint usage")

    return HintResponse(hint=hint_text)