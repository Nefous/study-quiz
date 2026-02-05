import importlib.util
from pathlib import Path
from uuid import uuid4

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from app.models.question_candidate import QuestionCandidate


def load_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "20260204_0018_add_question_candidates.py"
    )
    spec = importlib.util.spec_from_file_location("migration_question_candidates", path)
    module = importlib.util.module_from_spec(spec)
    if spec and spec.loader:
        spec.loader.exec_module(module)
    return module


def test_question_candidates_migration_and_insert():
    engine = create_engine("sqlite:///:memory:")
    conn = engine.connect()

    migration = load_migration()
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    ctx = MigrationContext.configure(conn)
    op_obj = Operations(ctx)
    migration.op = op_obj
    migration.upgrade()

    inspector = inspect(conn)
    assert "question_candidates" in inspector.get_table_names()

    session = Session(bind=conn)
    candidate = QuestionCandidate(
        id=uuid4(),
        topic="python_core",
        difficulty="junior",
        type="mcq",
        payload_json={"prompt": "What is 2 + 2?"},
        status="generated",
    )
    session.add(candidate)
    session.commit()

    rows = session.query(QuestionCandidate).all()
    assert len(rows) == 1
    assert rows[0].topic == "python_core"
