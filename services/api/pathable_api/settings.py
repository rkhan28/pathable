import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: os.environ.get("DATABASE_URL", "postgresql://pathable:pathable@localhost:5432/pathable")
    )
    redis_url: str | None = field(default_factory=lambda: os.environ.get("REDIS_URL"))
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o
        )
    )
    # Requests per minute per client for /v1/routes; reports are stricter.
    routes_per_minute: int = int(os.environ.get("ROUTES_PER_MINUTE", "60"))
    reports_per_minute: int = int(os.environ.get("REPORTS_PER_MINUTE", "6"))
