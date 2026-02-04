from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.endpoints import attempts as attempts_module
from app.db.session import get_session
from app.services.auth_service import get_current_user


class FakeUser:
    def __init__(self, user_id: UUID) -> None:
        self.id = user_id


class FakeAttempt:
    def __init__(
        self,
        attempt_id: UUID,
        user_id: UUID,
        topic: str,
        mode: str = "practice",
        attempt_type: str = "normal",
        meta: dict | None = None,
    ) -> None:
        self.id = attempt_id
        self.user_id = user_id
        self.topic = topic
        self.difficulty = "junior"
        self.mode = mode
        self.attempt_type = attempt_type
        self.size = 2
        self.correct_count = 0
        self.total_count = 2
        self.score_percent = 0
        self.answers = []
        self.meta = meta or {}
        self.started_at = None
        self.finished_at = None
        self.submitted_at = None
        self.time_limit_seconds = None
        self.time_spent_seconds = None
        self.timed_out = None
        self.created_at = None


class FakeAttemptRepo:
    def __init__(self, attempt: FakeAttempt) -> None:
        self.attempt = attempt

    async def get_by_id(self, attempt_id: UUID):
        if str(attempt_id) != str(self.attempt.id):
            return None
        return self.attempt

    async def update_attempt(self, attempt: FakeAttempt, data: dict):
        for key, value in data.items():
            setattr(attempt, key, value)
        return attempt


class FakeAnswerRepo:
    async def replace_for_attempt(self, attempt_id: UUID, user_id: UUID, answers: list[dict]):
        return None


def configure_dependencies(monkeypatch: pytest.MonkeyPatch, attempt: FakeAttempt) -> None:
    fake_repo = FakeAttemptRepo(attempt)
    monkeypatch.setattr(attempts_module, "QuizAttemptRepository", lambda session: fake_repo)
    monkeypatch.setattr(attempts_module, "AttemptAnswerRepository", lambda session: FakeAnswerRepo())

    user = FakeUser(attempt.user_id)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: None


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides = {}


def test_submit_without_topic_uses_attempt_topic(monkeypatch: pytest.MonkeyPatch):
    attempt_id = uuid4()
    user_id = uuid4()
    question_id = uuid4()
    attempt = FakeAttempt(
        attempt_id=attempt_id,
        user_id=user_id,
        topic="python_core",
        meta={"questions": [str(question_id)]},
    )

    configure_dependencies(monkeypatch, attempt)

    payload = {
        "difficulty": "junior",
        "mode": "practice",
        "attempt_type": "normal",
        "size": 2,
        "correct_count": 1,
        "total_count": 2,
        "answers": [
            {"question_id": str(question_id), "selected_answer": "A", "is_correct": True}
        ],
        "finished_at": "2026-02-04T00:00:00Z",
        "time_spent_seconds": 12,
        "timed_out": False,
    }

    with TestClient(app) as client:
        response = client.post(f"/api/v1/attempts/{attempt_id}/submit", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["topic"] == "python_core"
    assert data["submitted_at"] is not None
