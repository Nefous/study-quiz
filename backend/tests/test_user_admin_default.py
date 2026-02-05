import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.repositories.user_repo import UserRepository


@pytest.fixture()
async def async_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_user_is_admin_default(async_session):
    repo = UserRepository(async_session)
    user = await repo.create(email="user@example.com", password_hash=None)
    assert user.is_admin is False
