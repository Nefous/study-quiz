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
    CORS_ORIGINS: list[str] = Field(default=[])
    LOG_LEVEL: str = Field(default="info")
    SECRET_KEY: str = Field(...)
    JWT_ALG: str = Field(default="RS256")
    JWT_PRIVATE_KEY_PATH: str = Field(default="/run/secrets/jwt_private.pem")
    JWT_PUBLIC_KEY_PATH: str = Field(default="/run/secrets/jwt_public.pem")
    ACCESS_TOKEN_EXPIRES_MIN: int = Field(default=15)
    REFRESH_TOKEN_EXPIRES_DAYS: int = Field(default=14)
    ALLOW_CREDENTIALS: bool = Field(default=True)
    REFRESH_COOKIE_NAME: str = Field(default="refresh_token")
    REFRESH_COOKIE_SECURE: bool = Field(default=False)
    FRONTEND_URL: str = Field(default="http://localhost:5173")
    GOOGLE_CLIENT_ID: str | None = Field(default=None)
    GOOGLE_CLIENT_SECRET: str | None = Field(default=None)
    GOOGLE_REDIRECT_URI: str | None = Field(default=None)
    GOOGLE_API_KEY: str | None = Field(default=None)
    GITHUB_CLIENT_ID: str | None = Field(default=None)
    GITHUB_CLIENT_SECRET: str | None = Field(default=None)
    GITHUB_REDIRECT_URI: str | None = Field(default=None)
    DEFAULT_QUIZ_SIZE: int = Field(default=10)
    MAX_QUESTIONS_PER_QUIZ: int = Field(default=15)
    REDIS_URL: str = Field(default="redis://redis:6379/0")
    GROQ_API_KEY: str | None = Field(default=None)
    GROQ_MODEL: str = Field(default="openai/gpt-oss-120b")
    GROQ_TEMPERATURE: float = Field(default=0.4)
    GROQ_HINT_MAX_TOKENS: int = Field(default=180)
    GROQ_REVIEW_TEMPERATURE: float = Field(default=0.4)
    GROQ_REVIEW_MAX_TOKENS: int = Field(default=800)
    ADMIN_EMAILS: list[str] = Field(default=[])
    ENV: str = Field(default="prod")

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

    @field_validator("ADMIN_EMAILS", mode="before")
    @classmethod
    def _parse_admin_emails(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [
                            str(item).strip().lower()
                            for item in parsed
                            if str(item).strip()
                        ]
                except json.JSONDecodeError:
                    pass
            return [item.strip().lower() for item in raw.split(",") if item.strip()]
        if isinstance(value, (list, tuple)):
            return [str(item).strip().lower() for item in value if str(item).strip()]
        return []

    @property
    def cors_origins_list(self) -> list[str]:
        return self.CORS_ORIGINS


@lru_cache
def get_settings() -> Settings:
    return Settings()

