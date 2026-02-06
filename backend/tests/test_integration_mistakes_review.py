import pytest

from factories import create_question


@pytest.mark.asyncio
@pytest.mark.integration
async def test_repeat_mistakes_flow(async_client, db_session, auth_headers):
    q1 = await create_question(db_session, prompt="Mistake 1")
    q2 = await create_question(db_session, prompt="Mistake 2")
    question_map = {str(q1.id): q1, str(q2.id): q2}

    generate = await async_client.post(
        "/api/v1/quiz/generate",
        headers=auth_headers,
        json={
            "topic": "python_core",
            "difficulty": "junior",
            "mode": "practice",
            "size": 2,
        },
    )
    assert generate.status_code == 200
    generate_payload = generate.json()
    attempt_id = generate_payload["attempt_id"]
    questions = generate_payload["questions"]

    answers = []
    for question in questions:
        answers.append(
            {
                "question_id": question["id"],
                "selected_answer": "D",
                "is_correct": False,
            }
        )

    submit = await async_client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=auth_headers,
        json={
            "topic": "python_core",
            "difficulty": "junior",
            "mode": "practice",
            "attempt_type": "normal",
            "size": len(questions),
            "correct_count": 0,
            "total_count": len(questions),
            "answers": answers,
            "finished_at": "2026-02-06T00:00:00Z",
        },
    )
    assert submit.status_code == 200

    mistakes = await async_client.post(
        "/api/v1/quiz/generate",
        headers=auth_headers,
        json={
            "topic": "python_core",
            "difficulty": "junior",
            "mode": "practice",
            "attempt_type": "mistakes_review",
            "size": 1,
        },
    )
    assert mistakes.status_code == 200
    mistakes_payload = mistakes.json()
    mistakes_attempt_id = mistakes_payload["attempt_id"]
    mistakes_questions = mistakes_payload["questions"]
    assert len(mistakes_questions) == 1
    mistake_id = mistakes_questions[0]["id"]
    assert mistake_id in question_map

    corrected_question = question_map[mistake_id]
    correct_answer = corrected_question.correct_answer

    submit_mistake = await async_client.post(
        f"/api/v1/attempts/{mistakes_attempt_id}/submit",
        headers=auth_headers,
        json={
            "topic": "python_core",
            "difficulty": "junior",
            "mode": "practice",
            "attempt_type": "mistakes_review",
            "size": 1,
            "correct_count": 1,
            "total_count": 1,
            "answers": [
                {
                    "question_id": mistake_id,
                    "selected_answer": correct_answer,
                    "is_correct": True,
                }
            ],
            "finished_at": "2026-02-06T00:00:00Z",
        },
    )
    assert submit_mistake.status_code == 200

    remaining_id = str(q1.id) if mistake_id == str(q2.id) else str(q2.id)

    next_mistakes = await async_client.post(
        "/api/v1/quiz/generate",
        headers=auth_headers,
        json={
            "topic": "python_core",
            "difficulty": "junior",
            "mode": "practice",
            "attempt_type": "mistakes_review",
            "size": 1,
        },
    )
    assert next_mistakes.status_code == 200
    next_payload = next_mistakes.json()
    next_questions = next_payload["questions"]
    assert len(next_questions) == 1
    assert next_questions[0]["id"] == remaining_id
