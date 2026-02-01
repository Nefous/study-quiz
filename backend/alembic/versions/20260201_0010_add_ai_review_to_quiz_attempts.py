"""add ai review fields to quiz_attempts

Revision ID: 20260201_0010
Revises: 20260130_0009
Create Date: 2026-02-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260201_0010"
down_revision: Union[str, None] = "20260130_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quiz_attempts",
        sa.Column("ai_review_json", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "quiz_attempts",
        sa.Column("ai_review_created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quiz_attempts", "ai_review_created_at")
    op.drop_column("quiz_attempts", "ai_review_json")
