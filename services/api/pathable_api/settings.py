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
    # Photo storage: S3 when S3_BUCKET is set, a local directory when PHOTO_DIR is set, otherwise off.
    s3_endpoint: str | None = field(default_factory=lambda: os.environ.get("S3_ENDPOINT"))
    s3_bucket: str | None = field(default_factory=lambda: os.environ.get("S3_BUCKET"))
    s3_access_key: str | None = field(default_factory=lambda: os.environ.get("S3_ACCESS_KEY"))
    s3_secret_key: str | None = field(default_factory=lambda: os.environ.get("S3_SECRET_KEY"))
    photo_dir: str | None = field(default_factory=lambda: os.environ.get("PHOTO_DIR"))
    # Requests per minute per client for /v1/routes; reports are stricter.
    routes_per_minute: int = int(os.environ.get("ROUTES_PER_MINUTE", "60"))
    reports_per_minute: int = int(os.environ.get("REPORTS_PER_MINUTE", "6"))
    hazards_per_minute: int = int(os.environ.get("HAZARDS_PER_MINUTE", "120"))
    # How many proxies in front of the API append to X-Forwarded-For (1 on most hosts, 0 locally).
    # Only their entries are believed; with 0 the header is ignored, so it cannot dodge the limit.
    trusted_proxy_hops: int = int(os.environ.get("TRUSTED_PROXY_HOPS", "0"))
