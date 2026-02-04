"""unique in-progress mistakes attempt per user

Revision ID: 20260204_0016
Revises: 20260204_0015
Create Date: 2026-02-04
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260204_0016"
down_revision = "20260204_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked AS (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
          FROM quiz_attempts
          WHERE attempt_type = 'mistakes_review' AND finished_at IS NULL
        )
        UPDATE quiz_attempts
        SET finished_at = now()
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
        """
    )
    op.create_index(
        "ux_attempts_user_mistakes_in_progress",
        "quiz_attempts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("attempt_type = 'mistakes_review' AND finished_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_attempts_user_mistakes_in_progress", table_name="quiz_attempts")
