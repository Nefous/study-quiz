from __future__ import annotations

import hashlib
import json
import subprocess
import asyncio
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question_candidate import QuestionCandidate
from app.models.question import Question
from app.schemas.question_payload import validate_candidate_payload

_DEDUP_STATUSES = {"validated", "approved", "published"}


def _missing_required_fields(item: dict[str, Any]) -> bool:
    return not item.get("topic") or not item.get("difficulty") or not item.get("type")


async def record_parse_failure(
    session: AsyncSession,
    topic: str,
    difficulty: str,
    qtype: str | None,
    raw_output: str,
    error: str,
    prompt_version: str | None,
    source_model: str,
) -> None:
    candidate = QuestionCandidate(
        topic=topic,
        difficulty=difficulty,
        type=qtype or "unknown",
        payload_json={"error": "parse_failed"},
        status="failed",
        validation_report_json={"error": error},
        raw_ai_output=raw_output,
        prompt_version=prompt_version,
        source_model=source_model,
    )
    session.add(candidate)
    await session.commit()
    await session.refresh(candidate)


async def create_candidates_from_items(
    session: AsyncSession,
    items: list[Any],
    fallback_topic: str,
    fallback_difficulty: str,
    fallback_type: str | None,
    prompt_version: str | None,
    source_model: str,
) -> tuple[list[str], int]:
    created_ids: list[str] = []
    failed = 0

    for item in items:
        if not isinstance(item, dict):
            failed += 1
            continue

        if _missing_required_fields(item):
            failed += 1
            candidate = QuestionCandidate(
                topic=fallback_topic,
                difficulty=fallback_difficulty,
                type=fallback_type or "unknown",
                payload_json=item,
                status="failed",
                validation_report_json={"error": "missing required fields"},
                raw_ai_output=None,
                prompt_version=prompt_version,
                source_model=source_model,
            )
            session.add(candidate)
            continue

        candidate = QuestionCandidate(
            topic=str(item.get("topic")),
            difficulty=str(item.get("difficulty")),
            type=str(item.get("type")),
            payload_json=item,
            status="generated",
            prompt_version=prompt_version,
            source_model=source_model,
        )
        session.add(candidate)
        await session.flush()
        created_ids.append(str(candidate.id))

    await session.commit()
    return created_ids, failed


def _stable_string(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    ordered_choices = None
    if isinstance(choices, list):
        ordered_choices = sorted(
            choices,
            key=lambda item: (item.get("key") or "", item.get("text") or ""),
        )
    data = {
        "topic": payload.get("topic"),
        "difficulty": payload.get("difficulty"),
        "type": payload.get("type"),
        "prompt": payload.get("prompt"),
        "choices": ordered_choices,
        "answer": payload.get("answer"),
        "code": payload.get("code"),
        "expected_output": payload.get("expected_output"),
    }
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _simhash64(text: str) -> str:
    tokens = text.split()
    if not tokens:
        tokens = [text]
    bits = [0] * 64
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        value = int.from_bytes(digest[:8], "big")
        for idx in range(64):
            bits[idx] += 1 if value & (1 << idx) else -1
    result = 0
    for idx, score in enumerate(bits):
        if score >= 0:
            result |= 1 << idx
    return f"{result:016x}"


def _question_to_payload(question: Question) -> dict[str, Any]:
    return {
        "topic": str(question.topic),
        "difficulty": str(question.difficulty),
        "type": str(question.type),
        "prompt": question.prompt,
        "choices": [
            {"key": key, "text": text}
            for key, text in (question.choices or {}).items()
        ] if question.choices else None,
        "answer": question.correct_answer,
        "code": None,
        "expected_output": None,
    }


async def _run_code_check(code: str, expected_output: str) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        try:
            completed = subprocess.run(
                ["python", "-I", "-c", code],
                capture_output=True,
                text=True,
                timeout=2,
            )
            stdout = (completed.stdout or "")[:10000]
            stderr = (completed.stderr or "")[:10000]
            return {
                "exit_code": completed.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "timeout": False,
            }
        except subprocess.TimeoutExpired as exc:
            stdout = (exc.stdout or "")[:10000] if exc.stdout else ""
            stderr = (exc.stderr or "")[:10000] if exc.stderr else ""
            return {
                "exit_code": None,
                "stdout": stdout,
                "stderr": stderr,
                "timeout": True,
            }

    result = await asyncio.to_thread(_run)
    ok = (
        not result["timeout"]
        and result["exit_code"] == 0
        and result["stdout"].strip() == expected_output.strip()
    )
    return {"ok": ok, **result}


async def validate_candidate(
    session: AsyncSession,
    candidate: QuestionCandidate,
) -> QuestionCandidate:
    schema_ok, normalized, errors = validate_candidate_payload(candidate.payload_json)
    report: dict[str, Any] = {"schema": {"ok": schema_ok, "errors": errors}}

    if not schema_ok or normalized is None:
        candidate.status = "failed"
        candidate.validation_report_json = report
        await session.commit()
        await session.refresh(candidate)
        return candidate

    stable = _stable_string(normalized)
    simhash = _simhash64(stable)
    candidate.simhash = simhash

    duplicate_candidate = await session.execute(
        select(QuestionCandidate)
        .where(
            QuestionCandidate.simhash == simhash,
            QuestionCandidate.status.in_(_DEDUP_STATUSES),
            QuestionCandidate.id != candidate.id,
        )
        .limit(1)
    )
    duplicate_row = duplicate_candidate.scalar_one_or_none()
    if duplicate_row:
        report["dedupe"] = {
            "ok": False,
            "reason": "duplicate_candidate",
            "candidate_id": str(duplicate_row.id),
        }
        candidate.status = "failed"
        candidate.validation_report_json = report
        await session.commit()
        await session.refresh(candidate)
        return candidate

    questions = await session.execute(select(Question))
    for question in questions.scalars().all():
        question_payload = _question_to_payload(question)
        question_hash = _simhash64(_stable_string(question_payload))
        if question_hash == simhash:
            report["dedupe"] = {
                "ok": False,
                "reason": "duplicate_question",
                "question_id": str(question.id),
            }
            candidate.status = "failed"
            candidate.validation_report_json = report
            await session.commit()
            await session.refresh(candidate)
            return candidate

    report["dedupe"] = {"ok": True}

    if normalized.get("type") == "code_output":
        code_report = await _run_code_check(
            normalized.get("code") or "",
            normalized.get("expected_output") or "",
        )
        report["code_output"] = code_report
        if not code_report.get("ok"):
            candidate.status = "failed"
            candidate.validation_report_json = report
            await session.commit()
            await session.refresh(candidate)
            return candidate

    candidate.status = "validated"
    candidate.validation_report_json = report
    await session.commit()
    await session.refresh(candidate)
    return candidate


async def validate_candidate_by_id(
    session: AsyncSession,
    candidate_id: str,
) -> QuestionCandidate | None:
    result = await session.execute(
        select(QuestionCandidate).where(QuestionCandidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        return None
    if candidate.status in _DEDUP_STATUSES:
        return candidate
    return await validate_candidate(session, candidate)


async def validate_candidates_batch(
    session: AsyncSession,
    limit: int,
) -> list[QuestionCandidate]:
    result = await session.execute(
        select(QuestionCandidate)
        .where(QuestionCandidate.status == "generated")
        .order_by(QuestionCandidate.created_at.asc())
        .limit(limit)
    )
    items = result.scalars().all()
    validated: list[QuestionCandidate] = []
    for candidate in items:
        validated.append(await validate_candidate(session, candidate))
    return validated
