import json
import uuid
from pathlib import Path

from app.db.session import AsyncSessionLocal
from app.repositories.question_repo import QuestionRepository
from app.schemas.question import QuestionCreateInternal
from app.utils.enums import Difficulty, QuestionType, Topic

SEED_FILE = Path(__file__).with_name("questions.seed.json")


def _validate_choice_keys(choices: dict[str, str]) -> None:
    if set(choices.keys()) != {"A", "B", "C", "D"}:
        raise ValueError("MCQ choices must have exactly A/B/C/D keys")


def _validate_question(item: dict) -> QuestionCreateInternal:
    for key in ("topic", "difficulty", "type", "prompt", "correct_answer"):
        if key not in item:
            raise ValueError(f"Missing required field: {key}")

    topic = Topic(item["topic"])
    difficulty = Difficulty(item["difficulty"])
    qtype = QuestionType(item["type"])
    prompt = item["prompt"]
    correct_answer = item["correct_answer"]

    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Invalid prompt")

    if qtype == QuestionType.MCQ:
        choices = item.get("choices")
        if not isinstance(choices, dict):
            raise ValueError("MCQ questions must include choices dict")
        _validate_choice_keys(choices)
        if correct_answer not in choices:
            raise ValueError("MCQ correct_answer must be one of A/B/C/D")
    else:
        if "```" not in prompt:
            raise ValueError("code_output questions must include a code snippet in prompt")

    return QuestionCreateInternal(
        id=item.get("id"),
        topic=topic,
        difficulty=difficulty,
        type=qtype,
        prompt=prompt,
        choices=item.get("choices"),
        correct_answer=correct_answer,
        explanation=item.get("explanation"),
    )


def _load_questions() -> list[QuestionCreateInternal]:
    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Seed file must contain a JSON array")

    items: list[QuestionCreateInternal] = []
    for item in data:
        if not isinstance(item, dict):
            raise ValueError("Each question must be an object")
        item.setdefault("id", str(uuid.uuid4()))
        items.append(_validate_question(item))
    return items


async def seed_if_empty() -> bool:
    questions = _load_questions()
    async with AsyncSessionLocal() as session:
        repo = QuestionRepository(session)
        count = await repo.count_questions()
        if count > 0:
            return False
        await repo.bulk_insert_questions(questions)
        return True


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_if_empty())
