from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AdminQuestionListItem(BaseModel):
    id: UUID
    topic: str
    difficulty: str
    type: str
    prompt: str
    created_at: datetime | None = None
    archived_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdminQuestionDetail(BaseModel):
    id: UUID
    topic: str
    difficulty: str
    type: str
    prompt: str
    code: str | None = None
    choices: dict[str, str] | None = None
    correct_answer: str
    explanation: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    archived_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdminQuestionListResponse(BaseModel):
    items: list[AdminQuestionListItem]
    total: int
