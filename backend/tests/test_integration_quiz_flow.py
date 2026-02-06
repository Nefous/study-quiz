import pytest

from factories import create_question


@pytest.mark.asyncio
@pytest.mark.integration
async def test_quiz_generate_submit_flow(async_client, db_session, auth_headers):
    await create_question(db_session, prompt="What is 2+2?")
    await create_question(db_session, prompt="What is 3+3?")
    await create_question(db_session, prompt="What is 4+4?")

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
    assert attempt_id
    assert len(questions) == 2

    answers = []
    correct_count = 0
    for question in questions:
        selected = question.get("correct_answer") or "A"
        answers.append(
            {
                "question_id": question["id"],
                "selected_answer": selected,
                "is_correct": True,
            }
        )
        correct_count += 1

    submit = await async_client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers=auth_headers,
        json={
            "topic": "python_core",
            "difficulty": "junior",
            "mode": "practice",
            "attempt_type": "normal",
            "size": len(questions),
            "correct_count": correct_count,
            "total_count": len(questions),
            "answers": answers,
            "finished_at": "2026-02-06T00:00:00Z",
            "time_spent_seconds": 10,
            "timed_out": False,
        },
    )
    assert submit.status_code == 200
    submit_payload = submit.json()
    assert submit_payload["score_percent"] == 100

    attempt = await async_client.get(
        f"/api/v1/attempts/{attempt_id}",
        headers=auth_headers,
    )
    assert attempt.status_code == 200
    attempt_payload = attempt.json()
    assert attempt_payload["id"] == attempt_id
    assert attempt_payload["total_count"] == len(questions)
