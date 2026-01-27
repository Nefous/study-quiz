from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hint_usage import HintUsage


class HintUsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_usage(
        self,
        attempt_id: UUID | None,
        question_id: UUID,
        level: int,
        penalty_points: int,
    ) -> HintUsage:
        usage = HintUsage(
            attempt_id=attempt_id,
            question_id=question_id,
            level=level,
            penalty_points=penalty_points,
        )
        self.session.add(usage)
        await self.session.commit()
        await self.session.refresh(usage)
        return usage
