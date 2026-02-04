from pydantic import BaseModel


class NextQuizRecommendation(BaseModel):
    topic: str
    difficulty: str
    size: int
    based_on: str


class NextQuizRecommendationGenerated(BaseModel):
    topic: str
    difficulty: str
    size: int
    based_on: str
    reason: str
    prep: list[str]
