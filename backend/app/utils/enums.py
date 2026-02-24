from enum import Enum, StrEnum
from typing import Type, TypeVar

_E = TypeVar("_E", bound=Enum)


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


def parse_enum(value: str, enum_cls: Type[_E], field: str) -> _E:
    if not isinstance(value, str):
        raise ValueError(f"Invalid {field}")
    try:
        return enum_cls(value)
    except ValueError:
        raise ValueError(f"Invalid {field}")
