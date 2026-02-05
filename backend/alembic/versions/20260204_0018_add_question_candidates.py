"""add question candidates

Revision ID: 20260204_0018
Revises: 20260204_0017
Create Date: 2026-02-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260204_0018"
down_revision = "20260204_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    json_type = sa.JSON() if is_sqlite else postgresql.JSONB()
    op.create_table(
        "question_candidates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("topic", sa.String(length=50), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("payload_json", json_type, nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="generated"),
        sa.Column("validation_report_json", json_type, nullable=True),
        sa.Column("raw_ai_output", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.String(length=50), nullable=True),
        sa.Column("source_model", sa.String(length=80), nullable=True),
        sa.Column("simhash", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("approved_by_user_id", sa.UUID(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    if is_sqlite:
        op.create_index(
            "idx_question_candidates_status_created_at",
            "question_candidates",
            ["status", "created_at"],
        )
    else:
        op.create_index(
            "idx_question_candidates_status_created_at",
            "question_candidates",
            [sa.text("status"), sa.text("created_at DESC")],
        )
    op.create_index(
        "idx_question_candidates_simhash",
        "question_candidates",
        ["simhash"],
    )
    op.alter_column("question_candidates", "status", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_question_candidates_simhash", table_name="question_candidates")
    op.drop_index("idx_question_candidates_status_created_at", table_name="question_candidates")
    op.drop_table("question_candidates")
