from uuid import UUID

from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_recommendation import AiRecommendation


class AiRecommendationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_active(self, user_id: UUID) -> AiRecommendation | None:
        stmt = select(AiRecommendation).where(
            AiRecommendation.user_id == user_id,
            AiRecommendation.status == "active",
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, recommendation_id: UUID) -> AiRecommendation | None:
        stmt = select(AiRecommendation).where(AiRecommendation.id == recommendation_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def complete_active(self, user_id: UUID) -> None:
        stmt = (
            update(AiRecommendation)
            .where(
                AiRecommendation.user_id == user_id,
                AiRecommendation.status == "active",
            )
            .values(status="completed")
        )
        await self.session.execute(stmt)
        await self.session.commit()

    async def create_active(
        self,
        user_id: UUID,
        topic: str,
        difficulty: str,
        size: int,
        tips_json: dict | None,
    ) -> AiRecommendation:
        await self.complete_active(user_id)
        recommendation = AiRecommendation(
            user_id=user_id,
            topic=topic,
            difficulty=difficulty,
            size=size,
            tips_json=tips_json,
            status="active",
        )
        self.session.add(recommendation)
        await self.session.commit()
        await self.session.refresh(recommendation)
        return recommendation

    async def set_attempt_id(self, recommendation_id: UUID, attempt_id: UUID) -> None:
        stmt = (
            update(AiRecommendation)
            .where(AiRecommendation.id == recommendation_id)
            .values(attempt_id=attempt_id)
        )
        await self.session.execute(stmt)
        await self.session.commit()

    async def complete_by_attempt(self, user_id: UUID, attempt_id: UUID) -> bool:
        stmt = (
            update(AiRecommendation)
            .where(
                AiRecommendation.user_id == user_id,
                AiRecommendation.status == "active",
                AiRecommendation.attempt_id == attempt_id,
            )
            .values(status="completed")
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return (result.rowcount or 0) > 0
