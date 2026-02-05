import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.db.base import Base
from app.models.question_candidate import QuestionCandidate
from app.services.question_candidates_service import validate_candidate


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
async def test_schema_fail(async_session):
    candidate = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="mcq",
        payload_json={
            "topic": "python_core",
            "difficulty": "junior",
            "type": "mcq",
            "prompt": "What is 2+2?",
            "answer": "A",
        },
        status="generated",
    )
    async_session.add(candidate)
    await async_session.commit()
    await async_session.refresh(candidate)

    updated = await validate_candidate(async_session, candidate)
    assert updated.status == "failed"
    assert updated.validation_report_json["schema"]["ok"] is False


@pytest.mark.asyncio
async def test_duplicate_fail(async_session):
    payload = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "mcq",
        "prompt": "What is 2+2?",
        "choices": {"A": "4"},
        "correct_answer": "A",
    }
    candidate_ok = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="mcq",
        payload_json=payload,
        status="generated",
    )
    async_session.add(candidate_ok)
    await async_session.commit()
    await async_session.refresh(candidate_ok)
    updated_ok = await validate_candidate(async_session, candidate_ok)
    assert updated_ok.status == "validated"

    candidate_dup = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="mcq",
        payload_json=payload,
        status="generated",
    )
    async_session.add(candidate_dup)
    await async_session.commit()
    await async_session.refresh(candidate_dup)

    updated_dup = await validate_candidate(async_session, candidate_dup)
    assert updated_dup.status == "failed"
    assert updated_dup.validation_report_json["dedupe"]["reason"] == "duplicate_candidate"


@pytest.mark.asyncio
async def test_code_output_pass_and_fail(async_session):
    payload_pass = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "code_output",
        "prompt": "Output?",
        "code": "print(1 + 1)",
        "expected_output": "2",
    }
    candidate_pass = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="code_output",
        payload_json=payload_pass,
        status="generated",
    )
    async_session.add(candidate_pass)
    await async_session.commit()
    await async_session.refresh(candidate_pass)

    updated_pass = await validate_candidate(async_session, candidate_pass)
    assert updated_pass.status == "validated"
    assert updated_pass.validation_report_json["code_output"]["ok"] is True

    payload_fail = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "code_output",
        "prompt": "Output?",
        "code": "print(1 + 1)",
        "expected_output": "3",
    }
    candidate_fail = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="code_output",
        payload_json=payload_fail,
        status="generated",
    )
    async_session.add(candidate_fail)
    await async_session.commit()
    await async_session.refresh(candidate_fail)

    updated_fail = await validate_candidate(async_session, candidate_fail)
    assert updated_fail.status == "failed"
    assert updated_fail.validation_report_json["code_output"]["ok"] is False


@pytest.mark.asyncio
async def test_code_output_timeout(async_session):
    payload_timeout = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "code_output",
        "prompt": "Output?",
        "code": "import time\ntime.sleep(3)",
        "expected_output": "",
    }
    candidate_timeout = QuestionCandidate(
        topic="python_core",
        difficulty="junior",
        type="code_output",
        payload_json=payload_timeout,
        status="generated",
    )
    async_session.add(candidate_timeout)
    await async_session.commit()
    await async_session.refresh(candidate_timeout)

    updated_timeout = await validate_candidate(async_session, candidate_timeout)
    assert updated_timeout.status == "failed"
    assert updated_timeout.validation_report_json["code_output"]["timeout"] is True
