from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cached
from app.core.config import get_settings
from app.schemas.meta import MetaResponse, QuestionOptionsResponse
from app.utils.enums import QuizMode
from app.db.session import get_session
from app.models.question import Question

router = APIRouter(tags=["meta"])

META_CACHE_KEY = "quizstudy:meta"
META_CACHE_TTL = 300 


@router.get("/meta", response_model=MetaResponse)
async def get_meta(session: AsyncSession = Depends(get_session)) -> MetaResponse:
    settings = get_settings()

    async def _fetch() -> dict:
        topics = ["python_core", "big_o", "sql", "algorithms", "data_structures"]
        difficulties = ["junior", "middle"]
        try:
            topics_result = await session.execute(select(Question.topic).distinct())
            db_topics = sorted({str(row[0]) for row in topics_result.all() if row[0]})
            if db_topics:
                topics = db_topics
            difficulties_result = await session.execute(select(Question.difficulty).distinct())
            db_difficulties = sorted(
                {str(row[0]) for row in difficulties_result.all() if row[0]}
            )
            if db_difficulties:
                difficulties = db_difficulties
        except Exception:
            pass
        return {
            "topics": topics,
            "difficulties": difficulties,
            "modes": [item.value for item in QuizMode],
            "defaultQuizSize": settings.DEFAULT_QUIZ_SIZE,
            "maxQuestionsPerQuiz": settings.MAX_QUESTIONS_PER_QUIZ,
        }

    data = await cached(META_CACHE_KEY, META_CACHE_TTL, _fetch)
    return MetaResponse(**data)


@router.get("/meta/question-options", response_model=QuestionOptionsResponse)
async def get_question_options() -> QuestionOptionsResponse:
    return QuestionOptionsResponse(
        topics=["python_core", "big_o", "algorithms", "data_structures"],
        difficulties=["junior", "middle", "senior"],
        types=["mcq", "code_output"],
    )
