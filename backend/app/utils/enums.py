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
