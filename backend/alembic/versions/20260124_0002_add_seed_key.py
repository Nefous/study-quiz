"""add seed_key to questions

Revision ID: 20260124_0002
Revises: 20260123_0001
Create Date: 2026-01-24
"""

from __future__ import annotations

import hashlib
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260124_0002"
down_revision: Union[str, None] = "20260123_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _compute_seed_key(topic: str, difficulty: str, qtype: str, prompt: str) -> str:
    raw = f"{topic}|{difficulty}|{qtype}|{prompt}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def upgrade() -> None:
    op.add_column("questions", sa.Column("seed_key", sa.String(length=64), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, topic, difficulty, type, prompt FROM questions"
    )).fetchall()

    for row in rows:
        seed_key = _compute_seed_key(row.topic, row.difficulty, row.type, row.prompt)
        bind.execute(
            sa.text("UPDATE questions SET seed_key = :seed_key WHERE id = :id"),
            {"seed_key": seed_key, "id": row.id},
        )

    op.alter_column("questions", "seed_key", nullable=False)
    op.create_unique_constraint("uq_questions_seed_key", "questions", ["seed_key"])


def downgrade() -> None:
    op.drop_constraint("uq_questions_seed_key", "questions", type_="unique")
    op.drop_column("questions", "seed_key")
