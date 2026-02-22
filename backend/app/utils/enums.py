from enum import StrEnum


class QuestionType(StrEnum):
    MCQ = "mcq"
    CODE_OUTPUT = "code_output"


class Difficulty(StrEnum):
    JUNIOR = "junior"
    MIDDLE = "middle"


class Topic(StrEnum):
    PYTHON_CORE = "python_core"
    BIG_O = "big_o"
    ALGORITHMS = "algorithms"
    DATA_STRUCTURES = "data_structures"
    RANDOM = "random"


class QuizMode(StrEnum):
    PRACTICE = "practice"
    EXAM = "exam"


class AttemptType(StrEnum):
    NORMAL = "normal"
    MISTAKES_REVIEW = "mistakes_review"


def parse_enum(value: str, enum_cls, field: str):
    """Parse a string into an enum member, raising HTTPException on failure."""
    from fastapi import HTTPException

    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    try:
        return enum_cls(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field}") from exc
