from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.schemas.question import QuestionCreateInternal
from app.utils.enums import Difficulty, QuestionType, Topic
class QuestionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_questions(self) -> list[Question]:
        result = await self.session.execute(select(Question))
        return result.scalars().all()

    async def list_questions_filtered(
        self,
        topic: Topic | None = None,
        difficulty: Difficulty | None = None,
        qtype: QuestionType | None = None,
        limit: int | None = None,
    ) -> list[Question]:
        stmt = select(Question)
        if topic is not None:
            stmt = stmt.where(Question.topic == topic)
        if difficulty is not None:
            stmt = stmt.where(Question.difficulty == difficulty)
        if qtype is not None:
            stmt = stmt.where(Question.type == qtype)

        if limit is not None:
            stmt = stmt.limit(limit)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_questions(
        self,
        topic: Topic | None = None,
        difficulty: Difficulty | None = None,
        qtype: QuestionType | None = None,
    ) -> int:
        stmt = select(func.count(Question.id))
        if topic is not None:
            stmt = stmt.where(Question.topic == topic)
        if difficulty is not None:
            stmt = stmt.where(Question.difficulty == difficulty)
        if qtype is not None:
            stmt = stmt.where(Question.type == qtype)

        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def get_random_questions(
        self,
        topic: Topic | None,
        difficulty: Difficulty | None,
        qtype: QuestionType | None,
        limit: int,
    ) -> list[Question]:
        stmt = select(Question)
        if topic is not None:
            stmt = stmt.where(Question.topic == topic)
        if difficulty is not None:
            stmt = stmt.where(Question.difficulty == difficulty)
        if qtype is not None:
            stmt = stmt.where(Question.type == qtype)

        stmt = stmt.order_by(func.random()).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def bulk_insert_questions(self, items: list[QuestionCreateInternal]) -> None:
        payload = [item.model_dump(exclude_none=True) for item in items]
        await self.session.execute(insert(Question), payload)
        await self.session.commit()
