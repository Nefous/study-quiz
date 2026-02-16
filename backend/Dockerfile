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

COPY pyproject.toml /app/
COPY uv.lock /app/

RUN uv sync --frozen --no-dev

COPY app /app/app
COPY alembic /app/alembic
COPY alembic.ini /app/alembic.ini
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

RUN adduser --disabled-password appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
