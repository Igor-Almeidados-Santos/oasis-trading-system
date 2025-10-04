import time
from src.order_executor.client import BinanceClient

def run_demo():
    """
    Executa uma demonstração completa do ciclo de vida de uma ordem.
    """
    print("--- Iniciando Demonstração do Order Executor ---")
    
    try:
        client = BinanceClient()
        symbol = 'BTCUSDT'
        quantity = 0.01
        price = 25000.00 # Um preço baixo para garantir que a ordem não seja executada imediatamente

        # 1. Criar uma ordem
        created_order = client.create_limit_buy_order(symbol, quantity, price)
        order_id = created_order['orderId']
        
        print("\n--- Ordem criada. Aguardando 5 segundos... ---")
        time.sleep(5)

        # 2. Consultar o status da ordem
        order_status = client.get_order_status(symbol, order_id)
        assert order_status['status'] == 'NEW'
        
        print(f"\n--- Status confirmado como '{order_status['status']}'. Aguardando 5 segundos... ---")
        time.sleep(5)

        # 3. Cancelar a ordem
        client.cancel_order(symbol, order_id)
        
        print("\n--- Demonstração concluída com sucesso! ---")

    except Exception as e:
        print(f"\n--- A demonstração falhou: {e} ---")

if __name__ == "__main__":
    run_demo()