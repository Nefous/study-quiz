"""add question favorites

Revision ID: 20260204_0011
Revises: 20260201_0010
Create Date: 2026-02-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260204_0011"
down_revision = "20260201_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_favorites",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id", "question_id"),
        sa.UniqueConstraint(
            "user_id",
            "question_id",
            name="uq_question_favorites_user_question",
        ),
    )


def downgrade() -> None:
    op.drop_table("question_favorites")
