import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.routing import APIRoute

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.seed.seed_questions import seed_if_empty

settings = get_settings()
configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

app = FastAPI(title="QuizStudy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/__debug")
async def debug_info() -> dict:
    routes: list[str] = []
    has_hint_route = False
    for route in app.routes:
        if isinstance(route, APIRoute):
            methods = sorted(method for method in route.methods or [] if method != "HEAD")
            for method in methods:
                routes.append(f"{method} {route.path}")
            if "/hint" in route.path:
                has_hint_route = True
    return {
        "api_v1_prefix": settings.API_V1_PREFIX,
        "cors_origins": settings.CORS_ORIGINS,
        "has_hint_route": has_hint_route,
        "routes": routes,
    }


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "status": exc.status_code}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": {"message": "Invalid request", "status": 400}},
    )


@app.on_event("startup")
async def seed_on_startup() -> None:
    logger.info("CORS origins: %s", settings.CORS_ORIGINS)
    hint_routes = [
        f"{sorted(route.methods or [])} {route.path}"
        for route in app.routes
        if isinstance(route, APIRoute) and "/hint" in route.path
    ]
    logger.info("Hint routes: %s", hint_routes)
    await seed_if_empty()
