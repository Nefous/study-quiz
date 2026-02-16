from uuid import UUID

from pydantic import BaseModel, Field

from app.utils.enums import AttemptType, Difficulty, QuestionType, QuizMode, Topic


class QuizGenerateRequest(BaseModel):
    topic: Topic | None = None
    topics: list[Topic] | None = None
    difficulty: Difficulty | None = None
    mode: QuizMode | None = None
    attempt_type: AttemptType | None = None
    size: int | None = Field(default=None, gt=0)
    limit: int | None = Field(default=None, gt=0)
    attempt_id: UUID | None = None


class QuizQuestionOut(BaseModel):
    id: UUID
    topic: Topic
    difficulty: Difficulty
    type: QuestionType
    prompt: str
    code: str | None = None
    choices: dict[str, str] | None = None
    explanation: str | None = None
    correct_answer: str | None = None

    model_config = {"from_attributes": True}


class QuizGenerateResponse(BaseModel):
    quiz_id: UUID
    questions: list[QuizQuestionOut] = Field(default_factory=list)
    attempt_id: UUID | None = None
