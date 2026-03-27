import json

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str

    # Auth — JWT signing key and Google OAuth credentials
    secret_key: str
    google_client_id: str
    google_client_secret: str

    # Redis — caching layer
    redis_url: str = "redis://localhost:6379"

    # Admin — comma-separated list of emails authorized for admin access
    admin_emails: str = ""

    # App environment flag
    environment: str = "development"
    debug: bool = True

    # CORS — stored as a plain env string so pydantic-settings won't try to JSON-decode it first
    allowed_origins: str = "http://localhost:3000"

    @property
    def admin_email_set(self) -> set[str]:
        """Parse ADMIN_EMAILS env var into a lowercase set for O(1) lookups."""
        if not self.admin_emails:
            return set()
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_testing(self) -> bool:
        return self.environment == "testing"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Accept CORS origins from env as JSON list or comma-separated string."""
        normalized = self.allowed_origins.strip()
        if not normalized:
            return []

        if normalized.startswith("["):
            try:
                parsed = json.loads(normalized)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                pass

        return [origin.strip() for origin in normalized.split(",") if origin.strip()]

    @field_validator("debug", mode="before")
    @classmethod
    def coerce_debug(cls, value):
        """Accept common env-style debug values without crashing settings load."""
        if isinstance(value, bool):
            return value
        if value is None:
            return True

        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
            return True
        if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
            return False
        return value

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
