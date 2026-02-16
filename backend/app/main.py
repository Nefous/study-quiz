import importlib
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.redis_client import close_redis, get_redis_real
from app.core.logging import configure_logging
from app.seed.seed_questions import seed_if_empty

settings = get_settings()
configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


def _load_fastapi_limiter():
    module = importlib.import_module("fastapi_limiter")
    if hasattr(module, "FastAPILimiter"):
        return module.FastAPILimiter
    for name in ("fastapi_limiter.limiter", "fastapi_limiter.fastapi_limiter"):
        try:
            sub = importlib.import_module(name)
        except ModuleNotFoundError:
            continue
        if hasattr(sub, "FastAPILimiter"):
            return sub.FastAPILimiter
    raise ImportError("FastAPILimiter not found in fastapi_limiter")


FastAPILimiter = _load_fastapi_limiter()

@asynccontextmanager
async def lifespan(app: FastAPI):
    redis = await get_redis_real()
    if redis is None:
        app.state.rate_limit_enabled = False
        logger.warning("Redis unavailable; rate limiting disabled")
    else:
        app.state.rate_limit_enabled = True
        await FastAPILimiter.init(redis)

    # Startup events
    logger.info("CORS origins: %s", settings.CORS_ORIGINS)
    hint_routes = [
        f"{sorted(route.methods or [])} {route.path}"
        for route in app.routes
        if isinstance(route, APIRoute) and "/hint" in route.path
    ]
    logger.info("Hint routes: %s", hint_routes)
    await seed_if_empty()
    logger.info("Application startup complete")
    
    yield
    
    await close_redis()
    logger.info("Application shutting down")


app = FastAPI(
    title="QuizStudy API",
    version="1.0.0",
    lifespan=lifespan  
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

if settings.ENV.lower() in {"dev", "development", "local"}:
    from app.services.auth_service import get_admin_user

    @app.get("/__debug")
    async def debug_info(_admin=Depends(get_admin_user)) -> dict:
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
    logger.warning(
        "validation error path=%s errors=%s body=%s",
        request.url.path,
        exc.errors(),
        exc.body,
    )
    include_details = settings.LOG_LEVEL.lower() == "debug"
    if include_details:
        detail = exc.errors()
    else:
        first_error = exc.errors()[0] if exc.errors() else {}
        detail = first_error.get("msg") or "Invalid request"
    return JSONResponse(
        status_code=400,
        content={"error": {"message": detail, "status": 400}},
    )