import os
import sys
import json
import websocket
import threading
import grpc
from dotenv import load_dotenv

from src.contracts_generated import trading_system_pb2
from src.contracts_generated import trading_system_pb2_grpc
from .grid_logic import GridStrategy
from src.common.db_manager import PostgresManager

class StrategyEngineService:
    def __init__(self):
        load_dotenv()
        
        self.product_id = os.getenv("STRATEGY_PRODUCT_ID", "BTC-USD")
        
        self.strategy = GridStrategy(
            grid_levels=int(os.getenv("STRATEGY_GRID_LEVELS", 10)),
            grid_spacing_pct=float(os.getenv("STRATEGY_GRID_SPACING_PCT", 0.5)),
            order_size=float(os.getenv("STRATEGY_ORDER_SIZE", 0.0001))
        )
        
        self.db_manager = PostgresManager()
        self._load_or_create_strategy_state()

        risk_engine_url = os.getenv("RISK_SERVICE_URL", "localhost:50051")
        self.risk_channel = grpc.insecure_channel(risk_engine_url)
        self.risk_stub = trading_system_pb2_grpc.RiskEngineStub(self.risk_channel)
        
        print(f"StrategyEngine iniciado para o produto: {self.product_id}")

    def _load_or_create_strategy_state(self):
        query = "SELECT grid_state, last_price FROM strategy_state WHERE product_id = %s"
        state = self.db_manager.execute_query(query, (self.product_id,), fetch="one")
        if state and state['grid_state']:
            print("Estado da estratégia carregado do banco de dados.")
            self.strategy.grid = state['grid_state']
            self.strategy.last_price = float(state['last_price'])
        else:
            print("Nenhum estado encontrado. A estratégia iniciará do zero.")

    def _save_strategy_state(self):
        query = """
        INSERT INTO strategy_state (product_id, grid_state, last_price)
        VALUES (%s, %s, %s)
        ON CONFLICT (product_id) DO UPDATE SET
            grid_state = EXCLUDED.grid_state,
            last_price = EXCLUDED.last_price,
            updated_at = NOW();
        """
        grid_state_json = json.dumps(self.strategy.grid)
        self.db_manager.execute_query(query, (self.product_id, grid_state_json, self.strategy.last_price))
        print("Estado da estratégia salvo no banco de dados.")

    # --- CORREÇÃO DE INDENTAÇÃO AQUI ---
    def check_for_kill_switch(self):
        """Verifica se o arquivo de sinal existe no volume compartilhado."""
        if os.path.exists("/app/shared/stop_signal"):
            print("SINAL DE PARADA DETECTADO! Encerrando operações...")
            os.remove("/app/shared/stop_signal")
            sys.exit(0)

    def on_message(self, ws, message):
        self.check_for_kill_switch() # A chamada está corretamente indentada aqui
        
        msg = json.loads(message)
        events = msg.get('events', [])
        if not events:
            return

        for event in events:
            if event.get('type') == 'update':
                for update in event.get('updates', []):
                    price_str = update.get('price_level')
                    if price_str:
                        current_price = float(price_str)
                        print(f"Novo preço recebido: ${current_price:.2f}")

                        signals = self.strategy.process_price_update(current_price)
                        if signals:
                            for signal in signals:
                                self.send_signal_to_risk_engine(signal)
                            self._save_strategy_state()

    def on_error(self, ws, error):
        print(f"Erro no WebSocket: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        print("### Conexão WebSocket fechada ###")

    def on_open(self, ws):
        print(f"Conexão WebSocket aberta para {self.product_id}")
        # A lógica de autenticação do WebSocket será aprimorada em sprints futuras
        subscribe_message = {
            "type": "subscribe",
            "product_ids": [self.product_id],
            "channel": "level2",
        }
        ws.send(json.dumps(subscribe_message))

    def run(self):
        ws_url = "wss://advanced-trade-ws.coinbase.com"
        ws = websocket.WebSocketApp(ws_url,
                                  on_open=self.on_open,
                                  on_message=self.on_message,
                                  on_error=self.on_error,
                                  on_close=self.on_close)
        ws.run_forever()

    def send_signal_to_risk_engine(self, signal: dict):
        try:
            print(f"[StrategyEngine] Enviando sinal de {signal.get('side', 'UNKNOWN')} para o RiskEngine...")
            signal_request = trading_system_pb2.TradingSignal(
                symbol=self.product_id,
                quantity=signal['quantity'],
                price=signal['price']
            )
            response = self.risk_stub.ProcessSignal(signal_request)
            print(f"[StrategyEngine] Resposta do RiskEngine: Ordem ID {response.order_id}, Status {response.status}")
        except grpc.RpcError as e:
            print(f"[StrategyEngine] Erro ao enviar sinal para o RiskEngine: {e.details()}")

if __name__ == '__main__':
    engine = StrategyEngineService()
    engine.run()