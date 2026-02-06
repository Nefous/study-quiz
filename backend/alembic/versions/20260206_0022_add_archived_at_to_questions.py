"""add archived_at to questions

Revision ID: 20260206_0022
Revises: 20260206_0021
Create Date: 2026-02-06
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260206_0022"
down_revision = "20260206_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    if is_sqlite:
        with op.batch_alter_table("questions") as batch:
            batch.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    else:
        op.add_column("questions", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("idx_questions_archived_at", "questions", ["archived_at"])


def downgrade() -> None:
    op.drop_index("idx_questions_archived_at", table_name="questions")
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    if is_sqlite:
        with op.batch_alter_table("questions") as batch:
            batch.drop_column("archived_at")
    else:
        op.drop_column("questions", "archived_at")
