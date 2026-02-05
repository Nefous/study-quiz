from langchain_core.prompts import ChatPromptTemplate

from app.integrations.question_candidates_chain import HUMAN_PROMPT, SYSTEM_PROMPT


def test_question_candidates_prompt_formats():
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )
    payload = {
        "count": 2,
        "topic": "python_core",
        "difficulty": "junior",
        "qtype": "mcq",
    }
    messages = prompt.format_messages(**payload)
    assert messages
