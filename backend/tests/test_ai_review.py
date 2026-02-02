import os
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("GROQ_API_KEY", "test-key")

from app.main import app
from app.api.v1.endpoints import attempts as attempts_module
from app.db.session import get_session
from app.services.auth_service import get_current_user
import app.main as main


class FakeUser:
    def __init__(self, user_id: UUID) -> None:
        self.id = user_id


class FakeAttempt:
    def __init__(
        self,
        attempt_id: UUID,
        user_id: UUID,
        answers: list[dict],
        total_count: int,
        score_percent: int,
        mode: str = "practice",
        ai_review_json: dict | None = None,
    ) -> None:
        self.id = attempt_id
        self.user_id = user_id
        self.answers = answers
        self.total_count = total_count
        self.score_percent = score_percent
        self.mode = mode
        self.ai_review_json = ai_review_json


class FakeQuestion:
    def __init__(
        self,
        question_id: UUID,
        prompt: str,
        correct_answer: str,
        topic: str = "python_core",
        difficulty: str = "junior",
        qtype: str = "mcq",
        choices: dict | None = None,
    ) -> None:
        self.id = question_id
        self.prompt = prompt
        self.correct_answer = correct_answer
        self.topic = topic
        self.difficulty = difficulty
        self.type = qtype
        self.choices = choices


class FakeQuizAttemptRepository:
    def __init__(self, attempt: FakeAttempt) -> None:
        self.attempt = attempt

    async def get_by_id(self, attempt_id: UUID):
        if str(attempt_id) != str(self.attempt.id):
            return None
        return self.attempt

    async def set_ai_review(self, attempt_id: UUID, review_json: dict) -> None:
        if str(attempt_id) != str(self.attempt.id):
            return
        self.attempt.ai_review_json = review_json


class FakeQuestionRepository:
    def __init__(self, questions: dict[str, FakeQuestion]) -> None:
        self.questions = questions

    async def get_by_ids(self, ids: list[UUID]):
        results: list[FakeQuestion] = []
        for item in ids:
            question = self.questions.get(str(item))
            if question:
                results.append(question)
        return results


def configure_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    attempt: FakeAttempt,
    questions: dict[str, FakeQuestion],
    generate_payload: dict | None = None,
) -> None:
    fake_repo = FakeQuizAttemptRepository(attempt)
    fake_question_repo = FakeQuestionRepository(questions)

    monkeypatch.setattr(
        attempts_module, "QuizAttemptRepository", lambda session: fake_repo
    )
    monkeypatch.setattr(
        attempts_module, "QuestionRepository", lambda session: fake_question_repo
    )

    async def fake_generate(payload: dict):
        return generate_payload or {
            "headline": "Solid effort",
            "score_line": "Keep practicing",
            "top_mistakes": [],
            "strengths": [],
            "micro_drills": [],
            "next_quiz": {"topic": "python_core", "difficulty": "easy", "size": 8},
        }

    monkeypatch.setattr(attempts_module, "generate_ai_review", fake_generate)

    user = FakeUser(attempt.user_id)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: None

    async def noop_seed() -> None:
        return None

    monkeypatch.setattr(main, "seed_if_empty", noop_seed)


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides = {}


def test_ai_review_not_generated_returns_status(monkeypatch: pytest.MonkeyPatch):
    attempt_id = uuid4()
    user_id = uuid4()
    attempt = FakeAttempt(
        attempt_id=attempt_id,
        user_id=user_id,
        answers=[],
        total_count=5,
        score_percent=60,
    )

    configure_dependencies(monkeypatch, attempt, questions={})

    with TestClient(app) as client:
        response = client.get(f"/api/v1/attempts/{attempt_id}/ai-review")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "not_generated"


def test_ai_review_generate_stores_and_normalizes_difficulty(
    monkeypatch: pytest.MonkeyPatch,
):
    attempt_id = uuid4()
    user_id = uuid4()
    question_id = uuid4()
    attempt = FakeAttempt(
        attempt_id=attempt_id,
        user_id=user_id,
        answers=[
            {
                "question_id": str(question_id),
                "user_answer": "A",
                "is_correct": False,
            }
        ],
        total_count=1,
        score_percent=0,
    )
    questions = {
        str(question_id): FakeQuestion(
            question_id=question_id,
            prompt="What is 2 + 2?",
            correct_answer="4",
        )
    }

    generate_payload = {
        "headline": "Keep going",
        "score_line": "You are close",
        "top_mistakes": [],
        "strengths": [],
        "micro_drills": [],
        "next_quiz": {"topic": "python_core", "difficulty": "advanced", "size": 6},
    }

    configure_dependencies(monkeypatch, attempt, questions, generate_payload=generate_payload)

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/attempts/{attempt_id}/ai-review?generate=true"
        )
        assert response.status_code == 200
        payload = response.json()

        assert payload["status"] == "ready"
        assert payload["next_quiz"]["difficulty"] in {"junior", "middle"}
        assert payload["next_quiz"]["difficulty"] == "middle"
        assert payload["next_quiz_suggestion"]["difficulty"] == "middle"
        assert attempt.ai_review_json is not None
        assert attempt.ai_review_json["next_quiz"]["difficulty"] == "middle"

        follow_up = client.get(f"/api/v1/attempts/{attempt_id}/ai-review")

    assert follow_up.status_code == 200
    follow_up_payload = follow_up.json()
    assert follow_up_payload["next_quiz"]["difficulty"] == "middle"
    assert follow_up_payload["next_quiz_suggestion"]["difficulty"] == "middle"
    assert follow_up_payload["headline"] == payload["headline"]
