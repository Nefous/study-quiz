"""add attempt type to quiz attempts

Revision ID: 20260204_0015
Revises: 20260204_0014
Create Date: 2026-02-04 
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260204_0015"
down_revision = "20260204_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quiz_attempts",
        sa.Column("attempt_type", sa.String(length=20), nullable=False, server_default="normal"),
    )
    op.execute(
        "UPDATE quiz_attempts SET attempt_type='mistakes_review', mode='practice' WHERE mode='mistakes_review'"
    )
    op.execute("UPDATE quiz_attempts SET attempt_type='normal' WHERE attempt_type IS NULL")
    op.alter_column("quiz_attempts", "attempt_type", server_default=None)


def downgrade() -> None:
    op.drop_column("quiz_attempts", "attempt_type")
