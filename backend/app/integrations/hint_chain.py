from __future__ import annotations

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import get_settings

SYSTEM_PROMPT = """
You are a helpful tutor.
Provide ONLY hints as 1–4 bullet points.
Never reveal the correct answer, never mention the correct option letter, and never print the exact expected output.

Level rules:
- Level 1: general guidance.
- Level 2: more specific reasoning/pitfall; for MCQ you may say ONE option is unlikely (without naming which is correct).
- Level 3: strong guidance; for MCQ you may say TWO options are unlikely (still never say which option is correct).

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
    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        temperature=settings.GROQ_TEMPERATURE,
        max_tokens=settings.GROQ_HINT_MAX_TOKENS,
    )
    chain = prompt | llm | StrOutputParser()
    return await chain.ainvoke(payload)
