"""
Oasis Trading System - Core Configuration
Centralizes all application settings using Pydantic Settings
"""

from typing import Any, Dict, List, Optional, Union
from pathlib import Path
from functools import lru_cache
from enum import Enum

from pydantic import (
    BaseSettings, 
    Field, 
    validator, 
    PostgresDsn, 
    RedisDsn,
    HttpUrl,
    SecretStr
)
from pydantic.networks import AnyHttpUrl


class Environment(str, Enum):
    """Application environments"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(str, Enum):
    """Log levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Settings(BaseSettings):
    """
    Main settings class for Oasis Trading System.
    Loads configuration from environment variables and .env file.
    """
    
    # ==========================================
    # Application Settings
    # ==========================================
    
    PROJECT_NAME: str = "Oasis Trading System"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    ENVIRONMENT: Environment = Field(
        default=Environment.DEVELOPMENT,
        description="Current environment"
    )
    
    DEBUG: bool = Field(
        default=False,
        description="Debug mode"
    )
    
    LOG_LEVEL: LogLevel = Field(
        default=LogLevel.INFO,
        description="Logging level"
    )
    
    # ==========================================
    # Security Settings
    # ==========================================
    
    SECRET_KEY: SecretStr = Field(
        ...,
        min_length=32,
        description="Secret key for encryption"
    )
    
    JWT_SECRET_KEY: SecretStr = Field(
        ...,
        min_length=32,
        description="JWT secret key"
    )
    
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    BCRYPT_ROUNDS: int = 12
    
    # API Key settings
    API_KEY_LENGTH: int = 32
    API_KEY_PREFIX: str = "ots_"
    
    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = Field(
        default=[],
        description="CORS allowed origins"
    )
    
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # ==========================================
    # Database Settings
    # ==========================================
    
    POSTGRES_HOST: str = Field(default="localhost", env="POSTGRES_HOST")
    POSTGRES_PORT: int = Field(default=5432, env="POSTGRES_PORT")
    POSTGRES_USER: str = Field(default="oasis", env="POSTGRES_USER")
    POSTGRES_PASSWORD: SecretStr = Field(..., env="POSTGRES_PASSWORD")
    POSTGRES_DB: str = Field(default="oasis_trading", env="POSTGRES_DB")
    
    DATABASE_URL: Optional[PostgresDsn] = None
    
    @validator("DATABASE_URL", pre=True)
    def assemble_db_connection(cls, v: Optional[str], values: Dict[str, Any]) -> Any:
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            user=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD").get_secret_value() 
                     if values.get("POSTGRES_PASSWORD") else None,
            host=values.get("POSTGRES_HOST"),
            port=str(values.get("POSTGRES_PORT")),
            path=f"/{values.get('POSTGRES_DB') or ''}",
        )
    
    # Database pool settings
    DB_POOL_MIN_SIZE: int = 10
    DB_POOL_MAX_SIZE: int = 20
    DB_ECHO: bool = False
    
    # TimescaleDB
    TIMESCALE_ENABLED: bool = True
    TIMESCALE_CHUNK_TIME_INTERVAL: str = "1 day"
    
    # ==========================================
    # Redis Settings
    # ==========================================
    
    REDIS_HOST: str = Field(default="localhost", env="REDIS_HOST")
    REDIS_PORT: int = Field(default=6379, env="REDIS_PORT")
    REDIS_PASSWORD: Optional[SecretStr] = Field(None, env="REDIS_PASSWORD")
    REDIS_DB: int = Field(default=0, env="REDIS_DB")
    
    REDIS_URL: Optional[RedisDsn] = None
    
    @validator("REDIS_URL", pre=True)
    def assemble_redis_connection(cls, v: Optional[str], values: Dict[str, Any]) -> Any:
        if isinstance(v, str):
            return v
        password = values.get("REDIS_PASSWORD")
        if password:
            password = password.get_secret_value()
        return RedisDsn.build(
            scheme="redis",
            user=None,
            password=password,
            host=values.get("REDIS_HOST"),
            port=str(values.get("REDIS_PORT")),
            path=f"/{values.get('REDIS_DB') or 0}",
        )
    
    REDIS_TTL_SECONDS: int = 3600  # 1 hour
    REDIS_MAX_CONNECTIONS: int = 50
    
    # ==========================================
    # Kafka Settings
    # ==========================================
    
    KAFKA_BOOTSTRAP_SERVERS: str = Field(
        default="localhost:29092",
        env="KAFKA_BOOTSTRAP_SERVERS"
    )
    KAFKA_SECURITY_PROTOCOL: str = "PLAINTEXT"
    KAFKA_GROUP_ID: str = "oasis-trading-group"
    
    # Kafka Topics
    KAFKA_TOPIC_MARKET_DATA: str = "market-data"
    KAFKA_TOPIC_TRADING_SIGNALS: str = "trading-signals"
    KAFKA_TOPIC_ORDERS: str = "orders"
    KAFKA_TOPIC_POSITIONS: str = "positions"
    KAFKA_TOPIC_RISK_ALERTS: str = "risk-alerts"
    
    # ==========================================
    # Celery Settings
    # ==========================================
    
    CELERY_BROKER_URL: str = Field(..., env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: str = Field(..., env="CELERY_RESULT_BACKEND")
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"
    CELERY_TASK_TRACK_STARTED: bool = True
    CELERY_TASK_TIME_LIMIT: int = 30 * 60  # 30 minutes
    
    # ==========================================
    # Exchange Settings
    # ==========================================
    
    # Binance
    BINANCE_API_KEY: Optional[SecretStr] = Field(None, env="BINANCE_API_KEY")
    BINANCE_API_SECRET: Optional[SecretStr] = Field(None, env="BINANCE_API_SECRET")
    BINANCE_TESTNET: bool = Field(default=True, env="BINANCE_TESTNET")
    
    # Coinbase
    COINBASE_API_KEY: Optional[SecretStr] = Field(None, env="COINBASE_API_KEY")
    COINBASE_API_SECRET: Optional[SecretStr] = Field(None, env="COINBASE_API_SECRET")
    COINBASE_PASSPHRASE: Optional[SecretStr] = Field(None, env="COINBASE_PASSPHRASE")
    
    # Kraken
    KRAKEN_API_KEY: Optional[SecretStr] = Field(None, env="KRAKEN_API_KEY")
    KRAKEN_API_SECRET: Optional[SecretStr] = Field(None, env="KRAKEN_API_SECRET")
    
    # Exchange rate limits (requests per second)
    EXCHANGE_RATE_LIMITS: Dict[str, int] = {
        "binance": 10,
        "coinbase": 5,
        "kraken": 3,
        "okx": 5,
        "bybit": 5
    }
    
    # ==========================================
    # Trading Settings
    # ==========================================
    
    DEFAULT_EXCHANGE: str = Field(default="binance", env="DEFAULT_EXCHANGE")
    MAX_POSITIONS: int = Field(default=10, env="MAX_POSITIONS")
    DEFAULT_POSITION_SIZE: float = Field(default=100.0, env="DEFAULT_POSITION_SIZE")
    DEFAULT_LEVERAGE: int = Field(default=1, env="DEFAULT_LEVERAGE")
    TRADING_ENABLED: bool = Field(default=False, env="TRADING_ENABLED")
    
    # Order settings
    DEFAULT_ORDER_TYPE: str = "limit"
    DEFAULT_TIME_IN_FORCE: str = "GTC"
    ORDER_RETRY_ATTEMPTS: int = 3
    ORDER_RETRY_DELAY: int = 1  # seconds
    
    # ==========================================
    # Risk Management Settings
    # ==========================================
    
    MAX_DRAWDOWN_PERCENT: float = Field(default=15.0, env="MAX_DRAWDOWN_PERCENT")
    MAX_DAILY_LOSS_PERCENT: float = Field(default=5.0, env="MAX_DAILY_LOSS_PERCENT")
    MAX_POSITION_SIZE_PERCENT: float = Field(default=10.0, env="MAX_POSITION_SIZE_PERCENT")
    STOP_LOSS_PERCENT: float = Field(default=2.0, env="STOP_LOSS_PERCENT")
    TAKE_PROFIT_PERCENT: float = Field(default=5.0, env="TAKE_PROFIT_PERCENT")
    
    # Risk calculation intervals
    RISK_CALCULATION_INTERVAL: int = 60  # seconds
    VAR_CONFIDENCE_LEVEL: float = 0.95
    VAR_TIME_HORIZON: int = 1  # days
    
    # ==========================================
    # Machine Learning Settings
    # ==========================================
    
    ML_MODEL_PATH: Path = Field(default=Path("/app/models"), env="ML_MODEL_PATH")
    ML_BATCH_SIZE: int = Field(default=32, env="ML_BATCH_SIZE")
    ML_MAX_EPOCHS: int = Field(default=100, env="ML_MAX_EPOCHS")
    ML_LEARNING_RATE: float = Field(default=0.001, env="ML_LEARNING_RATE")
    ML_DEVICE: str = Field(default="cpu", env="ML_DEVICE")
    ENABLE_GPU: bool = Field(default=False, env="ENABLE_GPU")
    
    # Model serving
    MODEL_CACHE_SIZE: int = 10
    MODEL_INFERENCE_TIMEOUT: int = 5  # seconds
    
    # ==========================================
    # Monitoring Settings
    # ==========================================
    
    PROMETHEUS_ENABLED: bool = Field(default=True, env="PROMETHEUS_ENABLED")
    PROMETHEUS_PORT: int = Field(default=9090, env="PROMETHEUS_PORT")
    
    # Metrics collection intervals
    METRICS_COLLECTION_INTERVAL: int = 10  # seconds
    HEALTH_CHECK_INTERVAL: int = 30  # seconds
    
    # ==========================================
    # Notification Settings
    # ==========================================
    
    # Slack
    SLACK_WEBHOOK_URL: Optional[HttpUrl] = Field(None, env="SLACK_WEBHOOK_URL")
    SLACK_CHANNEL: str = "#trading-alerts"
    
    # Discord
    DISCORD_WEBHOOK_URL: Optional[HttpUrl] = Field(None, env="DISCORD_WEBHOOK_URL")
    
    # Telegram
    TELEGRAM_BOT_TOKEN: Optional[SecretStr] = Field(None, env="TELEGRAM_BOT_TOKEN")
    TELEGRAM_CHAT_ID: Optional[str] = Field(None, env="TELEGRAM_CHAT_ID")
    
    # Email
    EMAIL_SMTP_HOST: Optional[str] = Field(None, env="EMAIL_SMTP_HOST")
    EMAIL_SMTP_PORT: int = Field(default=587, env="EMAIL_SMTP_PORT")
    EMAIL_USERNAME: Optional[str] = Field(None, env="EMAIL_USERNAME")
    EMAIL_PASSWORD: Optional[SecretStr] = Field(None, env="EMAIL_PASSWORD")
    EMAIL_FROM: str = "noreply@oasis-trading.com"
    
    # ==========================================
    # Feature Flags
    # ==========================================
    
    ENABLE_BACKTESTING: bool = Field(default=True, env="ENABLE_BACKTESTING")
    ENABLE_PAPER_TRADING: bool = Field(default=True, env="ENABLE_PAPER_TRADING")
    ENABLE_LIVE_TRADING: bool = Field(default=False, env="ENABLE_LIVE_TRADING")
    ENABLE_ML_STRATEGIES: bool = Field(default=True, env="ENABLE_ML_STRATEGIES")
    ENABLE_SOCIAL_TRADING: bool = Field(default=False, env="ENABLE_SOCIAL_TRADING")
    
    # ==========================================
    # API Settings
    # ==========================================
    
    API_HOST: str = Field(default="0.0.0.0", env="API_HOST")
    API_PORT: int = Field(default=8000, env="API_PORT")
    API_WORKERS: int = Field(default=4, env="API_WORKERS")
    API_RELOAD: bool = Field(default=False, env="API_RELOAD")
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    # ==========================================
    # Paths
    # ==========================================
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    LOGS_DIR: Path = BASE_DIR / "logs"
    DATA_DIR: Path = BASE_DIR / "data"
    MODELS_DIR: Path = BASE_DIR / "models"
    STATIC_DIR: Path = BASE_DIR / "static"
    TEMPLATES_DIR: Path = BASE_DIR / "templates"
    
    @validator("LOGS_DIR", "DATA_DIR", "MODELS_DIR", pre=True)
    def create_directories(cls, v: Path) -> Path:
        v.mkdir(parents=True, exist_ok=True)
        return v
    
    # ==========================================
    # External Services
    # ==========================================
    
    # Sentry
    SENTRY_DSN: Optional[HttpUrl] = Field(None, env="SENTRY_DSN")
    SENTRY_ENVIRONMENT: str = Field(default="development", env="SENTRY_ENVIRONMENT")
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1, env="SENTRY_TRACES_SAMPLE_RATE")
    
    # AWS
    AWS_ACCESS_KEY_ID: Optional[str] = Field(None, env="AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: Optional[SecretStr] = Field(None, env="AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = Field(default="us-east-1", env="AWS_REGION")
    S3_BUCKET_NAME: Optional[str] = Field(None, env="S3_BUCKET_NAME")
    
    class Config:
        """Pydantic config"""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        
        # Allow field population by field name or alias
        allow_population_by_field_name = True
        
        # JSON encoders for special types
        json_encoders = {
            SecretStr: lambda v: v.get_secret_value() if v else None,
        }


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    This ensures we only load settings once.
    """
    return Settings()


# Create settings instance
settings = get_settings()


# Environment-specific settings overrides
if settings.ENVIRONMENT == Environment.PRODUCTION:
    settings.DEBUG = False
    settings.LOG_LEVEL = LogLevel.WARNING
    settings.DB_ECHO = False
    settings.API_RELOAD = False
elif settings.ENVIRONMENT == Environment.DEVELOPMENT:
    settings.DEBUG = True
    settings.LOG_LEVEL = LogLevel.DEBUG
    settings.DB_ECHO = True
    settings.API_RELOAD = True


def get_exchange_config(exchange_name: str) -> Dict[str, Any]:
    """Get configuration for a specific exchange"""
    exchange_configs = {
        "binance": {
            "api_key": settings.BINANCE_API_KEY,
            "api_secret": settings.BINANCE_API_SECRET,
            "testnet": settings.BINANCE_TESTNET,
            "rate_limit": settings.EXCHANGE_RATE_LIMITS.get("binance", 10)
        },
        "coinbase": {
            "api_key": settings.COINBASE_API_KEY,
            "api_secret": settings.COINBASE_API_SECRET,
            "passphrase": settings.COINBASE_PASSPHRASE,
            "rate_limit": settings.EXCHANGE_RATE_LIMITS.get("coinbase", 5)
        },
        "kraken": {
            "api_key": settings.KRAKEN_API_KEY,
            "api_secret": settings.KRAKEN_API_SECRET,
            "rate_limit": settings.EXCHANGE_RATE_LIMITS.get("kraken", 3)
        }
    }
    
    return exchange_configs.get(exchange_name.lower(), {})