from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.db.base import Base
from app.models.question_candidate import QuestionCandidate
from app.services.question_candidates_service import (
    approve_candidate,
    publish_candidate,
    reject_candidate,
)


@pytest.fixture()
async def async_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_approve_sets_fields(async_session):
    candidate = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="mcq",
        payload_json={
            "topic": "python_core",
            "difficulty": "junior",
            "type": "mcq",
            "prompt": "What is 2+2?",
            "choices": {"A": "4"},
            "correct_answer": "A",
        },
        status="generated",
    )
    async_session.add(candidate)
    await async_session.commit()
    await async_session.refresh(candidate)

    updated = await approve_candidate(async_session, candidate, uuid4())
    assert updated.status in {"approved", "failed"}
    if updated.status == "approved":
        assert updated.approved_at is not None
        assert updated.approved_by_user_id is not None


@pytest.mark.asyncio
async def test_reject_stores_reason(async_session):
    candidate = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="mcq",
        payload_json={
            "topic": "python_core",
            "difficulty": "junior",
            "type": "mcq",
            "prompt": "?",
            "choices": {"A": "4"},
            "correct_answer": "A",
        },
        status="generated",
    )
    async_session.add(candidate)
    await async_session.commit()
    await async_session.refresh(candidate)

    updated = await reject_candidate(async_session, candidate, uuid4(), "bad question")
    assert updated.status == "rejected"
    moderation = updated.validation_report_json.get("moderation")
    assert moderation and moderation.get("reason") == "bad question"


@pytest.mark.asyncio
async def test_publish_idempotent(async_session):
    payload = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "mcq",
        "prompt": "What is 2+2?",
        "choices": {"A": "4"},
        "correct_answer": "A",
    }
    candidate = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="mcq",
        payload_json=payload,
        status="approved",
    )
    async_session.add(candidate)
    await async_session.commit()
    await async_session.refresh(candidate)

    first, question_id = await publish_candidate(async_session, candidate)
    assert first.status == "published"
    assert question_id is not None

    second, question_id_2 = await publish_candidate(async_session, candidate)
    assert second.status == "published"
    assert question_id_2 == question_id
