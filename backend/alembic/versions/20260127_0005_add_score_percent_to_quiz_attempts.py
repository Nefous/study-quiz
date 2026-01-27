"""add score_percent to quiz_attempts

Revision ID: 20260127_0005
Revises: 20260127_0004
Create Date: 2026-01-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260127_0005"
down_revision: Union[str, None] = "20260127_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quiz_attempts", sa.Column("score_percent", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE quiz_attempts SET score_percent = ROUND((correct_count::numeric / NULLIF(total_count, 0)) * 100)"
    )
    op.alter_column("quiz_attempts", "score_percent", nullable=False)


def downgrade() -> None:
    op.drop_column("quiz_attempts", "score_percent")
