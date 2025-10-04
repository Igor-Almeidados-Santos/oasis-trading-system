import grpc
from concurrent import futures
from src.contracts_generated import trading_system_pb2
from src.contracts_generated import trading_system_pb2_grpc
from .client import BinanceClient

class ExecutionService(trading_system_pb2_grpc.ExecutionServiceServicer):
    def __init__(self):
        self.binance_client = BinanceClient()
        print("ExecutionService iniciado.")

    def PlaceLimitBuyOrder(self, request: trading_system_pb2.OrderRequest, context):
        try:
            result = self.binance_client.create_limit_buy_order(
                symbol=request.symbol,
                quantity=request.quantity,
                price=request.price
            )
            return trading_system_pb2.OrderResponse(
                order_id=str(result['orderId']),
                status=result['status']
            )
        except Exception as e:
            context.set_details(f"Erro na API da Binance: {str(e)}")
            context.set_code(grpc.StatusCode.INTERNAL)
            return trading_system_pb2.OrderResponse()

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    trading_system_pb2_grpc.add_ExecutionServiceServicer_to_server(ExecutionService(), server)
    server.add_insecure_port('[::]:50052')
    server.start()
    print("Servidor ExecutionService escutando na porta 50052.")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()