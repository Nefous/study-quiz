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
    """Parse a string into an enum member, raising ValueError on failure."""
    if not isinstance(value, str):
        raise ValueError(f"Invalid {field}")
    try:
        return enum_cls(value)
    except ValueError:
        raise ValueError(f"Invalid {field}")
