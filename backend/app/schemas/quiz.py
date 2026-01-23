from uuid import UUID

from pydantic import BaseModel, Field

from app.utils.enums import Difficulty, QuestionType, QuizMode, Topic


class QuizGenerateRequest(BaseModel):
    topic: Topic
    difficulty: Difficulty
    mode: QuizMode
    size: int | None = None


class QuizQuestionOut(BaseModel):
    id: UUID
    topic: Topic
    difficulty: Difficulty
    type: QuestionType
    prompt: str
    choices: dict[str, str] | None = None
    explanation: str | None = None
    correct_answer: str | None = None

    model_config = {"from_attributes": True}


class QuizGenerateResponse(BaseModel):
    quiz_id: UUID
    questions: list[QuizQuestionOut] = Field(default_factory=list)
