import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.repositories.question_repo import QuestionRepository
from app.schemas.quiz import QuizGenerateResponse, QuizQuestionOut
from app.utils.enums import Difficulty, QuestionType, QuizMode, Topic


class QuizService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()

    async def generate_quiz(
        self,
        topics: list[Topic] | None,
        difficulty: Difficulty,
        mode: QuizMode,
        size: int | None,
    ) -> QuizGenerateResponse:
        repo = QuestionRepository(self.session)
        requested_size = size or self.settings.DEFAULT_QUIZ_SIZE
        requested_size = min(requested_size, self.settings.MAX_QUESTIONS_PER_QUIZ)

        available = await repo.count_questions(
            topics=topics or None,
            difficulty=difficulty,
        )
        if available < requested_size:
            raise ValueError("Not enough questions for the requested filter")

        picked = await repo.get_random_questions(
            topic=None,
            topics=topics or None,
            difficulty=difficulty,
            qtype=None,
            limit=requested_size,
        )
        quiz_questions: list[QuizQuestionOut] = []
        for q in picked:
            item = QuizQuestionOut.model_validate(q)
            if mode == QuizMode.EXAM:
                item.correct_answer = None
                item.explanation = None
            quiz_questions.append(item)
        return QuizGenerateResponse(quiz_id=uuid.uuid4(), questions=quiz_questions)