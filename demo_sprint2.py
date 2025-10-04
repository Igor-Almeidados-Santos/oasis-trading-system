import grpc

# Importa o código gRPC gerado do NOVO local
from contracts_generated import trading_system_pb2
from contracts_generated import trading_system_pb2_grpc

def run_demo():
    print("--- Iniciando Demonstração da Sprint 2: Integração Risk -> Executor ---")
    channel = grpc.insecure_channel('localhost:50051') # Conecta no RiskEngine
    stub = trading_system_pb2_grpc.RiskEngineStub(channel)

    # --- Cenário 1: Ordem Válida ---
    print("\n[DEMO] Enviando sinal para ORDEM VÁLIDA (Valor: $90.00)...")
    try:
        valid_signal = trading_system_pb2.TradingSignal(
            symbol="BTCUSDT", quantity=0.003, price=30000.0
        )
        response = stub.ProcessSignal(valid_signal)
        print(f"[DEMO] Resposta Recebida: Ordem ID {response.order_id}, Status {response.status}")
    except grpc.RpcError as e:
        print(f"[DEMO] Erro inesperado no cenário válido: {e.details()}")

    # --- Cenário 2: Ordem Inválida ---
    print("\n[DEMO] Enviando sinal para ORDEM INVÁLIDA (Valor: $150.00)...")
    try:
        invalid_signal = trading_system_pb2.TradingSignal(
            symbol="BTCUSDT", quantity=0.005, price=30000.0
        )
        response = stub.ProcessSignal(invalid_signal)
        print(f"[DEMO] Resposta Inesperada: {response}")
    except grpc.RpcError as e:
        print(f"[DEMO] SUCESSO: Erro esperado recebido!")
        print(f"  - Código: {e.code()}")
        print(f"  - Detalhes: {e.details()}")
    
    print("\n--- Demonstração Sprint 2 concluída! ---")

if __name__ == '__main__':
    run_demo()