"""add user admin fields

Revision ID: 20260205_0019
Revises: 20260204_0018
Create Date: 2026-02-05
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260205_0019"
down_revision = "20260204_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    default_false = sa.text("0") if is_sqlite else sa.text("false")

    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=default_false),
    )
    op.add_column("users", sa.Column("role", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "role")
    op.drop_column("users", "is_admin")
