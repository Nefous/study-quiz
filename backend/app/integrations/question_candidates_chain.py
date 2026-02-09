from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-3-flash-preview"

SYSTEM_PROMPT = """
You are generating interview-grade Python quiz questions.

OUTPUT FORMAT:
- Return ONLY a valid JSON ARRAY. No markdown, no backticks, no commentary.
- The first non-whitespace character MUST be '[' and the last MUST be ']'.
- Do not wrap the array in any object wrapper.
- Use literal \\n for new lines in string fields.

SCHEMA (exact keys only):
- topic: string
- difficulty: string
- type: "mcq" OR "code_output"
- prompt: string
- explanation: string (optional)

MCQ REQUIREMENTS:
- choices: array of objects with fields: key, text. key is A/B/C/D
- answer: one of A/B/C/D (must match a key exactly)
- Wrong answers must be plausible and based on common developer mistakes.

CODE_OUTPUT REQUIREMENTS:
- code: string (valid Python, must run)
- expected_output: string (exact stdout). For topic=big_o, expected_output may be
  a complexity string like "O(n^2)" instead of stdout.
- Do NOT include choices for code_output (omit the choices key entirely).

DIFFICULTY RULES:
- junior: concept check + small realistic code allowed.
- middle: MUST require reasoning, not memorization.
- For middle difficulty FORBID trivial patterns:
  len(), simple slicing, basic dict lookup, syntax trivia.

QUALITY CONSTRAINTS:
- Each question tests exactly ONE concept.
- Explanations must be precise and technically correct.
- For difficulty=middle:
  - At least 50% questions must include code (prompt snippet or code_output).
  - Code examples should be at least 4–8 lines.
  - Include at least one hidden cost or trap:
    slicing inside loops, list/string concat in loops, pop(0), nested O(n) calls,
    recursion depth, mutable defaults, identity vs equality, hashing behavior,
    amortized complexity, or data-structure tradeoffs.

TOPIC HEURISTICS:
- topic=big_o: prefer code with slicing, min/max in loops, pop(0), dict/set ops,
  sorting, heapq, recursion, or membership tests.
- Explanation MUST name the dominating operation and why.


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

Make them interview-grade and non-trivial.
Avoid beginner trivia and definition-only questions.

Rubric:
- Each question checks one concrete concept.
- Prefer realistic code and scenarios.
- Use tricky but fair reasoning where appropriate.
- Explanations must justify the answer briefly but precisely.
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
    if not settings.GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is required for Gemini question candidates")
    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        temperature=settings.GROQ_TEMPERATURE,
        max_output_tokens=12000,
        google_api_key=settings.GOOGLE_API_KEY,
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    return await chain.ainvoke(payload)


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
