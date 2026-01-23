from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = Field(...)
    APP_HOST: str = Field(default="0.0.0.0")
    APP_PORT: int = Field(default=8000)
    API_V1_PREFIX: str = Field(default="/api/v1")
    CORS_ORIGINS: str = Field(default="http://localhost:5173")
    LOG_LEVEL: str = Field(default="info")
    SECRET_KEY: str = Field(...)
    DEFAULT_QUIZ_SIZE: int = Field(default=10)
    MAX_QUESTIONS_PER_QUIZ: int = Field(default=50)

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
