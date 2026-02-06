from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.admin_questions import (
    AdminQuestionDetail,
    AdminQuestionListItem,
    AdminQuestionListResponse,
)
from app.services.admin_questions_service import (
    archive_question,
    get_question,
    list_questions,
)
from app.services.auth_service import get_admin_user

router = APIRouter(prefix="/admin/questions", tags=["admin"])


@router.get("", response_model=AdminQuestionListResponse)
async def list_admin_questions(
    topic: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    qtype: str | None = Query(default=None, alias="type"),
    q: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> AdminQuestionListResponse:
    items, total = await list_questions(
        session,
        topic=topic,
        difficulty=difficulty,
        qtype=qtype,
        query=q,
        limit=limit,
        offset=offset,
        include_archived=include_archived,
    )
    return AdminQuestionListResponse(
        items=[AdminQuestionListItem.model_validate(item) for item in items],
        total=total,
    )


@router.get("/{question_id}", response_model=AdminQuestionDetail)
async def get_admin_question(
    question_id: UUID,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> AdminQuestionDetail:
    question = await get_question(session, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return AdminQuestionDetail.model_validate(question)


@router.post("/{question_id}/archive", response_model=AdminQuestionDetail)
async def archive_admin_question(
    question_id: UUID,
    user=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> AdminQuestionDetail:
    question = await get_question(session, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question = await archive_question(session, question)
    return AdminQuestionDetail.model_validate(question)
