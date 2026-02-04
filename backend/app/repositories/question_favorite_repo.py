from uuid import UUID

from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.question import Question
from app.models.question_favorite import QuestionFavorite
from app.utils.enums import Difficulty, Topic


class QuestionFavoriteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add_favorite(self, user_id: UUID, question_id: UUID) -> bool:
        stmt = (
            pg_insert(QuestionFavorite)
            .values(user_id=user_id, question_id=question_id)
            .on_conflict_do_nothing(
                index_elements=[QuestionFavorite.user_id, QuestionFavorite.question_id]
            )
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return (result.rowcount or 0) > 0

    async def remove_favorite(self, user_id: UUID, question_id: UUID) -> bool:
        stmt = delete(QuestionFavorite).where(
            QuestionFavorite.user_id == user_id,
            QuestionFavorite.question_id == question_id,
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return (result.rowcount or 0) > 0

    async def list_favorites(
        self,
        user_id: UUID,
        topic: Topic | None = None,
        difficulty: Difficulty | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Question]:
        stmt = (
            select(Question)
            .join(QuestionFavorite, QuestionFavorite.question_id == Question.id)
            .where(QuestionFavorite.user_id == user_id)
        )
        if topic is not None:
            stmt = stmt.where(Question.topic == topic)
        if difficulty is not None:
            stmt = stmt.where(Question.difficulty == difficulty)

        stmt = (
            stmt.order_by(desc(QuestionFavorite.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
