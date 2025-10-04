import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from jinja2 import Environment, FileSystemLoader
from motor.motor_asyncio import AsyncIOMotorClient
from src.common.db_manager import PostgresManager
from src.risk_engine.position_manager import PositionManager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configura o Jinja2 para renderizar o template HTML da pasta correta
templates = Environment(loader=FileSystemLoader("src/webservice/templates"))

@app.on_event("startup")
async def startup_db_client():
    app.mongodb_client = AsyncIOMotorClient(os.getenv("MONGO_DB_URI"))
    app.mongodb = app.mongodb_client["oasis_db"]
    print("Conexão com o MongoDB estabelecida.")

@app.on_event("shutdown")
async def shutdown_db_client():
    app.mongodb_client.close()

# ✅ CORREÇÃO: Adiciona o endpoint para servir o index.html na rota "/"
@app.get("/", response_class=HTMLResponse)
async def read_root():
    template = templates.get_template("index.html")
    return HTMLResponse(content=template.render(request={}))

@app.get("/api/status")
def get_status():
    try:
        product_id = os.getenv("STRATEGY_PRODUCT_ID", "BTC-USD")
        pos_manager = PositionManager(product_id)
        return {
            "product_id": pos_manager.product_id,
            "position_size": pos_manager.position_size,
            "average_price": pos_manager.average_price,
            "realized_pnl": pos_manager.realized_pnl,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))