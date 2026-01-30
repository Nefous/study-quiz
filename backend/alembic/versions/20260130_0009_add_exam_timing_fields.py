"""add exam timing fields to quiz_attempts

Revision ID: 20260130_0009
Revises: 20260127_0008
Create Date: 2026-01-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260130_0009"
down_revision: Union[str, None] = "20260127_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quiz_attempts", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quiz_attempts", sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quiz_attempts", sa.Column("time_limit_seconds", sa.Integer(), nullable=True))
    op.add_column("quiz_attempts", sa.Column("time_spent_seconds", sa.Integer(), nullable=True))
    op.add_column("quiz_attempts", sa.Column("timed_out", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("quiz_attempts", "timed_out")
    op.drop_column("quiz_attempts", "time_spent_seconds")
    op.drop_column("quiz_attempts", "time_limit_seconds")
    op.drop_column("quiz_attempts", "finished_at")
    op.drop_column("quiz_attempts", "started_at")
