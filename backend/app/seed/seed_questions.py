import hashlib
import json
import logging
import uuid
from pathlib import Path

from app.db.session import AsyncSessionLocal
from app.repositories.question_repo import QuestionRepository
from app.schemas.question import QuestionCreateInternal
from app.utils.enums import Difficulty, QuestionType, Topic

SEED_FILE = Path(__file__).with_name("questions.seed.json")
logger = logging.getLogger(__name__)


def _compute_seed_key(topic: Topic, difficulty: Difficulty, qtype: QuestionType, prompt: str) -> str:
    raw = f"{topic.value}|{difficulty.value}|{qtype.value}|{prompt}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


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

    seed_key = _compute_seed_key(topic, difficulty, qtype, prompt)
    return QuestionCreateInternal(
        id=item.get("id"),
        seed_key=seed_key,
        topic=topic,
        difficulty=difficulty,
        type=qtype,
        prompt=prompt,
        choices=item.get("choices"),
        correct_answer=correct_answer,
        explanation=item.get("explanation"),
    )


def _load_questions() -> list[QuestionCreateInternal]:
    try:
        raw = SEED_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Seed file parse failed (%s): %s", SEED_FILE, exc)
        return []
    if not isinstance(data, list):
        logger.error("Seed file must contain a JSON array")
        return []

    items: list[QuestionCreateInternal] = []
    for item in data:
        if not isinstance(item, dict):
            raise ValueError("Each question must be an object")
        item.setdefault("id", str(uuid.uuid4()))
        items.append(_validate_question(item))
    return items


async def seed_if_empty() -> bool:
    questions = _load_questions()
    if not questions:
        return False
    async with AsyncSessionLocal() as session:
        repo = QuestionRepository(session)
        if questions:
            logger.debug(
                "Seed choices type: %s",
                type(questions[0].choices).__name__,
            )
        affected = await repo.upsert_questions_by_seed_key(questions)
        return affected > 0


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_if_empty())
