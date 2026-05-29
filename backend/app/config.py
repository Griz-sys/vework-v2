from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://vework:vework@localhost:5433/vework"
    redis_url: str = "redis://localhost:6380"
    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 10080
    anthropic_api_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8001/auth/google/callback"
    storage_path: str = "./uploads"


settings = Settings()
