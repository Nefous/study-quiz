"""add submitted_at to quiz attempts

Revision ID: 20260204_0017
Revises: 20260204_0016
Create Date: 2026-02-04 
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260204_0017"
down_revision = "20260204_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quiz_attempts", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE quiz_attempts SET submitted_at = finished_at WHERE finished_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column("quiz_attempts", "submitted_at")
