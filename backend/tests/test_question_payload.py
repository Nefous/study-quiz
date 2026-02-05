from app.schemas.question_payload import validate_candidate_payload


def test_valid_mcq_payload():
    payload = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "mcq",
        "prompt": "What is 2 + 2?",
        "choices": [
            {"key": "A", "text": "3"},
            {"key": "B", "text": "4"},
        ],
        "answer": "B",
        "explanation": "Basic addition."
    }
    ok, normalized, errors = validate_candidate_payload(payload)
    assert ok is True
    assert normalized is not None
    assert errors == []


def test_mcq_missing_choices():
    payload = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "mcq",
        "prompt": "What is 2 + 2?",
        "answer": "B",
    }
    ok, normalized, errors = validate_candidate_payload(payload)
    assert ok is False
    assert normalized is None
    assert any("choices required for mcq" in item for item in errors)


def test_valid_code_output_payload():
    payload = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "code_output",
        "prompt": "What is the output?",
        "code": "print(2 + 2)",
        "expected_output": "4",
    }
    ok, normalized, errors = validate_candidate_payload(payload)
    assert ok is True
    assert normalized is not None
    assert errors == []


def test_code_output_missing_expected_output():
    payload = {
        "topic": "python_core",
        "difficulty": "junior",
        "type": "code_output",
        "prompt": "What is the output?",
        "code": "print(2 + 2)",
    }
    ok, normalized, errors = validate_candidate_payload(payload)
    assert ok is False
    assert normalized is None
    assert any("expected_output required for code_output" in item for item in errors)
