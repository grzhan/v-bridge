from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / '.env'), env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'remote-gateway-api'
    app_env: str = 'development'
    secret_key: str = 'change-me-in-production'
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'
    cors_allow_origin_regex: str = r'^https?://([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(:\d+)?$'

    app_database_url: str = 'mysql+pymysql://app:app@127.0.0.1:3306/app_db'

    guac_base_url: str = 'http://127.0.0.1:8081'
    guac_username: str = 'guacadmin'
    guac_password: str = 'guacadmin'
    guac_data_source: str = 'mysql'
    guac_enabled: bool = False

    reclaim_interval_seconds: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
