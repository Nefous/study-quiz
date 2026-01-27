from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = Field(...)
    APP_HOST: str = Field(default="0.0.0.0")
    APP_PORT: int = Field(default=8000)
    API_V1_PREFIX: str = Field(default="/api/v1")
    CORS_ORIGINS: list[str] = Field(default_factory=list)
    LOG_LEVEL: str = Field(default="info")
    SECRET_KEY: str = Field(...)
    DEFAULT_QUIZ_SIZE: int = Field(default=10)
    MAX_QUESTIONS_PER_QUIZ: int = Field(default=50)
    GROQ_API_KEY: str | None = Field(default=None)
    GROQ_MODEL: str = Field(default="openai/gpt-oss-120b")
    GROQ_TEMPERATURE: float = Field(default=0.4)
    GROQ_HINT_MAX_TOKENS: int = Field(default=180)

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value):
        default_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

        def normalize(origins: list[str]) -> list[str]:
            cleaned: list[str] = []
            for origin in origins:
                item = str(origin).strip()
                if not item:
                    continue
                while item.endswith("/"):
                    item = item[:-1]
                if item:
                    cleaned.append(item)
            return cleaned or default_origins
        if value is None:
            return default_origins
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return default_origins
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return normalize(parsed)
                except json.JSONDecodeError:
                    pass
            return normalize(raw.split(","))
        if isinstance(value, (list, tuple)):
            return normalize(list(value))
        return default_origins

    @field_validator("API_V1_PREFIX", mode="before")
    @classmethod
    def _normalize_api_prefix(cls, value):
        if not isinstance(value, str):
            return "/api/v1"
        trimmed = value.strip()
        if not trimmed:
            return "/api/v1"
        if not trimmed.startswith("/"):
            trimmed = f"/{trimmed}"
        if len(trimmed) > 1 and trimmed.endswith("/"):
            trimmed = trimmed[:-1]
        return trimmed

    @property
    def cors_origins_list(self) -> list[str]:
        return self.CORS_ORIGINS


@lru_cache
def get_settings() -> Settings:
    return Settings()
