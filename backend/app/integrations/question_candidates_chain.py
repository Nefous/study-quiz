from __future__ import annotations

import json
from typing import Any

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import get_settings

SYSTEM_PROMPT = """
You generate interview practice questions.
Return ONLY valid JSON array of QuestionPayload objects. No markdown, no commentary.
Each object MUST include:
- topic
- difficulty
- type (mcq or code_output)
- prompt
- explanation (optional)

For mcq:
- choices: list of {{key, text}}
- answer: must match a choice key or text exactly

For code_output:
- code
- expected_output (exact stdout)

Do not include extra keys.
""".strip()

HUMAN_PROMPT = """
Generate {count} questions.
Topic: {topic}
Difficulty: {difficulty}
Type: {qtype}
""".strip()


def parse_candidates_json(raw: str) -> list[dict[str, Any]]:
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("AI output must be a JSON array")
    return data


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
    return await chain.ainvoke(payload)
