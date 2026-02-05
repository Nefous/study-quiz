from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are generating interview practice questions for a Python quiz app.

Return ONLY a valid JSON ARRAY (no markdown, no code fences, no commentary).
The response must start with '[' and end with ']'.
Do not add any text before '[' or after ']'. End immediately after the final ']'.

Each array element is one object with REQUIRED fields:
- topic: string
- difficulty: string
- type: "mcq" OR "code_output"
- prompt: string

Optional field:
- explanation: string

If type == "mcq", REQUIRED additional fields:
- choices: array of objects, each object has:
  - key: string (A, B, C, D)
  - text: string
- answer: string (must match one of the choice keys exactly, e.g. "B")

If type == "code_output", REQUIRED additional fields:
- code: string (valid Python code, must run)
- expected_output: string (exact stdout after running the code)

STRICT RULES:
- Do NOT include any extra keys beyond what is listed above.
- Do NOT include markdown fences or triple backticks anywhere.
- Keep prompts concise (1–2 sentences).
- For code_output: code must print something, and expected_output must be deterministic.
- Avoid duplicates and near-duplicates across the generated questions.

""".strip()


HUMAN_PROMPT = """
Topic: {topic}
Difficulty: {difficulty}
Generate {count} questions.
Type: {qtype}
""".strip()


def _escape_newlines_in_strings(text: str) -> str:
    output: list[str] = []
    in_string = False
    escape = False
    for ch in text:
        if escape:
            output.append(ch)
            escape = False
            continue
        if ch == "\\":
            output.append(ch)
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            output.append(ch)
            continue
        if in_string and ch in {"\n", "\r"}:
            output.append("\\n")
            continue
        output.append(ch)
    return "".join(output)


def _extract_array(data: Any) -> list[dict[str, Any]] | None:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("questions", "items", "data", "results"):
            value = data.get(key)
            if isinstance(value, list):
                return value
        for value in data.values():
            if isinstance(value, list):
                return value
    return None


def _try_parse_json(text: str) -> list[dict[str, Any]] | None:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    return _extract_array(data)


def parse_candidates_json(raw: str) -> list[dict[str, Any]]:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
    snippet = cleaned
    if "[" in cleaned and "]" in cleaned:
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        snippet = cleaned[start : end + 1]

    for candidate in (snippet, cleaned):
        parsed = _try_parse_json(candidate)
        if parsed is not None:
            return parsed
        parsed = _try_parse_json(_escape_newlines_in_strings(candidate))
        if parsed is not None:
            return parsed

    start = cleaned.find("[")
    if start != -1:
        depth = 0
        in_string = False
        escape = False
        for idx in range(start, len(cleaned)):
            ch = cleaned[idx]
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    fragment = cleaned[start : idx + 1]
                    parsed = _try_parse_json(fragment)
                    if parsed is not None:
                        return parsed
                    parsed = _try_parse_json(_escape_newlines_in_strings(fragment))
                    if parsed is not None:
                        return parsed
                    break
    raise ValueError("AI output must be a JSON array")


class CandidateParseError(ValueError):
    def __init__(self, message: str, raw_output: str) -> None:
        super().__init__(message)
        self.raw_output = raw_output


async def generate_question_candidates(payload: dict[str, Any]) -> str:
    settings = get_settings()
    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        temperature=settings.GROQ_TEMPERATURE,
        max_tokens=1800,
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    raw_output = await chain.ainvoke(payload)
    logger.warning("AI raw output (first 25000): %r", raw_output[:10000])
    logger.warning("AI raw output (last 200): %r", raw_output[-1000:])
    
    return raw_output


async def generate_question_candidates_items(
    payload: dict[str, Any],
    batch_size: int = 20,
) -> list[dict[str, Any]]:
    target = int(payload.get("count") or 0)
    if target <= 0:
        return []

    results: list[dict[str, Any]] = []
    current_batch = min(batch_size, target)

    while len(results) < target:
        ask = min(current_batch, target - len(results))
        raw_output = await generate_question_candidates({**payload, "count": ask})
        try:
            items = parse_candidates_json(raw_output)
        except (json.JSONDecodeError, ValueError) as exc:
            if ask > 5:
                current_batch = max(5, ask // 2)
                continue
            raise CandidateParseError(str(exc), raw_output) from exc
        results.extend(items)

    return results[:target]
