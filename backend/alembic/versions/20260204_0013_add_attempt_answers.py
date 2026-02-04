"""add attempt answers

Revision ID: 20260204_0013
Revises: 20260204_0012
Create Date: 2026-02-04
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260204_0013"
down_revision = "20260204_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attempt_answers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("attempt_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("user_answer", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["attempt_id"], ["quiz_attempts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attempt_answers_user_id", "attempt_answers", ["user_id"])
    op.create_index("ix_attempt_answers_question_id", "attempt_answers", ["question_id"])
    op.create_index("ix_attempt_answers_is_correct", "attempt_answers", ["is_correct"])
    op.create_index("ix_attempt_answers_created_at", "attempt_answers", ["created_at"])
    op.create_index(
        "ix_attempt_answers_user_question",
        "attempt_answers",
        ["user_id", "question_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_attempt_answers_user_question", table_name="attempt_answers")
    op.drop_index("ix_attempt_answers_created_at", table_name="attempt_answers")
    op.drop_index("ix_attempt_answers_is_correct", table_name="attempt_answers")
    op.drop_index("ix_attempt_answers_question_id", table_name="attempt_answers")
    op.drop_index("ix_attempt_answers_user_id", table_name="attempt_answers")
    op.drop_table("attempt_answers")
