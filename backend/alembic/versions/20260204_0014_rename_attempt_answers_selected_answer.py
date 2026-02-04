"""rename attempt answer column

Revision ID: 20260204_0014
Revises: 20260204_0013
Create Date: 2026-02-04 
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260204_0014"
down_revision = "20260204_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("attempt_answers", "user_answer", new_column_name="selected_answer")


def downgrade() -> None:
    op.alter_column("attempt_answers", "selected_answer", new_column_name="user_answer")
