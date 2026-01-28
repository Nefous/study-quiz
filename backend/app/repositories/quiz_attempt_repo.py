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

        attempts_stmt = select(QuizAttempt.topic, QuizAttempt.score_percent, QuizAttempt.meta)
        attempts_result = await self.session.execute(attempts_stmt)
        bucket: dict[str, dict[str, int]] = {}
        for topic, score_percent, meta in attempts_result.all():
            meta_topics = []
            if topic == "mix" and isinstance(meta, dict):
                meta_topics = meta.get("topics") or []

            if topic == "mix" and meta_topics:
                for item in meta_topics:
                    if not item or item == "random":
                        continue
                    bucket.setdefault(item, {"attempts": 0, "score_sum": 0})
                    bucket[item]["attempts"] += 1
                    bucket[item]["score_sum"] += int(score_percent or 0)
                continue

            if not topic or topic == "mix":
                continue

            bucket.setdefault(topic, {"attempts": 0, "score_sum": 0})
            bucket[topic]["attempts"] += 1
            bucket[topic]["score_sum"] += int(score_percent or 0)

        by_topic = []
        for topic, stats in bucket.items():
            attempts = stats["attempts"]
            score_sum = stats["score_sum"]
            avg_score_topic = int(round(score_sum / attempts)) if attempts else 0
            by_topic.append(
                {
                    "topic": topic,
                    "attempts": attempts,
                    "avg_score_percent": avg_score_topic,
                }
            )

        by_topic.sort(key=lambda item: item["attempts"], reverse=True)

        return {
            "total_attempts": int(total_attempts or 0),
            "avg_score_percent": int(round(avg_score or 0)),
            "best_score_percent": int(best_score or 0),
            "last_attempt_at": last_attempt_at,
            "by_topic": by_topic,
        }
