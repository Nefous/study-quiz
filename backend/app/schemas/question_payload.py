from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator


class ChoiceItem(BaseModel):
    key: str
    text: str

    model_config = {"extra": "forbid"}


class QuestionPayload(BaseModel):
    topic: str
    difficulty: str
    type: str
    prompt: str
    explanation: str | None = None
    choices: list[ChoiceItem] | None = None
    answer: str | None = None
    code: str | None = None
    expected_output: str | None = None

    model_config = {"extra": "forbid"}

    @field_validator("prompt")
    @classmethod
    def _prompt_required(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("prompt must be non-empty")
        return value

    @model_validator(mode="before")
    @classmethod
    def _normalize_input(cls, values: Any) -> Any:
        if not isinstance(values, dict):
            return values

        data = dict(values)
        if "answer" not in data and "correct_answer" in data:
            data["answer"] = data.get("correct_answer")

        choices = data.get("choices")
        if isinstance(choices, dict):
            data["choices"] = [
                {"key": key, "text": str(text)} for key, text in choices.items()
            ]
        elif isinstance(choices, list):
            if choices and all(isinstance(item, str) for item in choices):
                normalized = []
                for index, text in enumerate(choices):
                    key = chr(ord("A") + index)
                    normalized.append({"key": key, "text": text})
                data["choices"] = normalized
        return data

    @model_validator(mode="after")
    def _validate_by_type(self) -> "QuestionPayload":
        qtype = (self.type or "").strip()
        if qtype == "mcq":
            if not self.choices:
                raise ValueError("choices required for mcq")
            if not self.answer:
                raise ValueError("answer required for mcq")
            valid_choices = {item.key for item in self.choices}
            valid_choices.update({item.text for item in self.choices})
            if self.answer not in valid_choices:
                raise ValueError("answer must match a choice key or text")
            if self.code or self.expected_output:
                raise ValueError("code fields not allowed for mcq")
        elif qtype == "code_output":
            if not self.code:
                raise ValueError("code required for code_output")
            if not self.expected_output:
                raise ValueError("expected_output required for code_output")
            if self.choices or self.answer:
                raise ValueError("choices/answer not allowed for code_output")
        else:
            raise ValueError("type must be mcq or code_output")
        return self


def _flatten_errors(errors: list[dict[str, Any]]) -> list[str]:
    flattened: list[str] = []
    for err in errors:
        loc = ".".join(str(item) for item in err.get("loc", []) if item is not None)
        msg = err.get("msg") or "Invalid value"
        flattened.append(f"{loc}: {msg}" if loc else msg)
    return flattened


def validate_candidate_payload(payload_json: dict[str, Any]) -> tuple[bool, dict | None, list[str]]:
    try:
        parsed = QuestionPayload.model_validate(payload_json)
        return True, parsed.model_dump(), []
    except ValidationError as exc:
        return False, None, _flatten_errors(exc.errors())
