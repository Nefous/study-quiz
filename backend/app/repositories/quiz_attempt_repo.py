from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quiz_attempt import QuizAttempt


class QuizAttemptRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_attempt(self, data: dict) -> QuizAttempt:
        total = int(data.get("total_count", 0) or 0)
        correct = int(data.get("correct_count", 0) or 0)
        score_percent = round((correct / total) * 100) if total else 0
        data = {**data, "score_percent": score_percent}
        attempt = QuizAttempt(**data)
        self.session.add(attempt)
        await self.session.commit()
        await self.session.refresh(attempt)
        return attempt

    async def list_attempts(self, limit: int = 20, offset: int = 0) -> list[QuizAttempt]:
        stmt = select(QuizAttempt).order_by(desc(QuizAttempt.created_at)).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def stats(self) -> dict:
        totals_stmt = select(
            func.count(QuizAttempt.id),
            func.avg(QuizAttempt.score_percent),
            func.max(QuizAttempt.score_percent),
            func.max(QuizAttempt.created_at),
        )
        totals_result = await self.session.execute(totals_stmt)
        total_attempts, avg_score, best_score, last_attempt_at = totals_result.one()

        by_topic_stmt = (
            select(
                QuizAttempt.topic,
                func.count(QuizAttempt.id),
                func.avg(QuizAttempt.score_percent),
            )
            .group_by(QuizAttempt.topic)
            .order_by(func.count(QuizAttempt.id).desc())
        )
        by_topic_result = await self.session.execute(by_topic_stmt)
        by_topic = []
        for topic, attempts, avg_score_topic in by_topic_result.all():
            by_topic.append(
                {
                    "topic": topic,
                    "attempts": int(attempts or 0),
                    "avg_score_percent": int(round(avg_score_topic or 0)),
                }
            )

        return {
            "total_attempts": int(total_attempts or 0),
            "avg_score_percent": int(round(avg_score or 0)),
            "best_score_percent": int(best_score or 0),
            "last_attempt_at": last_attempt_at,
            "by_topic": by_topic,
        }
