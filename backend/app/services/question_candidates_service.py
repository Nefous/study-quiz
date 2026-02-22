from __future__ import annotations

import hashlib
import io
import json
import asyncio
import re
import signal
import threading
from typing import Any

from datetime import datetime, timezone
from sqlalchemy import select, and_, or_
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


_CODE_FENCE_RE = re.compile(r"```(?:\w+)?\n([\s\S]*?)```")


def _split_prompt_code(prompt: str) -> tuple[str, str | None]:
    match = _CODE_FENCE_RE.search(prompt)
    if not match:
        return prompt, None
    code = match.group(1).strip("\n")
    before = prompt[: match.start()].strip()
    after = prompt[match.end() :].strip()
    parts = [part for part in (before, after) if part]
    normalized_prompt = "\n\n".join(parts)
    return normalized_prompt, code


def _question_to_payload(question: Question) -> dict[str, Any]:
    prompt = question.prompt
    code = question.code
    if str(question.type) == "code_output":
        prompt, extracted = _split_prompt_code(prompt)
        if not code and extracted:
            code = extracted
    return {
        "topic": str(question.topic),
        "difficulty": str(question.difficulty),
        "type": str(question.type),
        "prompt": prompt,
        "choices": [
            {"key": key, "text": text}
            for key, text in (question.choices or {}).items()
        ] if question.choices else None,
        "answer": question.correct_answer,
        "code": code,
        "expected_output": None,
    }


_SAFE_BUILTINS = {
    "abs": abs, "all": all, "any": any, "bin": bin, "bool": bool,
    "bytes": bytes, "chr": chr, "dict": dict, "divmod": divmod,
    "enumerate": enumerate, "filter": filter, "float": float,
    "format": format, "frozenset": frozenset, "hash": hash, "hex": hex,
    "int": int, "isinstance": isinstance, "issubclass": issubclass,
    "iter": iter, "len": len, "list": list, "map": map, "max": max,
    "min": min, "next": next, "oct": oct, "ord": ord, "pow": pow,
    "print": print, "range": range, "repr": repr, "reversed": reversed,
    "round": round, "set": set, "slice": slice, "sorted": sorted,
    "str": str, "sum": sum, "tuple": tuple, "type": type, "zip": zip,
    "True": True, "False": False, "None": None,
}


