"""add meta to quiz_attempts

Revision ID: 20260127_0006
Revises: 20260127_0005
Create Date: 2026-01-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260127_0006"
down_revision: Union[str, None] = "20260127_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quiz_attempts",
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quiz_attempts", "meta")
