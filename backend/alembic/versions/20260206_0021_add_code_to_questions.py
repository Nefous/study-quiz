"""add code to questions

Revision ID: 20260206_0021
Revises: 20260205_0020
Create Date: 2026-02-06
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260206_0021"
down_revision = "20260205_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    if is_sqlite:
        with op.batch_alter_table("questions") as batch:
            batch.add_column(sa.Column("code", sa.Text(), nullable=True))
    else:
        op.add_column("questions", sa.Column("code", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    if is_sqlite:
        with op.batch_alter_table("questions") as batch:
            batch.drop_column("code")
    else:
        op.drop_column("questions", "code")
