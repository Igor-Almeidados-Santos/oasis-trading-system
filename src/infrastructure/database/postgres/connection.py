"""
Database connection and session management for Oasis Trading System
Uses SQLAlchemy 2.0 with async support
"""

from typing import AsyncGenerator, Optional, Any
from contextlib import asynccontextmanager
import asyncio

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.orm import declarative_base, DeclarativeMeta
from sqlalchemy import (
    Column,
    DateTime,
    String,
    Boolean,
    event,
    MetaData,
    inspect,
    text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.pool import NullPool, QueuePool
import uuid

from src.config.settings import settings
from src.infrastructure.monitoring.logging_config import get_logger

logger = get_logger(__name__)

# Naming convention for database constraints
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)

# Create base class for all models
Base: DeclarativeMeta = declarative_base(metadata=metadata)


class BaseModel(Base):
    """
    Abstract base model with common fields and methods
    All models should inherit from this class
    """
    __abstract__ = True
    
    # Common fields for all models
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        index=True
    )
    
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True
    )
    
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        index=True
    )
    
    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }
    
    def update(self, **kwargs) -> None:
        """Update model attributes"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    def __repr__(self) -> str:
        """String representation of the model"""
        class_name = self.__class__.__name__
        return f"<{class_name}(id={self.id})>"


class DatabaseManager:
    """
    Manages database connections and sessions
    Implements singleton pattern for connection reuse
    """
    
    _instance: Optional['DatabaseManager'] = None
    _engine: Optional[AsyncEngine] = None
    _sessionmaker: Optional[async_sessionmaker] = None
    
    def __new__(cls) -> 'DatabaseManager':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize database manager"""
        if self._engine is None:
            self._initialize_engine()
    
    def _initialize_engine(self) -> None:
        """Create and configure async engine"""
        
        # Configure connection pool based on environment
        if settings.ENVIRONMENT == "production":
            poolclass = QueuePool
            pool_size = settings.DB_POOL_MAX_SIZE
            max_overflow = 10
            pool_pre_ping = True
            pool_recycle = 3600  # Recycle connections after 1 hour
        else:
            poolclass = NullPool  # No connection pooling for development
            pool_size = None
            max_overflow = None
            pool_pre_ping = False
            pool_recycle = -1
        
        # Create async engine
        self._engine = create_async_engine(
            str(settings.DATABASE_URL),
            echo=settings.DB_ECHO,
            poolclass=poolclass,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=pool_pre_ping,
            pool_recycle=pool_recycle,
            connect_args={
                "server_settings": {
                    "application_name": "oasis_trading_system",
                    "jit": "off"
                },
                "command_timeout": 60,
                "prepared_statement_cache_size": 0,
            }
        )
        
        # Create session factory
        self._sessionmaker = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False
        )
        
        # Register event listeners
        self._register_event_listeners()
        
        logger.info("Database engine initialized successfully")
    
    def _register_event_listeners(self) -> None:
        """Register SQLAlchemy event listeners"""
        
        @event.listens_for(self._engine.sync_engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            """Set connection parameters"""
            cursor = dbapi_conn.cursor()
            cursor.execute("SET timezone='UTC'")
            cursor.close()
    
    @property
    def engine(self) -> AsyncEngine:
        """Get database engine"""
        if self._engine is None:
            self._initialize_engine()
        return self._engine
    
    @property
    def sessionmaker(self) -> async_sessionmaker:
        """Get session factory"""
        if self._sessionmaker is None:
            self._initialize_engine()
        return self._sessionmaker
    
    async def create_tables(self) -> None:
        """Create all tables in the database"""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
    
    async def drop_tables(self) -> None:
        """Drop all tables from the database"""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            logger.warning("All database tables dropped")
    
    async def check_connection(self) -> bool:
        """Check if database connection is working"""
        try:
            async with self.engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                return True
        except Exception as e:
            logger.error(f"Database connection check failed: {e}")
            return False
    
    async def close(self) -> None:
        """Close database connections"""
        if self._engine:
            await self._engine.dispose()
            logger.info("Database connections closed")
    
    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """
        Provide a transactional scope for database operations
        
        Usage:
            async with db_manager.session() as session:
                # Perform database operations
                await session.commit()
        """
        async with self.sessionmaker() as session:
            try:
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Database session error: {e}")
                raise
            finally:
                await session.close()
    
    async def execute_raw(self, query: str, params: Optional[dict] = None) -> Any:
        """Execute raw SQL query"""
        async with self.session() as session:
            result = await session.execute(text(query), params or {})
            return result.fetchall()
    
    async def health_check(self) -> dict:
        """Perform database health check"""
        try:
            # Check connection
            connection_ok = await self.check_connection()
            
            # Get database stats
            async with self.session() as session:
                # Get database size
                size_query = """
                    SELECT pg_database_size(current_database()) as size
                """
                size_result = await session.execute(text(size_query))
                db_size = size_result.scalar()
                
                # Get connection count
                conn_query = """
                    SELECT count(*) as connections 
                    FROM pg_stat_activity 
                    WHERE datname = current_database()
                """
                conn_result = await session.execute(text(conn_query))
                connection_count = conn_result.scalar()
                
                # Check TimescaleDB
                timescale_query = """
                    SELECT extversion 
                    FROM pg_extension 
                    WHERE extname = 'timescaledb'
                """
                timescale_result = await session.execute(text(timescale_query))
                timescale_version = timescale_result.scalar()
            
            return {
                "status": "healthy" if connection_ok else "unhealthy",
                "connection": connection_ok,
                "database_size_bytes": db_size,
                "active_connections": connection_count,
                "timescaledb_version": timescale_version,
                "pool_size": self._engine.pool.size() if hasattr(self._engine.pool, 'size') else None
            }
        
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Create singleton instance
db_manager = DatabaseManager()


# Dependency injection for FastAPI
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session in FastAPI endpoints
    
    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db_session)):
            # Use db session
    """
    async with db_manager.session() as session:
        yield session


# Initialize database on startup
async def init_database() -> None:
    """Initialize database connections and create tables if needed"""
    try:
        # Check connection
        if not await db_manager.check_connection():
            raise ConnectionError("Failed to connect to database")
        
        # Enable TimescaleDB extension
        if settings.TIMESCALE_ENABLED:
            await db_manager.execute_raw("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE")
            logger.info("TimescaleDB extension enabled")
        
        # Create tables if in development mode
        if settings.ENVIRONMENT == "development":
            await db_manager.create_tables()
            logger.info("Database tables created (development mode)")
        
        # Log database health
        health = await db_manager.health_check()
        logger.info(f"Database health check: {health}")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


# Cleanup on shutdown
async def close_database() -> None:
    """Close database connections on application shutdown"""
    await db_manager.close()


__all__ = [
    "Base",
    "BaseModel",
    "DatabaseManager",
    "db_manager",
    "get_db_session",
    "init_database",
    "close_database"
]