async def _run_code_check(code: str, expected_output: str) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        stdout_capture = io.StringIO()
        restricted_globals = {"__builtins__": _SAFE_BUILTINS.copy()}
        restricted_globals["__builtins__"]["print"] = (
            lambda *args, **kwargs: print(
                *args, **{**kwargs, "file": stdout_capture}
            )
        )
        result: dict[str, Any] = {
            "exit_code": None, "stdout": "", "stderr": "", "timeout": False,
        }
        done = threading.Event()

        def _exec_target() -> None:
            try:
                exec(code, restricted_globals)  # noqa: S102
                result["exit_code"] = 0
            except Exception as exc:
                result["exit_code"] = 1
                result["stderr"] = str(exc)[:10000]
            finally:
                result["stdout"] = stdout_capture.getvalue()[:10000]
                done.set()

        thread = threading.Thread(target=_exec_target, daemon=True)
        thread.start()
        finished = done.wait(timeout=2)
        if not finished:
            result["timeout"] = True
        return result

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

    dup_q_result = await session.execute(
        select(Question).where(Question.simhash == simhash).limit(1)
    )
    dup_question = dup_q_result.scalar_one_or_none()
    if dup_question:
        report["dedupe"] = {
            "ok": False,
            "reason": "duplicate_question",
            "question_id": str(dup_question.id),
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


async def get_candidate_by_id(
    session: AsyncSession,
    candidate_id: str,
) -> QuestionCandidate | None:
    result = await session.execute(
        select(QuestionCandidate).where(QuestionCandidate.id == candidate_id)
    )
    return result.scalar_one_or_none()


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


def _merge_report(report: dict | None, patch: dict) -> dict:
    base = report.copy() if isinstance(report, dict) else {}
    base.update(patch)
    return base


async def list_candidates(
    session: AsyncSession,
    status: str | None,
    limit: int,
    offset: int,
) -> list[QuestionCandidate]:
    stmt = select(QuestionCandidate).order_by(QuestionCandidate.created_at.desc())
    if status:
        stmt = stmt.where(QuestionCandidate.status == status)
    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    return result.scalars().all()


async def approve_candidate(
    session: AsyncSession,
    candidate: QuestionCandidate,
    user_id,
) -> QuestionCandidate:
    if candidate.status == "generated":
        candidate = await validate_candidate(session, candidate)
    if candidate.status not in {"validated", "generated"}:
        return candidate
    if candidate.status == "generated":
        return candidate
    candidate.status = "approved"
    candidate.approved_by_user_id = user_id
    candidate.approved_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(candidate)
    return candidate


async def reject_candidate(
    session: AsyncSession,
    candidate: QuestionCandidate,
    user_id,
    reason: str | None,
) -> QuestionCandidate:
    moderation = {
        "rejected": True,
        "reason": reason,
        "at": datetime.now(timezone.utc).isoformat(),
        "by": str(user_id),
    }
    candidate.validation_report_json = _merge_report(
        candidate.validation_report_json,
        {"moderation": moderation},
    )
    candidate.status = "rejected"
    await session.commit()
    await session.refresh(candidate)
    return candidate


def _payload_to_question_fields(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = payload.get("prompt") or ""
    qtype = payload.get("type")
    code = payload.get("code")
    if qtype == "code_output":
        prompt, extracted = _split_prompt_code(prompt)
        if not code and extracted:
            code = extracted
    choices = None
    if qtype == "mcq":
        choices = {
            item.get("key"): item.get("text")
            for item in (payload.get("choices") or [])
            if item.get("key")
        }
    return {
        "topic": payload.get("topic"),
        "difficulty": payload.get("difficulty"),
        "type": qtype,
        "prompt": prompt,
        "code": code,
        "choices": choices,
        "correct_answer": payload.get("answer") or payload.get("expected_output") or "",
        "explanation": payload.get("explanation"),
    }


async def publish_candidate(
    session: AsyncSession,
    candidate: QuestionCandidate,
) -> tuple[QuestionCandidate, str | None]:
    if candidate.status == "published" or candidate.published_at is not None:
        report = candidate.validation_report_json or {}
        published = report.get("published") if isinstance(report, dict) else None
        question_id = (published or {}).get("question_id") if published else None
        if question_id:
            return candidate, question_id
        ok, normalized, _ = validate_candidate_payload(candidate.payload_json)
        if ok and normalized:
            fields = _payload_to_question_fields(normalized)
            existing_stmt = select(Question).where(
                Question.topic == fields["topic"],
                Question.difficulty == fields["difficulty"],
                Question.type == fields["type"],
                Question.correct_answer == fields["correct_answer"],
            )
            if fields.get("type") == "code_output":
                prompt = fields["prompt"] or ""
                code = fields.get("code") or ""
                legacy_prompt = prompt
                if code and "```" not in prompt:
                    legacy_prompt = f"{prompt}\n\n```python\n{code}\n```"
                if legacy_prompt != prompt:
                    existing_stmt = existing_stmt.where(
                        or_(
                            and_(Question.prompt == prompt, Question.code == code),
                            Question.prompt == legacy_prompt,
                        )
                    )
                else:
                    existing_stmt = existing_stmt.where(
                        and_(Question.prompt == prompt, Question.code == code)
                    )
            else:
                existing_stmt = existing_stmt.where(Question.prompt == fields["prompt"])
            existing = await session.execute(existing_stmt)
            question = existing.scalar_one_or_none()
            if question:
                candidate.validation_report_json = _merge_report(
                    candidate.validation_report_json,
                    {"published": {"question_id": str(question.id)}},
                )
                await session.commit()
                await session.refresh(candidate)
                return candidate, str(question.id)
        return candidate, None

    if candidate.status != "approved":
        return candidate, None

    ok, normalized, errors = validate_candidate_payload(candidate.payload_json)
    if not ok or normalized is None:
        candidate.status = "failed"
        candidate.validation_report_json = _merge_report(
            candidate.validation_report_json,
            {"schema": {"ok": False, "errors": errors}},
        )
        await session.commit()
        await session.refresh(candidate)
        return candidate, None

    fields = _payload_to_question_fields(normalized)
    existing_stmt = select(Question).where(
        Question.topic == fields["topic"],
        Question.difficulty == fields["difficulty"],
        Question.type == fields["type"],
        Question.correct_answer == fields["correct_answer"],
    )
    if fields.get("type") == "code_output":
        prompt = fields["prompt"] or ""
        code = fields.get("code") or ""
        legacy_prompt = prompt
        if code and "```" not in prompt:
            legacy_prompt = f"{prompt}\n\n```python\n{code}\n```"
        if legacy_prompt != prompt:
            existing_stmt = existing_stmt.where(
                or_(
                    and_(Question.prompt == prompt, Question.code == code),
                    Question.prompt == legacy_prompt,
                )
            )
        else:
            existing_stmt = existing_stmt.where(
                and_(Question.prompt == prompt, Question.code == code)
            )
    else:
        existing_stmt = existing_stmt.where(Question.prompt == fields["prompt"])
    existing = await session.execute(existing_stmt)
    question = existing.scalar_one_or_none()
    if not question:
        seed_payload = f"{fields['topic']}|{fields['difficulty']}|{fields['type']}|{fields['prompt']}|{fields.get('code') or ''}"
        seed_key = hashlib.sha256(seed_payload.encode("utf-8")).hexdigest()[:64]
        q_simhash = _simhash64(_stable_string(normalized))
        question = Question(**fields, seed_key=seed_key, simhash=q_simhash)
        session.add(question)
        await session.flush()

    candidate.status = "published"
    candidate.published_at = datetime.now(timezone.utc)
    candidate.validation_report_json = _merge_report(
        candidate.validation_report_json,
        {"published": {"question_id": str(question.id)}},
    )
    await session.commit()
    await session.refresh(candidate)
    return candidate, str(question.id)


async def update_candidate_payload(
    session: AsyncSession,
    candidate: QuestionCandidate,
    payload_json: dict[str, Any],
) -> QuestionCandidate:
    candidate.payload_json = payload_json
    candidate.status = "generated"
    candidate.simhash = None
    candidate.validation_report_json = None
    candidate.approved_at = None
    candidate.approved_by_user_id = None
    candidate.published_at = None
    await session.commit()
    await session.refresh(candidate)
    return candidate
