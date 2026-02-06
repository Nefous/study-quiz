from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question


def _apply_filters(
    stmt: Select,
    *,
    topic: str | None,
    difficulty: str | None,
    qtype: str | None,
    query: str | None,
    include_archived: bool,
) -> Select:
    if topic:
        stmt = stmt.where(Question.topic == topic)
    if difficulty:
        stmt = stmt.where(Question.difficulty == difficulty)
    if qtype:
        stmt = stmt.where(Question.type == qtype)
    if query:
        stmt = stmt.where(Question.prompt.ilike(f"%{query}%"))
    if not include_archived:
        stmt = stmt.where(Question.archived_at.is_(None))
    return stmt


async def list_questions(
    session: AsyncSession,
    *,
    topic: str | None,
    difficulty: str | None,
    qtype: str | None,
    query: str | None,
    limit: int,
    offset: int,
    include_archived: bool,
) -> tuple[list[Question], int]:
    base = select(Question)
    filtered = _apply_filters(
        base,
        topic=topic,
        difficulty=difficulty,
        qtype=qtype,
        query=query,
        include_archived=include_archived,
    )
    filtered = filtered.order_by(Question.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(filtered)

    count_stmt = _apply_filters(
        select(func.count(Question.id)),
        topic=topic,
        difficulty=difficulty,
        qtype=qtype,
        query=query,
        include_archived=include_archived,
    )
    total = int((await session.execute(count_stmt)).scalar_one())
    return result.scalars().all(), total


async def get_question(session: AsyncSession, question_id) -> Question | None:
    return await session.get(Question, question_id)


async def archive_question(session: AsyncSession, question: Question) -> Question:
    if question.archived_at is None:
        question.archived_at = datetime.utcnow()
        await session.commit()
        await session.refresh(question)
    return question
