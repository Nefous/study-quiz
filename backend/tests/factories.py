from __future__ import annotations

import hashlib
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.user import User


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    password_hash: str | None,
    is_admin: bool = False,
    role: str | None = None,
) -> User:
    user = User(
        email=email,
        password_hash=password_hash,
        is_admin=is_admin,
        role=role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def create_question(
    session: AsyncSession,
    *,
    topic: str = "python_core",
    difficulty: str = "junior",
    qtype: str = "mcq",
    prompt: str | None = None,
    code: str | None = None,
    choices: dict[str, str] | None = None,
    correct_answer: str | None = None,
    explanation: str | None = None,
) -> Question:
    prompt_value = prompt or f"Question {uuid4().hex}"
    if qtype == "mcq":
        choices = choices or {"A": "4", "B": "5", "C": "3", "D": "6"}
        correct_answer = correct_answer or "A"
    else:
        correct_answer = correct_answer or "4"

    seed_payload = f"{topic}|{difficulty}|{qtype}|{prompt_value}|{code or ''}"
    seed_key = hashlib.sha256(seed_payload.encode("utf-8")).hexdigest()[:64]

    question = Question(
        seed_key=seed_key,
        topic=topic,
        difficulty=difficulty,
        type=qtype,
        prompt=prompt_value,
        code=code,
        choices=choices,
        correct_answer=correct_answer,
        explanation=explanation,
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)
    return question
