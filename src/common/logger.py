import structlog
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient

# Processador para enviar logs para o MongoDB
class MongoLogProcessor:
    def __init__(self):
        mongo_uri = os.getenv("MONGO_DB_URI")
        self.client = AsyncIOMotorClient(mongo_uri)
        self.db = self.client["oasis_db"]
        self.collection = self.db["system_logs"]

    def __call__(self, logger, method_name, event_dict):
        # Esta função seria assíncrona num ambiente real
        # Para simplificar, usamos uma chamada síncrona dentro de um loop de eventos
        try:
            import asyncio
            asyncio.run(self.collection.insert_one(event_dict))
        except Exception as e:
            print(f"Failed to log to MongoDB: {e}")
        return event_dict

def get_logger(service_name: str):
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
            # MongoLogProcessor(), # Descomentar para ativar o log no DB
        ],
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
    )
    return structlog.get_logger(service_name=service_name)