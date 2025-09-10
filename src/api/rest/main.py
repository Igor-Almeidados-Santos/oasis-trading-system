"""
Oasis Trading System - Main API Application
FastAPI application with middleware, routers, and event handlers
"""

from contextlib import asynccontextmanager
from typing import Any, Dict
import time
import uuid

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from src.config.settings import settings
from src.infrastructure.database.connection import init_database, close_database
from src.infrastructure.logging_config import get_logger

logger = get_logger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Counter(
    'http_requests_active',
    'Active HTTP requests'
)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add request ID to all requests"""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Add request ID to logger context
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={"request_id": request_id}
        )
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect metrics for Prometheus"""
    
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)
        
        ACTIVE_REQUESTS.inc()
        start_time = time.time()
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Record metrics
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code
            ).inc()
            
            REQUEST_DURATION.labels(
                method=request.method,
                endpoint=request.url.path
            ).observe(duration)
            
            # Add response time header
            response.headers["X-Response-Time"] = f"{duration:.3f}"
            
            return response
        
        finally:
            ACTIVE_REQUESTS.dec()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware"""
    
    def __init__(self, app, calls: int = 100, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.clients = {}
    
    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        
        client_ip = request.client.host
        now = time.time()
        
        # Clean old entries
        self.clients = {
            ip: times for ip, times in self.clients.items()
            if any(t > now - self.period for t in times)
        }
        
        # Check rate limit
        if client_ip in self.clients:
            requests = [t for t in self.clients[client_ip] if t > now - self.period]
            if len(requests) >= self.calls:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded"}
                )
            self.clients[client_ip] = requests + [now]
        else:
            self.clients[client_ip] = [now]
        
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info("Starting Oasis Trading System API...")
    
    try:
        # Initialize database
        await init_database()
        logger.info("Database initialized successfully")
        
        # Initialize cache connections
        # await init_redis()
        
        # Initialize message queue connections
        # await init_kafka()
        
        # Load ML models
        # await load_models()
        
        logger.info("API startup complete")
        
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Oasis Trading System API...")
    
    try:
        # Close database connections
        await close_database()
        
        # Close cache connections
        # await close_redis()
        
        # Close message queue connections
        # await close_kafka()
        
        logger.info("API shutdown complete")
        
    except Exception as e:
        logger.error(f"Shutdown error: {e}")


def create_application() -> FastAPI:
    """
    Create and configure FastAPI application
    """
    
    # Initialize Sentry for error tracking
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=str(settings.SENTRY_DSN),
            environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        )
    
    # Create FastAPI instance
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.PROJECT_VERSION,
        description="High-Performance Algorithmic Cryptocurrency Trading Bot",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan
    )
    
    # Add middlewares
    
    # CORS
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    # Trusted Host
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure based on your needs
    )
    
    # GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Sentry
    if settings.SENTRY_DSN:
        app.add_middleware(SentryAsgiMiddleware)
    
    # Custom middlewares
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(MetricsMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        calls=settings.RATE_LIMIT_PER_MINUTE,
        period=60
    )
    
    # Exception handlers
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle HTTP exceptions"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.detail,
                "status_code": exc.status_code,
                "request_id": getattr(request.state, "request_id", None)
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle validation errors"""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation error",
                "details": exc.errors(),
                "request_id": getattr(request.state, "request_id", None)
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle general exceptions"""
        logger.exception(f"Unhandled exception: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "request_id": getattr(request.state, "request_id", None)
            }
        )
    
    # Health check endpoint
    @app.get("/health", tags=["System"])
    async def health_check() -> Dict[str, Any]:
        """Health check endpoint"""
        return {
            "status": "healthy",
            "version": settings.PROJECT_VERSION,
            "environment": settings.ENVIRONMENT.value
        }
    
    # Readiness check endpoint
    @app.get("/ready", tags=["System"])
    async def readiness_check() -> Dict[str, Any]:
        """Readiness check endpoint"""
        from src.infrastructure.database.connection import db_manager
        
        # Check database
        db_health = await db_manager.health_check()
        
        # Check other services
        # redis_health = await check_redis_health()
        # kafka_health = await check_kafka_health()
        
        is_ready = db_health.get("status") == "healthy"
        
        return {
            "ready": is_ready,
            "checks": {
                "database": db_health,
                # "redis": redis_health,
                # "kafka": kafka_health
            }
        }
    
    # Metrics endpoint for Prometheus
    @app.get("/metrics", tags=["System"])
    async def metrics():
        """Prometheus metrics endpoint"""
        return Response(
            generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )
    
    # API Info endpoint
    @app.get("/", tags=["System"])
    async def root() -> Dict[str, Any]:
        """Root endpoint with API information"""
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.PROJECT_VERSION,
            "environment": settings.ENVIRONMENT.value,
            "api_version": settings.API_V1_STR,
            "docs_url": "/docs" if settings.ENVIRONMENT != "production" else None,
            "health_check": "/health",
            "metrics": "/metrics"
        }
    
    # Include routers
    # from src.api.rest.v1.endpoints import strategies, positions, orders, analytics
    
    # app.include_router(
    #     strategies.router,
    #     prefix=f"{settings.API_V1_STR}/strategies",
    #     tags=["Strategies"]
    # )
    
    # app.include_router(
    #     positions.router,
    #     prefix=f"{settings.API_V1_STR}/positions",
    #     tags=["Positions"]
    # )
    
    # app.include_router(
    #     orders.router,
    #     prefix=f"{settings.API_V1_STR}/orders",
    #     tags=["Orders"]
    # )
    
    # app.include_router(
    #     analytics.router,
    #     prefix=f"{settings.API_V1_STR}/analytics",
    #     tags=["Analytics"]
    # )
    
    logger.info(f"API configured for {settings.ENVIRONMENT} environment")
    
    return app


# Create application instance
app = create_application()


def run():
    """Run the application using uvicorn"""
    import uvicorn
    
    uvicorn.run(
        "src.api.rest.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD,
        workers=settings.API_WORKERS if not settings.API_RELOAD else 1,
        log_level=settings.LOG_LEVEL.value.lower(),
        access_log=settings.ENVIRONMENT != "production"
    )


if __name__ == "__main__":
    run()