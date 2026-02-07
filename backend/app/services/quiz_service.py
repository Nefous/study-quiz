import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
import random

from app.repositories.question_repo import QuestionRepository
from app.repositories.attempt_answer_repo import AttemptAnswerRepository
from app.schemas.quiz import QuizGenerateResponse, QuizQuestionOut
from app.utils.enums import Difficulty, QuizMode, Topic


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
                item.explanation = None
            quiz_questions.append(item)
        return QuizGenerateResponse(quiz_id=uuid.uuid4(), questions=quiz_questions)

    async def generate_mistakes_review(
        self,
        user_id,
        topic: Topic | None,
        difficulty: Difficulty | None,
        limit: int | None,
    ) -> QuizGenerateResponse:
        repo = QuestionRepository(self.session)
        answer_repo = AttemptAnswerRepository(self.session)
        requested_size = limit or self.settings.DEFAULT_QUIZ_SIZE
        requested_size = min(requested_size, self.settings.MAX_QUESTIONS_PER_QUIZ)

        wrong_counts = await answer_repo.wrong_question_frequencies(
            user_id=user_id,
            topic=topic,
            difficulty=difficulty,
        )

        picked_ids: list[uuid.UUID] = []
        if wrong_counts:
            ids = [item[0] for item in wrong_counts]
            weights = [item[1] or 1 for item in wrong_counts]
            seen = set()
            attempts = 0
            while len(picked_ids) < min(requested_size, len(ids)) and attempts < 500:
                attempts += 1
                choice = random.choices(ids, weights=weights, k=1)[0]
                if choice in seen:
                    continue
                seen.add(choice)
                picked_ids.append(choice)

        if not picked_ids:
            available = await repo.count_questions(
                topic=topic,
                difficulty=difficulty,
            )
            if available < requested_size:
                raise ValueError("Not enough questions for the requested filter")
            picked = await repo.get_random_questions(
                topic=topic,
                topics=[topic] if topic else None,
                difficulty=difficulty,
                qtype=None,
                limit=requested_size,
            )
        else:
            picked = await repo.get_by_ids(picked_ids)

        quiz_questions: list[QuizQuestionOut] = []
        for q in picked:
            item = QuizQuestionOut.model_validate(q)
            quiz_questions.append(item)
        return QuizGenerateResponse(quiz_id=uuid.uuid4(), questions=quiz_questions)