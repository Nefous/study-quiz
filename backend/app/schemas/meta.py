from pydantic import BaseModel


class MetaResponse(BaseModel):
    topics: list[str]
    difficulties: list[str]
    modes: list[str]
    defaultQuizSize: int
    maxQuestionsPerQuiz: int
