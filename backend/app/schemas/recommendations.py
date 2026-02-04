from pydantic import BaseModel, field_validator


class NextQuizRecommendation(BaseModel):
    id: str | None = None
    topic: str | None = None
    difficulty: str | None = None
    size: int | None = None
    based_on: str | None = None
    reason: str | None = None
    prep: list[str] | None = None


class NextQuizRecommendationGenerated(BaseModel):
    id: str
    topic: str
    difficulty: str
    size: int
    based_on: str
    reason: str
    prep: list[str]


class NextQuizRecommendationGenerateInput(BaseModel):
    topic: str
    difficulty: str
    size: int
    based_on: str
    reason: str
    prep: list[str]

    @field_validator("difficulty")
    @classmethod
    def _validate_difficulty(cls, value: str) -> str:
        if value not in {"junior", "middle"}:
            raise ValueError("Invalid difficulty")
        return value

    @field_validator("size")
    @classmethod
    def _validate_size(cls, value: int) -> int:
        if value not in {5, 10, 15}:
            raise ValueError("Invalid size")
        return value
