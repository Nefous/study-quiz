"""add oauth accounts

Revision ID: 20260127_0008
Revises: 20260127_0007
Create Date: 2026-01-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260127_0008"
down_revision: Union[str, None] = "20260127_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)

    op.create_table(
        "oauth_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_oauth_accounts_user_id",
        "oauth_accounts",
        ["user_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_oauth_provider_user_id",
        "oauth_accounts",
        ["provider", "provider_user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_oauth_provider_user_id", "oauth_accounts", type_="unique")
    op.drop_index("ix_oauth_accounts_user_id", table_name="oauth_accounts")
    op.drop_table("oauth_accounts")

    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
