from datetime import date, datetime, timedelta, timezone

from sqlalchemy import desc, func, select, type_coerce
from sqlalchemy.dialects.postgresql import ARRAY, DATE
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

    async def update_attempt(self, attempt: QuizAttempt, data: dict) -> QuizAttempt:
        total = int(data.get("total_count", 0) or 0)
        correct = int(data.get("correct_count", 0) or 0)
        score_percent = round((correct / total) * 100) if total else 0
        for key, value in data.items():
            setattr(attempt, key, value)
        attempt.score_percent = score_percent
        await self.session.commit()
        await self.session.refresh(attempt)
        return attempt

    async def list_attempts(
        self,
        user_id,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[QuizAttempt], int]:
        base = (
            select(QuizAttempt)
            .where(QuizAttempt.user_id == user_id)
            .where(QuizAttempt.submitted_at.is_not(None))
        )
        count_result = await self.session.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = int(count_result.scalar_one())
        stmt = base.order_by(desc(QuizAttempt.created_at)).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def get_by_id(self, attempt_id) -> QuizAttempt | None:
        stmt = select(QuizAttempt).where(QuizAttempt.id == attempt_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_in_progress_attempt(
        self,
        user_id,
        attempt_type: str,
    ) -> QuizAttempt | None:
        stmt = (
            select(QuizAttempt)
            .where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.attempt_type == attempt_type,
                QuizAttempt.finished_at.is_(None),
            )
            .order_by(desc(QuizAttempt.created_at))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def set_ai_review(self, attempt_id, review_json: dict) -> QuizAttempt | None:
        attempt = await self.get_by_id(attempt_id)
        if not attempt:
            return None
        attempt.ai_review_json = review_json
        attempt.ai_review_created_at = func.now()
        await self.session.commit()
        await self.session.refresh(attempt)
        return attempt

    async def stats(
        self,
        user_id,
        topics: list[str] | None = None,
        mode: str | None = None,
        date_from=None,
        date_to=None,
    ) -> dict:
        filters = [
            QuizAttempt.user_id == user_id,
            QuizAttempt.submitted_at.is_not(None),
        ]
        if topics:
            filters.append(QuizAttempt.topic.in_(topics))
        if mode:
            filters.append(QuizAttempt.mode == mode)
        if date_from is not None:
            filters.append(QuizAttempt.created_at >= date_from)
        if date_to is not None:
            filters.append(QuizAttempt.created_at <= date_to)

        totals_stmt = select(
            func.count(QuizAttempt.id),
            func.avg(QuizAttempt.score_percent),
            func.max(QuizAttempt.score_percent),
            func.max(QuizAttempt.created_at),
            type_coerce(
                func.array_agg(func.distinct(func.date(QuizAttempt.created_at))),
                ARRAY(DATE),
            ),
        ).where(*filters)
        totals_result = await self.session.execute(totals_stmt)
        total_attempts, avg_score, best_score, last_attempt_at, all_dates = (
            totals_result.one()
        )

        attempts_stmt = (
            select(QuizAttempt.topic, QuizAttempt.score_percent, QuizAttempt.meta)
            .where(*filters)
        )
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

        recent_stmt = (
            select(QuizAttempt.score_percent, QuizAttempt.created_at, QuizAttempt.mode)
            .where(*filters)
            .order_by(desc(QuizAttempt.created_at), desc(QuizAttempt.id))
            .limit(20)
        )
        recent_result = await self.session.execute(recent_stmt)
        recent_rows = recent_result.all()
        recent_attempts = [
            {
                "score_percent": int(score or 0),
                "created_at": created_at,
                "mode": mode,
            }
            for score, created_at, mode in recent_rows
        ]
        recent_attempts.reverse()
        recent_scores = [item["score_percent"] for item in recent_attempts]

        attempt_dates: set[date] = set()
        if all_dates:
            attempt_dates = {d for d in all_dates if d is not None}
        current_streak = 0
        if attempt_dates:
            today = datetime.now(timezone.utc).date()
            cursor = max(attempt_dates)
            if cursor < today - timedelta(days=1):
                current_streak = 0
            else:
                while cursor in attempt_dates:
                    current_streak += 1
                    cursor = cursor - timedelta(days=1)

        eligible_topics = [item for item in by_topic if item["attempts"] >= 5]
        strongest_topic = None
        weakest_topic = None
        if eligible_topics:
            strongest_topic = max(
                eligible_topics, key=lambda item: item["avg_score_percent"]
            )["topic"]
            weakest_topic = min(
                eligible_topics, key=lambda item: item["avg_score_percent"]
            )["topic"]

        return {
            "total_attempts": int(total_attempts or 0),
            "avg_score_percent": int(round(avg_score or 0)),
            "best_score_percent": int(best_score or 0),
            "last_attempt_at": last_attempt_at,
            "by_topic": by_topic,
            "current_streak_days": current_streak,
            "strongest_topic": strongest_topic,
            "weakest_topic": weakest_topic,
            "recent_scores": recent_scores,
            "recent_attempts": recent_attempts,
        }
