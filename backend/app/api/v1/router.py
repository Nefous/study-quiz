from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.hints import router as hints_router
from app.api.v1.endpoints.meta import router as meta_router
from app.api.v1.endpoints.attempts import router as attempts_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.questions import router as questions_router
from app.api.v1.endpoints.quiz import router as quiz_router
from app.api.v1.endpoints.recommendations import router as recommendations_router
from app.api.v1.endpoints.admin_question_candidates import router as admin_question_candidates_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(meta_router)
api_router.include_router(questions_router, prefix="/questions", tags=["questions"])
api_router.include_router(hints_router)
api_router.include_router(attempts_router)
api_router.include_router(quiz_router, tags=["quiz"])
api_router.include_router(recommendations_router)
api_router.include_router(admin_question_candidates_router)
