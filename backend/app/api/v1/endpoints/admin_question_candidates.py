from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.services.auth_service import get_admin_user
from app.integrations.question_candidates_chain import (
    generate_question_candidates,
    generate_question_candidates_items,
    CandidateParseError,
    parse_candidates_json,
)
from app.services.question_candidates_service import (
    approve_candidate,
    create_candidates_from_items,
    get_candidate_by_id,
    list_candidates,
    publish_candidate,
    reject_candidate,
    record_parse_failure,
    validate_candidate_by_id,
    validate_candidates_batch,
    update_candidate_payload,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/question-candidates", tags=["admin"])


class QuestionCandidateGenerateRequest(BaseModel):
    topic: str | None = None
    difficulty: str
    count: int = Field(default=20, ge=5, le=50)
    qtype: str | None = None
    n: int | None = None
    type: str | None = None
    prompt_version: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _normalize_legacy(cls, values):
        if not isinstance(values, dict):
            return values
        data = dict(values)
        if data.get("count") is None and data.get("n") is not None:
            data["count"] = data.get("n")
        if data.get("qtype") is None and data.get("type") is not None:
            data["qtype"] = data.get("type")
        return data


class QuestionCandidateRejectRequest(BaseModel):
    reason: str | None = None


class QuestionCandidateUpdateRequest(BaseModel):
    payload_json: dict


@router.post("/generate")
async def generate_question_candidates_endpoint(
    body: QuestionCandidateGenerateRequest,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq not configured")

    topic = body.topic or "random"
    qtype = body.qtype or "mixed"
    payload = {
        "count": body.count,
        "topic": topic,
        "difficulty": body.difficulty,
        "qtype": qtype,
    }

    try:
        items = await generate_question_candidates_items(payload)
    except CandidateParseError as exc:
        logger.warning("question candidate parse failed: %s", exc)
        await record_parse_failure(
            session=session,
            topic=topic,
            difficulty=body.difficulty,
            qtype=qtype,
            raw_output=exc.raw_output,
            error=str(exc),
            prompt_version=body.prompt_version,
            source_model=settings.GROQ_MODEL,
        )
        return {"created": 0, "failed": 1, "candidate_ids": []}
    except Exception as exc:
        logger.warning("question candidate parse failed: %s", exc)
        await record_parse_failure(
            session=session,
            topic=topic,
            difficulty=body.difficulty,
            qtype=qtype,
            raw_output=None,
            error=str(exc),
            prompt_version=body.prompt_version,
            source_model=settings.GROQ_MODEL,
        )
        return {"created": 0, "failed": 1, "candidate_ids": []}

    created_ids, failed = await create_candidates_from_items(
        session=session,
        items=items,
        fallback_topic=topic,
        fallback_difficulty=body.difficulty,
        fallback_type=body.qtype,
        prompt_version=body.prompt_version,
        source_model=settings.GROQ_MODEL,
    )
    return {"created": len(created_ids), "failed": failed, "candidate_ids": created_ids}


@router.post("/{candidate_id}/validate")
async def validate_question_candidate(
    candidate_id: str,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    candidate = await validate_candidate_by_id(session, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {
        "id": str(candidate.id),
        "status": candidate.status,
        "validation_report": candidate.validation_report_json,
        "simhash": candidate.simhash,
    }


@router.post("/validate-batch")
async def validate_question_candidates_batch(
    limit: int = 50,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    items = await validate_candidates_batch(session, limit)
    return {
        "validated": len([item for item in items if item.status == "validated"]),
        "failed": len([item for item in items if item.status == "failed"]),
        "candidate_ids": [str(item.id) for item in items],
    }


@router.get("")
async def list_question_candidates(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    items = await list_candidates(session, status, limit, offset)
    return [
        {
            "id": str(item.id),
            "topic": item.topic,
            "difficulty": item.difficulty,
            "type": item.type,
            "status": item.status,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "approved_by_user_id": str(item.approved_by_user_id) if item.approved_by_user_id else None,
            "approved_at": item.approved_at,
            "published_at": item.published_at,
            "payload_json": item.payload_json,
            "validation_report_json": item.validation_report_json,
        }
        for item in items
    ]


@router.post("/{candidate_id}/approve")
async def approve_question_candidate(
    candidate_id: str,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    candidate = await get_candidate_by_id(session, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status not in {"generated", "validated"}:
        raise HTTPException(status_code=400, detail="Invalid candidate status")
    if candidate.status == "generated":
        candidate = await validate_candidate_by_id(session, candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
    candidate = await approve_candidate(session, candidate, user.id)
    if candidate.status != "approved":
        raise HTTPException(status_code=400, detail="Candidate failed validation")
    return {
        "id": str(candidate.id),
        "status": candidate.status,
        "approved_by_user_id": str(candidate.approved_by_user_id),
        "approved_at": candidate.approved_at,
    }


@router.post("/{candidate_id}/reject")
async def reject_question_candidate(
    candidate_id: str,
    body: QuestionCandidateRejectRequest,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    candidate = await get_candidate_by_id(session, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status not in {"generated", "validated", "approved"}:
        raise HTTPException(status_code=400, detail="Invalid candidate status")
    candidate = await reject_candidate(session, candidate, user.id, body.reason)
    return {
        "id": str(candidate.id),
        "status": candidate.status,
        "validation_report": candidate.validation_report_json,
    }


@router.post("/{candidate_id}/publish")
async def publish_question_candidate(
    candidate_id: str,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    candidate = await get_candidate_by_id(session, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status not in {"approved", "published"} and candidate.published_at is None:
        raise HTTPException(status_code=400, detail="Candidate must be approved")
    candidate, question_id = await publish_candidate(session, candidate)
    if candidate.status != "published":
        raise HTTPException(status_code=400, detail="Candidate publish failed")
    return {
        "candidate": {
            "id": str(candidate.id),
            "status": candidate.status,
            "published_at": candidate.published_at,
        },
        "created_question_id": question_id,
    }


@router.patch("/{candidate_id}")
async def update_question_candidate(
    candidate_id: str,
    body: QuestionCandidateUpdateRequest,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    candidate = await get_candidate_by_id(session, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status not in {"generated", "validated", "failed"}:
        raise HTTPException(status_code=400, detail="Candidate cannot be edited")
    candidate = await update_candidate_payload(session, candidate, body.payload_json)
    return {
        "id": str(candidate.id),
        "status": candidate.status,
    }
