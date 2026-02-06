from __future__ import annotations

import os
import sys
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _apply_env_defaults() -> None:
    os.environ.setdefault("SECRET_KEY", "test-secret")
    os.environ.setdefault("ENV", "local")

    if not os.environ.get("JWT_PRIVATE_KEY_PATH"):
        private_path = REPO_ROOT / "jwt_private.pem"
        if private_path.exists():
            os.environ["JWT_PRIVATE_KEY_PATH"] = str(private_path)

    if not os.environ.get("JWT_PUBLIC_KEY_PATH"):
        public_path = REPO_ROOT / "jwt_public.pem"
        if public_path.exists():
            os.environ["JWT_PUBLIC_KEY_PATH"] = str(public_path)


_apply_env_defaults()


@pytest.fixture(scope="session")
def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL is required for integration tests")
    return url


@pytest.fixture(scope="session", autouse=True)
def apply_migrations(database_url: str) -> None:
    from app.core.config import get_settings

    get_settings.cache_clear()
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(alembic_cfg, "head")


@pytest_asyncio.fixture(scope="session")
async def async_engine(database_url: str):
    engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture()
async def db_session(async_engine) -> AsyncSession:
    session_maker = async_sessionmaker(async_engine, expire_on_commit=False)
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def truncate_db(async_engine) -> None:
    from app.db.base import Base
    import app.models  # noqa: F401

    table_names = [table.name for table in Base.metadata.sorted_tables]
    if not table_names:
        return
    quoted = ", ".join(f'"{name}"' for name in table_names)
    async with async_engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))


@pytest.fixture(scope="session")
def app_instance(database_url: str):
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.main import app

    return app


@pytest_asyncio.fixture()
async def async_client(app_instance):
    transport = ASGITransport(app=app_instance, lifespan="off")
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture()
async def auth_headers(async_client) -> dict[str, str]:
    email = f"user_{uuid4().hex}@example.com"
    response = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
