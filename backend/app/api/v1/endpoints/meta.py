from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.meta import MetaResponse
from app.utils.enums import Difficulty, QuizMode, Topic

router = APIRouter(tags=["meta"])


@router.get("/meta", response_model=MetaResponse)
async def get_meta() -> MetaResponse:
    settings = get_settings()
    return MetaResponse(
        topics=[item.value for item in Topic],
        difficulties=[item.value for item in Difficulty],
        modes=[item.value for item in QuizMode],
        defaultQuizSize=settings.DEFAULT_QUIZ_SIZE,
        maxQuestionsPerQuiz=settings.MAX_QUESTIONS_PER_QUIZ,
    )
