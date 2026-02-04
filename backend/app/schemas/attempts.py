from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AttemptAnswer(BaseModel):
    question_id: str
    user_answer: str
    is_correct: bool


class AttemptCreate(BaseModel):
    attempt_id: str | None = None
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


class AttemptRecentScore(BaseModel):
    score_percent: int
    created_at: datetime


class AttemptStats(BaseModel):
    total_attempts: int
    avg_score_percent: int
    best_score_percent: int
    last_attempt_at: datetime | None
    by_topic: list[AttemptTopicStats]
    current_streak_days: int
    strongest_topic: str | None = None
    weakest_topic: str | None = None
    recent_scores: list[int]
    recent_attempts: list[AttemptRecentScore]


class AiReviewFocusTopic(BaseModel):
    topic: str
    why: str
    priority: str


class AiReviewStudyPlanItem(BaseModel):
    day: int
    tasks: list[str]


class AiReviewNextQuizSuggestion(BaseModel):
    topics: list[str]
    difficulty: str
    size: int


class AiReviewTopMistake(BaseModel):
    question_ref: str
    your_answer: str
    correct_answer: str
    why: str


class AiReviewNextQuiz(BaseModel):
    topic: str
    difficulty: str
    size: int


class AiReviewResponse(BaseModel):
    status: str | None = None
    raw: str | None = None
    headline: str | None = None
    score_line: str | None = None
    top_mistakes: list[AiReviewTopMistake] = []
    summary: str | None = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    micro_drills: list[str] = []
    focus_topics: list[AiReviewFocusTopic] = []
    study_plan: list[AiReviewStudyPlanItem] = []
    next_quiz_suggestion: AiReviewNextQuizSuggestion | None = None
    next_quiz: AiReviewNextQuiz | None = None
    ai_review: dict | None = None
