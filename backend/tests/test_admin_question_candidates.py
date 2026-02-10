from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.endpoints import admin_question_candidates as admin_module
from app.integrations import question_candidates_chain
from app.db.session import get_session
from app.services.auth_service import get_admin_user
import app.core.config as config_module


class FakeUser:
    def __init__(self, user_id: UUID, email: str) -> None:
        self.id = user_id
        self.email = email


class FakeSession:
    def __init__(self) -> None:
        self.items = []

    def add(self, item) -> None:
        self.items.append(item)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, item) -> None:
        return None
    
@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides = {}


def test_generate_question_candidates(monkeypatch: pytest.MonkeyPatch):
    async def fake_generate(_: dict) -> str:
        return (
            "["
            "{\"topic\":\"python_core\",\"difficulty\":\"junior\",\"type\":\"mcq\","
            "\"prompt\":\"What is 2+2?\",\"choices\":[{\"key\":\"A\",\"text\":\"4\"}],"
            "\"answer\":\"A\"}"
            "]"
        )

    monkeypatch.setattr(question_candidates_chain, "generate_question_candidates", fake_generate)

    settings = config_module.get_settings()
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "test-key")

    fake_user = FakeUser(UUID("00000000-0000-0000-0000-000000000001"), "admin@example.com")
    app.dependency_overrides[get_admin_user] = lambda: fake_user
    app.dependency_overrides[get_session] = lambda: FakeSession()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/question-candidates/generate",
            json={"topic": "python_core", "difficulty": "junior", "n": 20},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["created"] == 1
    assert payload["failed"] == 0
    assert len(payload["candidate_ids"]) == 1
