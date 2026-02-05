from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.repositories.user_repo import UserRepository
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


@router.post("/bootstrap")
async def bootstrap_admin(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if settings.ENV.lower() not in {"dev", "development", "local"}:
        raise HTTPException(status_code=404, detail="Not available")
    email = (user.email or "").lower()
    if not settings.ADMIN_EMAILS or email not in settings.ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")

    repo = UserRepository(session)
    db_user = await repo.get_by_id(user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.is_admin = True
    db_user.role = db_user.role or "admin"
    await session.commit()
    await session.refresh(db_user)
    return {
        "id": str(db_user.id),
        "email": db_user.email,
        "is_admin": db_user.is_admin,
        "role": db_user.role,
    }
