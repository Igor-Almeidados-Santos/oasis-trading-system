import os
import time
import schedule
from motor.motor_asyncio import AsyncIOMotorClient
from src.risk_engine.position_manager import PositionManager
import asyncio

class SnapshotWorker:
    def __init__(self):
        self.product_id = os.getenv("STRATEGY_PRODUCT_ID", "BTC-USD")
        self.mongo_client = AsyncIOMotorClient(os.getenv("MONGO_DB_URI"))
        self.mongodb = self.mongo_client["oasis_db"]
        print("Data Snapshot Worker iniciado.")

    async def take_snapshot(self):
        """Calcula o estado atual do portfólio e salva no MongoDB."""
        try:
            print("A tirar snapshot do portfólio...")
            pos_manager = PositionManager(self.product_id)
            
            # Precisamos de um preço de mercado para calcular o PnL não realizado
            # Esta parte seria mais complexa, aqui usamos o preço médio como placeholder
            current_market_price = pos_manager.average_price 
            unrealized_pnl = pos_manager.get_unrealized_pnl(current_market_price)
            
            # Supondo um capital inicial para o cálculo do valor total
            initial_capital = 1000.0
            portfolio_value = initial_capital + pos_manager.realized_pnl + unrealized_pnl

            snapshot = {
                "timestamp": time.time(),
                "portfolio_value": portfolio_value,
                "realized_pnl": pos_manager.realized_pnl,
                "unrealized_pnl": unrealized_pnl,
                "position_size": pos_manager.position_size,
            }
            
            await self.mongodb.portfolio_history.insert_one(snapshot)
            print(f"Snapshot salvo com sucesso: Valor do Portfólio ${portfolio_value:.2f}")

        except Exception as e:
            print(f"Erro ao tirar snapshot: {e}")

def run_job():
    worker = SnapshotWorker()
    asyncio.run(worker.take_snapshot())

if __name__ == "__main__":
    # Agenda a tarefa para ser executada a cada 5 minutos
    schedule.every(5).minutes.do(run_job)
    print("Snapshot agendado para cada 5 minutos. A aguardar...")
    
    # Executa a primeira vez imediatamente
    run_job() 

    while True:
        schedule.run_pending()
        time.sleep(1)