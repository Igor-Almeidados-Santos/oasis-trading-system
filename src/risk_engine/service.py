import grpc
import os
from concurrent import futures
from dotenv import load_dotenv
from src.contracts_generated import trading_system_pb2
from src.contracts_generated import trading_system_pb2_grpc
from .position_manager import PositionManager

class RiskEngineService(trading_system_pb2_grpc.RiskEngineServicer):
    def __init__(self):
        # ... (inicialização do load_dotenv, max_order_size, stubs gRPC) ...
        self.product_id = os.getenv("STRATEGY_PRODUCT_ID", "BTC-USD")
        self.max_capital_allocation_pct = float(os.getenv("STRATEGY_CAPITAL_ALLOCATION", 0.15)) # Regra X
        self.position_manager = PositionManager(self.product_id)

    def ProcessSignal(self, request: trading_system_pb2.TradingSignal, context):
        # ... (validação de tamanho da ordem como antes - Regra Y) ...
        
        # Validação 2: Exposição Máxima (Regra X)
        # Supondo um capital total para o cálculo
        total_capital = 1000.0 # Deveria vir de uma configuração mais robusta
        current_exposure = self.position_manager.get_total_exposure_usd()
        signal_value = request.quantity * request.price
        
        if (current_exposure + signal_value) > (total_capital * self.max_capital_allocation_pct):
            msg = f"REJEITADO: Nova ordem excederia a alocação máxima de capital de {self.max_capital_allocation_pct:.0%}."
            print(f"[RiskEngine] {msg}")
            context.set_details(msg)
            context.set_code(grpc.StatusCode.FAILED_PRECONDITION)
            return trading_system_pb2.OrderResponse()

        print("[RiskEngine] Validação de exposição OK.")
        
        print("[RiskEngine] Encaminhando para execução...")
        try:
            order_req = trading_system_pb2.OrderRequest(
                symbol=request.symbol, 
                quantity=request.quantity, 
                price=request.price
            )
            response = self.execution_stub.PlaceLimitBuyOrder(order_req)
            print("[RiskEngine] Ordem processada pelo Executor.")
            return response
        except grpc.RpcError as e:
            print(f"[RiskEngine] Erro ao comunicar com o Executor: {e.details()}")
            context.set_details(e.details())
            context.set_code(e.code())
            return trading_system_pb2.OrderResponse()

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    trading_system_pb2_grpc.add_RiskEngineServicer_to_server(RiskEngineService(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    print("Servidor RiskEngine escutando na porta 50051.")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()