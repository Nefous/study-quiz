"""fix user admin default

Revision ID: 20260205_0020
Revises: 20260205_0019
Create Date: 2026-02-05
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260205_0020"
down_revision = "20260205_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    default_false = sa.text("0") if is_sqlite else sa.text("false")

    if is_sqlite:
        op.execute("UPDATE users SET is_admin = 0 WHERE is_admin IS NULL")
        with op.batch_alter_table("users") as batch:
            batch.alter_column(
                "is_admin",
                existing_type=sa.Boolean(),
                nullable=False,
                server_default=default_false,
            )
    else:
        op.execute("UPDATE users SET is_admin = false WHERE is_admin IS NULL")
        op.alter_column(
            "users",
            "is_admin",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=default_false,
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    if is_sqlite:
        with op.batch_alter_table("users") as batch:
            batch.alter_column(
                "is_admin",
                existing_type=sa.Boolean(),
                nullable=False,
                server_default=None,
            )
    else:
        op.alter_column(
            "users",
            "is_admin",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=None,
        )
