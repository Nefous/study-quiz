from uuid import UUID
from sqlalchemy import func, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.schemas.question import QuestionCreateInternal
from app.utils.enums import Difficulty, QuestionType, Topic


def _as_str(value: str | Difficulty | QuestionType | Topic) -> str:
    return value.value if hasattr(value, "value") else value
class QuestionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_questions(self) -> list[Question]:
        result = await self.session.execute(select(Question))
        return result.scalars().all()

    async def get_question_by_id(self, question_id) -> Question | None:
        result = await self.session.execute(
            select(Question).where(Question.id == question_id)
        )
        return result.scalars().first()

    async def list_questions_filtered(
        self,
        topic: Topic | None = None,
        topics: list[Topic] | None = None,
        difficulty: Difficulty | None = None,
        qtype: QuestionType | None = None,
        limit: int | None = None,
    ) -> list[Question]:
        stmt = select(Question)
        if topics:
            stmt = stmt.where(Question.topic.in_(topics))
        elif topic is not None:
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
        topics: list[Topic] | None = None,
        difficulty: Difficulty | None = None,
        qtype: QuestionType | None = None,
    ) -> int:
        stmt = select(func.count(Question.id))
        if topics:
            stmt = stmt.where(Question.topic.in_(topics))
        elif topic is not None:
            stmt = stmt.where(Question.topic == topic)
        if difficulty is not None:
            stmt = stmt.where(Question.difficulty == difficulty)
        if qtype is not None:
            stmt = stmt.where(Question.type == qtype)

        result = await self.session.execute(stmt)
        return int(result.scalar_one())
    
    async def get_by_id(self, question_id: UUID) -> Question | None:
        return await self.session.get(Question, question_id)

    async def get_by_ids(self, question_ids: list[UUID]) -> list[Question]:
        if not question_ids:
            return []
        result = await self.session.execute(
            select(Question).where(Question.id.in_(question_ids))
        )
        return result.scalars().all()
    
    async def get_random_questions(
        self,
        topic: Topic | None,
        topics: list[Topic] | None,
        difficulty: Difficulty | None,
        qtype: QuestionType | None,
        limit: int,
    ) -> list[Question]:
        stmt = select(Question)
        if topics:
            stmt = stmt.where(Question.topic.in_(topics))
        elif topic is not None:
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

    async def upsert_questions_by_seed_key(self, items: list[QuestionCreateInternal]) -> int:
        if not items:
            return 0

        rows: list[dict[str, object]] = []
        for item in items:
            data = item.model_dump(exclude_none=True)
            rows.append(
                {
                    "seed_key": data["seed_key"],
                    "topic": _as_str(data["topic"]),
                    "difficulty": _as_str(data["difficulty"]),
                    "type": _as_str(data["type"]),
                    "prompt": data["prompt"],
                    "choices": data.get("choices") or None,
                    "correct_answer": data["correct_answer"],
                    "explanation": data.get("explanation"),
                }
            )

        stmt = pg_insert(Question).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=[Question.seed_key],
            set_={
                "topic": stmt.excluded.topic,
                "difficulty": stmt.excluded.difficulty,
                "type": stmt.excluded.type,
                "prompt": stmt.excluded.prompt,
                "choices": stmt.excluded.choices,
                "correct_answer": stmt.excluded.correct_answer,
                "explanation": stmt.excluded.explanation,
                "updated_at": func.now(),
            },
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return int(result.rowcount or 0)
