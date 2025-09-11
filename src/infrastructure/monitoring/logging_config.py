"""
Oasis Trading System - Advanced Logging Configuration
Structured logging with Loguru, OpenTelemetry integration, and multiple output formats
"""

import sys
import json
from typing import Any, Dict, Optional, Union
from pathlib import Path
import contextvars
from datetime import datetime

from loguru import logger
from pythonjsonlogger import jsonlogger
import structlog

from src.config.settings import settings


# Context variables for request tracing
request_id_context: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'request_id', default=None
)
user_id_context: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'user_id', default=None
)


class StructuredFormatter:
    """Custom formatter for structured logging"""
    
    def __init__(self, include_extra: bool = True):
        self.include_extra = include_extra
    
    def format(self, record):
        """Format log record as structured JSON"""
        # Base log data
        log_data = {
            "timestamp": datetime.fromtimestamp(record["time"].timestamp()).isoformat(),
            "level": record["level"].name,
            "message": record["message"],
            "module": record["name"],
            "function": record["function"],
            "line": record["line"],
        }
        
        # Add request context if available
        if request_id_context.get():
            log_data["request_id"] = request_id_context.get()
        
        if user_id_context.get():
            log_data["user_id"] = user_id_context.get()
        
        # Add extra fields
        if self.include_extra and "extra" in record:
            log_data.update(record["extra"])
        
        # Add exception info if present
        if record["exception"]:
            log_data["exception"] = {
                "type": record["exception"].type.__name__,
                "value": str(record["exception"].value),
                "traceback": record["exception"].traceback
            }
        
        return json.dumps(log_data, ensure_ascii=False)


class TradingLogFilter:
    """Filter for trading-specific logs"""
    
    def __init__(self, include_trading: bool = True):
        self.include_trading = include_trading
    
    def __call__(self, record):
        """Filter trading logs based on configuration"""
        if not self.include_trading:
            return "trading" not in record["name"].lower()
        return True


