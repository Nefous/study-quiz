"""add foreign keys to hint_usages

Revision ID: 20260216_0023
Revises: 20260206_0022
Create Date: 2026-02-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260216_0023"
down_revision: Union[str, None] = "20260206_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE hint_usages SET attempt_id = NULL "
            "WHERE attempt_id IS NOT NULL "
            "AND attempt_id NOT IN (SELECT id FROM quiz_attempts)"
        )
    )
    op.execute(
        sa.text(
            "DELETE FROM hint_usages "
            "WHERE question_id NOT IN (SELECT id FROM questions)"
        )
    )

    op.execute(
        sa.text(
            "ALTER TABLE hint_usages "
            "ADD CONSTRAINT fk_hint_usages_attempt_id "
            "FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) "
            "ON DELETE SET NULL"
        )
    )

    op.execute(
        sa.text(
            "ALTER TABLE hint_usages "
            "ADD CONSTRAINT fk_hint_usages_question_id "
            "FOREIGN KEY (question_id) REFERENCES questions(id) "
            "ON DELETE CASCADE"
        )
    )


def downgrade() -> None:
    op.drop_constraint("fk_hint_usages_question_id", "hint_usages", type_="foreignkey")
    op.drop_constraint("fk_hint_usages_attempt_id", "hint_usages", type_="foreignkey")
