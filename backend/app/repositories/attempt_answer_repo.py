from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt_answer import AttemptAnswer
from app.models.question import Question
from app.utils.enums import Difficulty, Topic


class AttemptAnswerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def replace_for_attempt(
        self,
        attempt_id: UUID,
        user_id: UUID,
        answers: list[dict],
    ) -> None:
        await self.session.execute(
            delete(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
        )
        rows = []
        for item in answers:
            question_id = item.get("question_id")
            if not question_id:
                continue
            rows.append(
                {
                    "attempt_id": attempt_id,
                    "user_id": user_id,
                    "question_id": UUID(str(question_id)),
                    "is_correct": bool(item.get("is_correct", False)),
                    "selected_answer": item.get("selected_answer")
                    or item.get("user_answer")
                    or None,
                }
            )
        if rows:
            await self.session.execute(AttemptAnswer.__table__.insert(), rows)
        await self.session.commit()

    async def list_for_attempt(
        self,
        attempt_id: UUID,
        user_id: UUID,
    ) -> list[AttemptAnswer]:
        stmt = select(AttemptAnswer).where(
            AttemptAnswer.attempt_id == attempt_id,
            AttemptAnswer.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def mistake_stats(self, user_id: UUID) -> dict:
        latest_subq = (
            select(
                AttemptAnswer.question_id,
                AttemptAnswer.is_correct,
                AttemptAnswer.created_at,
                func.row_number()
                .over(
                    partition_by=AttemptAnswer.question_id,
                    order_by=AttemptAnswer.created_at.desc(),
                )
                .label("rn"),
            )
            .where(AttemptAnswer.user_id == user_id)
            .subquery()
        )

        total_wrong_stmt = select(func.count()).where(
            latest_subq.c.rn == 1,
            latest_subq.c.is_correct.is_(False),
        )
        total_wrong = (await self.session.execute(total_wrong_stmt)).scalar_one() or 0

        unique_wrong = total_wrong

        since = datetime.now(timezone.utc) - timedelta(days=30)
        recent_wrong_stmt = select(func.count()).where(
            latest_subq.c.rn == 1,
            latest_subq.c.is_correct.is_(False),
            latest_subq.c.created_at >= since,
        )
        recent_wrong = (await self.session.execute(recent_wrong_stmt)).scalar_one() or 0

        recent_unique = recent_wrong

        return {
            "total_wrong": int(total_wrong),
            "unique_wrong_questions": int(unique_wrong),
            "last_30_days_wrong": int(recent_wrong),
            "last_30_days_unique": int(recent_unique),
        }

    async def wrong_question_frequencies(
        self,
        user_id: UUID,
        topic: Topic | None = None,
        difficulty: Difficulty | None = None,
        days: int = 30,
    ) -> list[tuple[UUID, int]]:
        since = datetime.now(timezone.utc) - timedelta(days=days)

        latest_subq = (
            select(
                AttemptAnswer.question_id,
                AttemptAnswer.is_correct,
                func.row_number()
                .over(
                    partition_by=AttemptAnswer.question_id,
                    order_by=AttemptAnswer.created_at.desc(),
                )
                .label("rn"),
            )
            .where(
                AttemptAnswer.user_id == user_id,
                AttemptAnswer.created_at >= since,
            )
            .subquery()
        )

        still_wrong = (
            select(latest_subq.c.question_id)
            .where(
                latest_subq.c.rn == 1,
                latest_subq.c.is_correct.is_(False),
            )
        )

        stmt = (
            select(
                AttemptAnswer.question_id,
                func.count().label("wrong_count"),
            )
            .where(
                AttemptAnswer.user_id == user_id,
                AttemptAnswer.is_correct.is_(False),
                AttemptAnswer.created_at >= since,
                AttemptAnswer.question_id.in_(still_wrong),
            )
            .group_by(AttemptAnswer.question_id)
        )
        if topic is not None or difficulty is not None:
            stmt = stmt.join(Question, Question.id == AttemptAnswer.question_id)
            if topic is not None:
                stmt = stmt.where(Question.topic == topic)
            if difficulty is not None:
                stmt = stmt.where(Question.difficulty == difficulty)
        result = await self.session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]
