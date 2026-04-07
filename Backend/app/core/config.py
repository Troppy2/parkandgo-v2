import json
import os
from dotenv import load_dotenv

load_dotenv()

from pydantic import field_validator
from pydantic_settings import BaseSettings

# Read environment variables at module load time to avoid issues with async Redis initialization later on.
# Default to empty string — avoids AttributeError if vars are absent (e.g. CI, fresh clone).
_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "").strip()
_admin_emails_raw = os.getenv("ADMIN_EMAILS", "").strip()
USE_REDIS = os.getenv("USE_REDIS", "false").strip().lower() in {"1", "true", "yes", "on"}

class Settings(BaseSettings):
    # Database
    database_url: str

    # Auth — JWT signing key and Google OAuth credentials
    secret_key: str
    google_client_id: str
    google_client_secret: str

    # Redis — caching layer
    redis_url: str = "redis://localhost:6379"

    use_redis: bool = USE_REDIS  # Flag to enable/disable Redis caching
    # Admin — comma-separated list of emails authorized for admin access
    admin_emails: str = _admin_emails_raw

    # App environment flag
    environment: str = "development"
    debug: bool = True

    # CORS — stored as a plain env string so pydantic-settings won't try to JSON-decode it first
    allowed_origins: str = _allowed_origins_raw

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
        """Accept CORS origins from env as JSON list or comma-separated string.

        Handles three formats:
          ["https://a.com","https://b.com"]   ← valid JSON array
          [https://a.com, https://b.com]       ← bracket notation without quotes (common mistake)
          https://a.com,https://b.com          ← plain CSV (preferred)
        """
        normalized = self.allowed_origins.strip()
        if not normalized:
            return []

        # Strip stray outer brackets before attempting JSON — catches the common
        # copy-paste mistake of [url1, url2] where URLs are not quoted.
        stripped = normalized.lstrip("[").rstrip("]").strip() if normalized.startswith("[") else normalized

        if normalized.startswith("["):
            try:
                parsed = json.loads(normalized)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                # Fall through: treat bracket-stripped value as CSV
                normalized = stripped

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
