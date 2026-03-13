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

    # App environment flag
    environment: str = "development"
    debug: bool = True

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_testing(self) -> bool:
        return self.environment == "testing"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
