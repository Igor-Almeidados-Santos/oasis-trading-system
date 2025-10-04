import grpc
import os
from concurrent import futures
from dotenv import load_dotenv
from src.contracts_generated import trading_system_pb2
from src.contracts_generated import trading_system_pb2_grpc

class RiskEngineService(trading_system_pb2_grpc.RiskEngineServicer):
    def __init__(self):
        load_dotenv()
        self.max_order_size = float(os.getenv("RISK_MAX_ORDER_SIZE_USD", 100.0))
        self.daily_pnl = 0.0
        print("RiskEngine iniciado.")
        print(f" - Tamanho Máximo da Ordem: ${self.max_order_size}")
        
        self.execution_channel = grpc.insecure_channel('order-executor:50052')
        self.execution_stub = trading_system_pb2_grpc.ExecutionServiceStub(self.execution_channel)

    def ProcessSignal(self, request: trading_system_pb2.TradingSignal, context):
        print(f"\n[RiskEngine] Sinal recebido para {request.symbol}")
        
        order_value = request.quantity * request.price
        if order_value > self.max_order_size:
            msg = f"REJEITADO: Valor da ordem ${order_value:.2f} excede o limite de ${self.max_order_size:.2f}."
            print(f"[RiskEngine] {msg}")
            context.set_details(msg)
            context.set_code(grpc.StatusCode.FAILED_PRECONDITION)
            return trading_system_pb2.OrderResponse()

        print("[RiskEngine] Validação de tamanho OK.")
        
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