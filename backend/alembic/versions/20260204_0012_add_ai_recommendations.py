"""add ai recommendations

Revision ID: 20260204_0012
Revises: 20260204_0011
Create Date: 2026-02-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260204_0012"
down_revision = "20260204_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_recommendations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("topic", sa.String(length=50), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("tips_json", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("attempt_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["attempt_id"], ["quiz_attempts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_recommendations_user_status",
        "ai_recommendations",
        ["user_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_recommendations_user_status", table_name="ai_recommendations")
    op.drop_table("ai_recommendations")
