from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AttemptAnswer(BaseModel):
    question_id: str
    user_answer: str
    is_correct: bool


class AttemptCreate(BaseModel):
    topic: str
    difficulty: str
    mode: str
    size: int | None = None
    correct_count: int
    total_count: int
    answers: list[AttemptAnswer]
    meta: dict | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    time_limit_seconds: int | None = None
    time_spent_seconds: int | None = None
    timed_out: bool | None = None


class AttemptOut(BaseModel):
    id: UUID
    topic: str
    difficulty: str
    mode: str
    size: int | None = None
    correct_count: int
    total_count: int
    answers: list[AttemptAnswer]
    meta: dict | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    time_limit_seconds: int | None = None
    time_spent_seconds: int | None = None
    timed_out: bool | None = None
    created_at: datetime
    score_percent: int

    model_config = {"from_attributes": True}


class AttemptTopicStats(BaseModel):
    topic: str
    attempts: int
    avg_score_percent: int


class AttemptStats(BaseModel):
    total_attempts: int
    avg_score_percent: int
    best_score_percent: int
    last_attempt_at: datetime | None
    by_topic: list[AttemptTopicStats]
