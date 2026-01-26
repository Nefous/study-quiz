from __future__ import annotations

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import get_settings

SYSTEM_PROMPT = """
You are a helpful tutor.
Give only hints (1–4 bullets). NEVER reveal the correct answer, option letter, or exact output.
Level rules:
- Level 1: general guidance
- Level 2: more specific direction
- Level 3: strong guidance but still no answer
Keep hints short and actionable.
""".strip()

HUMAN_PROMPT = """
Question Type: {question_type}
Question:
{question_prompt}

Choices (if any):
{choices_text}

User Answer (optional):
{user_answer}

Hint Level: {level}
""".strip()


async def generate_hint(payload: dict) -> str:
    settings = get_settings()
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )
    llm = ChatOpenAI(
        model=settings.OPENAI_MODEL,
        temperature=settings.OPENAI_TEMPERATURE,
        max_tokens=settings.OPENAI_HINT_MAX_TOKENS,
    )
    chain = prompt | llm | StrOutputParser()
    return await chain.ainvoke(payload)
