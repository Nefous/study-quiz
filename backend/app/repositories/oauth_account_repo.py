from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oauth_account import OAuthAccount


class OAuthAccountRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_provider_user_id(self, provider: str, provider_user_id: str) -> OAuthAccount | None:
        stmt = select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_provider(self, user_id, provider: str) -> OAuthAccount | None:
        stmt = select(OAuthAccount).where(
            OAuthAccount.user_id == user_id,
            OAuthAccount.provider == provider,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self,
        user_id,
        provider: str,
        provider_user_id: str,
        email: str | None = None,
    ) -> OAuthAccount:
        existing = await self.get_by_provider_user_id(provider, provider_user_id)
        if existing:
            if email and existing.email != email:
                existing.email = email
                await self.session.commit()
                await self.session.refresh(existing)
            return existing

        account = OAuthAccount(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
        )
        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)
        return account
