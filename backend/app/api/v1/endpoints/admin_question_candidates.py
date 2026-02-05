from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.services.auth_service import get_admin_user
from app.integrations.question_candidates_chain import (
    generate_question_candidates,
    parse_candidates_json,
)
from app.services.question_candidates_service import (
    create_candidates_from_items,
    record_parse_failure,
    validate_candidate_by_id,
    validate_candidates_batch,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/question-candidates", tags=["admin"])


class QuestionCandidateGenerateRequest(BaseModel):
    topic: str
    difficulty: str
    n: int = Field(ge=20, le=50)
    type: str | None = None
    prompt_version: str | None = None


@router.post("/generate")
async def generate_question_candidates_endpoint(
    body: QuestionCandidateGenerateRequest,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq not configured")

    payload = {
        "count": body.n,
        "topic": body.topic,
        "difficulty": body.difficulty,
        "qtype": body.type or "mixed",
    }

    raw_output = await generate_question_candidates(payload)

    try:
        items = parse_candidates_json(raw_output)
    except Exception as exc:
        logger.warning("question candidate parse failed: %s", exc)
        await record_parse_failure(
            session=session,
            topic=body.topic,
            difficulty=body.difficulty,
            qtype=body.type,
            raw_output=raw_output,
            error=str(exc),
            prompt_version=body.prompt_version,
            source_model=settings.GROQ_MODEL,
        )
        return {"created": 0, "failed": 1, "candidate_ids": []}

    created_ids, failed = await create_candidates_from_items(
        session=session,
        items=items,
        fallback_topic=body.topic,
        fallback_difficulty=body.difficulty,
        fallback_type=body.type,
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
