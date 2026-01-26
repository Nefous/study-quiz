from pydantic import BaseModel, Field


class HintRequest(BaseModel):
    user_answer: str | None = None
    level: int = Field(default=1, ge=1, le=3)


class HintResponse(BaseModel):
    hint: str
