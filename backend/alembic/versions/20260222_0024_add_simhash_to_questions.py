"""add simhash column to questions

Revision ID: 20260222_0024
Revises: 20260216_0023
Create Date: 2026-02-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260222_0024"
down_revision: Union[str, None] = "20260216_0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column("simhash", sa.String(64), nullable=True),
    )
    op.create_index("ix_questions_simhash", "questions", ["simhash"])


def downgrade() -> None:
    op.drop_index("ix_questions_simhash", table_name="questions")
    op.drop_column("questions", "simhash")