class SensitiveDataFilter:
    """Filter to remove sensitive data from logs"""
    
    SENSITIVE_KEYS = {
        "password", "api_key", "api_secret", "token", "secret", 
        "private_key", "passphrase", "authorization"
    }
    
    def __call__(self, record):
        """Remove sensitive data from log record"""
        if "extra" in record:
            record["extra"] = self._sanitize_dict(record["extra"])
        
        # Sanitize message if it contains JSON
        try:
            if record["message"].strip().startswith("{"):
                data = json.loads(record["message"])
                record["message"] = json.dumps(self._sanitize_dict(data))
        except (json.JSONDecodeError, AttributeError):
            pass
        
        return record
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively sanitize dictionary data"""
        if not isinstance(data, dict):
            return data
        
        sanitized = {}
        for key, value in data.items():
            if isinstance(key, str) and key.lower() in self.SENSITIVE_KEYS:
                sanitized[key] = "*" * 8
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self._sanitize_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        
        return sanitized


def setup_logging() -> None:
    """
    Configure logging for the entire application
    """
    # Remove default handler
    logger.remove()
    
    # Ensure log directory exists
    settings.LOGS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Console logging configuration
    console_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )
    
    if settings.ENVIRONMENT == "production":
        # Production: JSON structured logging
        logger.add(
            sys.stdout,
            format=StructuredFormatter().format,
            level=settings.LOG_LEVEL.value,
            filter=SensitiveDataFilter(),
            serialize=False,
        )
    else:
        # Development: Human-readable format
        logger.add(
            sys.stdout,
            format=console_format,
            level=settings.LOG_LEVEL.value,
            colorize=True,
            filter=SensitiveDataFilter(),
        )
    
    # File logging - General application logs
    logger.add(
        settings.LOGS_DIR / "application.log",
        format=StructuredFormatter().format,
        level="INFO",
        rotation="100 MB",
        retention="30 days",
        compression="gz",
        filter=SensitiveDataFilter(),
        serialize=False,
    )
    
    # File logging - Error logs
    logger.add(
        settings.LOGS_DIR / "errors.log",
        format=StructuredFormatter().format,
        level="ERROR",
        rotation="50 MB",
        retention="90 days",
        compression="gz",
        filter=SensitiveDataFilter(),
        serialize=False,
    )
    
    # Trading-specific logs
    logger.add(
        settings.LOGS_DIR / "trading.log",
        format=StructuredFormatter().format,
        level="DEBUG",
        rotation="200 MB",
        retention="365 days",
        compression="gz",
        filter=lambda record: "trading" in record["name"].lower(),
        serialize=False,
    )
    
    # Performance logs
    logger.add(
        settings.LOGS_DIR / "performance.log",
        format=StructuredFormatter().format,
        level="INFO",
        rotation="100 MB",
        retention="30 days",
        compression="gz",
        filter=lambda record: "performance" in record.get("extra", {}),
        serialize=False,
    )
    
    # Audit logs (for compliance)
    logger.add(
        settings.LOGS_DIR / "audit.log",
        format=StructuredFormatter().format,
        level="INFO",
        rotation="1 day",
        retention="2555 days",  # 7 years for compliance
        compression="gz",
        filter=lambda record: record.get("extra", {}).get("audit", False),
        serialize=False,
    )


def get_logger(name: str) -> Any:
    """
    Get a logger instance for a specific module
    
    Args:
        name: Module or component name
        
    Returns:
        Configured logger instance
    """
    return logger.bind(component=name)


def log_trading_event(
    event_type: str,
    symbol: str,
    data: Dict[str, Any],
    user_id: Optional[str] = None
) -> None:
    """
    Log trading-specific events with structured data
    
    Args:
        event_type: Type of trading event (order, execution, signal, etc.)
        symbol: Trading symbol
        data: Event-specific data
        user_id: User ID if applicable
    """
    trading_logger = get_logger("trading")
    trading_logger.info(
        f"Trading event: {event_type}",
        extra={
            "event_type": event_type,
            "symbol": symbol,
            "user_id": user_id,
            "trading_data": data,
            "audit": True
        }
    )


def log_performance_metric(
    metric_name: str,
    value: Union[int, float],
    tags: Optional[Dict[str, str]] = None
) -> None:
    """
    Log performance metrics
    
    Args:
        metric_name: Name of the metric
        value: Metric value
        tags: Additional tags for the metric
    """
    perf_logger = get_logger("performance")
    perf_logger.info(
        f"Performance metric: {metric_name}",
        extra={
            "metric_name": metric_name,
            "metric_value": value,
            "tags": tags or {},
            "performance": True
        }
    )


def log_security_event(
    event_type: str,
    details: Dict[str, Any],
    severity: str = "INFO"
) -> None:
    """
    Log security-related events
    
    Args:
        event_type: Type of security event
        details: Event details
        severity: Log severity level
    """
    security_logger = get_logger("security")
    
    log_method = getattr(security_logger, severity.lower(), security_logger.info)
    log_method(
        f"Security event: {event_type}",
        extra={
            "event_type": event_type,
            "security_details": details,
            "audit": True
        }
    )


def log_api_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    user_id: Optional[str] = None
) -> None:
    """
    Log API request details
    
    Args:
        method: HTTP method
        path: Request path
        status_code: Response status code
        duration_ms: Request duration in milliseconds
        user_id: User ID if authenticated
    """
    api_logger = get_logger("api")
    api_logger.info(
        f"API request: {method} {path}",
        extra={
            "http_method": method,
            "request_path": path,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "user_id": user_id,
            "api_request": True
        }
    )


def set_request_context(request_id: str, user_id: Optional[str] = None) -> None:
    """
    Set request context for logging
    
    Args:
        request_id: Unique request identifier
        user_id: User ID if available
    """
    request_id_context.set(request_id)
    if user_id:
        user_id_context.set(user_id)


def clear_request_context() -> None:
    """Clear request context"""
    request_id_context.set(None)
    user_id_context.set(None)


class LoggerMiddleware:
    """Middleware for automatic request logging"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        """ASGI middleware implementation"""
        if scope["type"] == "http":
            import uuid
            import time
            
            request_id = str(uuid.uuid4())
            set_request_context(request_id)
            
            start_time = time.time()
            
            # Log request start
            logger.info(
                f"Request started: {scope['method']} {scope['path']}",
                extra={"request_id": request_id}
            )
            
            # Process request
            await self.app(scope, receive, send)
            
            # Log request completion
            duration = (time.time() - start_time) * 1000
            logger.info(
                f"Request completed: {scope['method']} {scope['path']}",
                extra={
                    "request_id": request_id,
                    "duration_ms": duration
                }
            )
            
            clear_request_context()
        else:
            await self.app(scope, receive, send)


# Initialize logging on module import
setup_logging()

# Export commonly used items
__all__ = [
    "get_logger",
    "log_trading_event",
    "log_performance_metric", 
    "log_security_event",
    "log_api_request",
    "set_request_context",
    "clear_request_context",
    "LoggerMiddleware",
    "setup_logging"
]   