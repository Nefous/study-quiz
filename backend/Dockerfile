FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -U pip \
    && pip install --no-cache-dir uv

RUN adduser --disabled-password --gecos "" appuser

COPY --chown=appuser:appuser pyproject.toml /app/
COPY --chown=appuser:appuser uv.lock /app/

RUN uv sync --frozen --no-dev \
    && chown -R appuser:appuser /app/.venv

COPY --chown=appuser:appuser app /app/app
COPY --chown=appuser:appuser alembic /app/alembic
COPY --chown=appuser:appuser alembic.ini /app/alembic.ini
COPY --chown=appuser:appuser entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
