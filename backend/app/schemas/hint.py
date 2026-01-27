from uuid import UUID

from pydantic import BaseModel, Field


class HintRequest(BaseModel):
    attempt_id: UUID | None = None
    user_answer: str | None = None
    level: int = Field(default=1, ge=1, le=3)


class HintResponse(BaseModel):
    hint: str
