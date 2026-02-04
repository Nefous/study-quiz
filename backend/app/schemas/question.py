from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.utils.enums import Difficulty, QuestionType, Topic


class QuestionOut(BaseModel):
    id: UUID
    topic: Topic
    difficulty: Difficulty
    type: QuestionType
    prompt: str
    choices: dict[str, str] | None = None
    correct_answer: str
    explanation: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class FavoriteQuestionOut(QuestionOut):
    correct_answer_text: str | None = None


class QuestionCreate(BaseModel):
    topic: Topic
    difficulty: Difficulty
    type: QuestionType
    prompt: str
    choices: dict[str, str] | None = None
    correct_answer: str
    explanation: str | None = None


class QuestionCreateInternal(QuestionCreate):
    id: UUID | None = None
    seed_key: str | None = None
