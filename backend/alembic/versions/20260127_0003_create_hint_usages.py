"""create hint usages table

Revision ID: 20260127_0003
Revises: 20260124_0002
Create Date: 2026-01-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260127_0003"
down_revision: Union[str, None] = "20260124_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "hint_usages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("penalty_points", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_hint_usages_created_at", "hint_usages", ["created_at"])
    op.create_index("ix_hint_usages_question_id", "hint_usages", ["question_id"])


def downgrade() -> None:
    op.drop_index("ix_hint_usages_question_id", table_name="hint_usages")
    op.drop_index("ix_hint_usages_created_at", table_name="hint_usages")
    op.drop_table("hint_usages")
