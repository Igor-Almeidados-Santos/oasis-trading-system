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

@app.get("/api/paper/status")
def get_paper_status():
    """Retorna os KPIs da simulação de paper trading."""
    # Esta é uma implementação de exemplo. A lógica de PnL seria mais complexa.
    try:
        db = PostgresManager()
        query = "SELECT COUNT(*) as trade_count FROM orders WHERE exchange_order_id LIKE 'PAPER-%'"
        result = db.execute_query(query, fetch="one")
        return {
            "initial_capital": 1000.0, # Exemplo
            "current_capital": 1050.25, # Exemplo
            "total_pnl_usd": 50.25, # Exemplo
            "total_pnl_pct": 5.02, # Exemplo
            "trade_count": result['trade_count'] if result else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/paper/trades")
def get_paper_trades():
    """Retorna o histórico de trades do modo papel."""
    try:
        db = PostgresManager()
        query = "SELECT side, quantity, price, created_at FROM orders WHERE exchange_order_id LIKE 'PAPER-%' ORDER BY created_at DESC"
        trades = db.execute_query(query, fetch="all")
        return [dict(trade) for trade in trades]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/history")
async def get_portfolio_history():
    """Retorna os últimos 100 snapshots de portfólio para o gráfico."""
    try:
        history_cursor = app.mongodb.portfolio_history.find().sort("timestamp", -1).limit(100)
        history = await history_cursor.to_list(length=100)
        # Inverte a lista para que o gráfico seja exibido na ordem cronológica correta
        return list(reversed(history))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    