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
You are a study coach. Create a next-quiz recommendation.
Return ONLY valid JSON with these keys:
- topic (string)
- difficulty ("junior" or "middle")
- size (number)
- reason (string, max 200 chars)
- prep (array of 4-6 short strings)
- based_on (string)

Rules:
- Output JSON ONLY. No extra text.
- Keep each item concise and actionable.
""".strip()

HUMAN_PROMPT = """
Recommendation:
Topic: {topic}
Difficulty: {difficulty}
Size: {size}
Based on: {based_on}
Context:
{context}

Constraints:
- topic must be one of: {allowed_topics}
- difficulty must be "junior" or "middle"
- size must be 5, 10, or 15
""".strip()


def _safe_json_parse(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        logger.warning("Next quiz JSON parse failed; raw output: %s", text)

    start = text.find("{")
    if start != -1:
        depth = 0
        for idx in range(start, len(text)):
            ch = text[idx]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : idx + 1]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        break

    raw = text.strip()
    raw = raw[:500] + ("..." if len(raw) > 500 else "")
    return {
        "reason": "Focus on steady improvement.",
        "prep": [
            "Review key concepts.",
            "Practice similar questions.",
            "Note common mistakes.",
            "Warm up with short drills.",
        ],
        "raw": raw,
        "status": "error",
    }


def _clamp_text(value: Any, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    text = " ".join(value.strip().split())
    return text[:max_len]


def _normalize_recommendation(data: dict[str, Any]) -> dict[str, Any]:
    reason = _clamp_text(data.get("reason"), 200)
    prep_items = [
        _clamp_text(item, 120)
        for item in (data.get("prep") or [])
        if isinstance(item, str) and item.strip()
    ]

    if len(prep_items) < 4:
        prep_items.extend(
            [
                "Review key concepts.",
                "Practice similar questions.",
                "Note common mistakes.",
                "Warm up with short drills.",
            ]
        )
    prep_items = prep_items[:6]

    normalized = {
        "topic": _clamp_text(data.get("topic"), 40),
        "difficulty": _clamp_text(data.get("difficulty"), 20),
        "size": int(data.get("size") or 0),
        "based_on": _clamp_text(data.get("based_on"), 40),
        "reason": reason or "Focus on steady improvement.",
        "prep": prep_items,
    }
    status = data.get("status")
    if status:
        normalized["status"] = status
    raw = data.get("raw")
    if raw:
        normalized["raw"] = raw
    return normalized


async def generate_next_quiz_recommendation(payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )
    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        temperature=settings.GROQ_REVIEW_TEMPERATURE,
        max_tokens=300,
    )
    chain = prompt | llm | StrOutputParser()
    text = await chain.ainvoke(payload)
    return _normalize_recommendation(_safe_json_parse(text))
