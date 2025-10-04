import os
import uuid
from coinbase.rest import Client

class CoinbaseClient:
    """
    Encapsula toda a lógica de comunicação com a API da Coinbase Advanced Trade,
    usando a biblioteca oficial 'coinbase-advanced-py'.
    """
    def __init__(self):
        api_key = os.getenv("COINBASE_API_KEY")
        private_key = os.getenv("COINBASE_PRIVATE_KEY")

        if not api_key or not private_key:
            raise ValueError("As variáveis COINBASE_API_KEY ou COINBASE_PRIVATE_KEY não foram encontradas.")

        try:
            # A inicialização correta para a biblioteca 'coinbase-advanced-py'
            self.client = Client(api_key=api_key, api_secret=private_key)
            # Chamada de teste para validar as chaves na inicialização
            self.client.get_accounts()
            print("Cliente Coinbase inicializado com sucesso.")
        except Exception as e:
            print(f"ERRO CRÍTICO: Falha ao inicializar o cliente da Coinbase. Verifique suas chaves de API. Erro: {e}")
            raise

    def create_limit_buy_order(self, symbol: str, quantity: float, price: float) -> dict:
        """Cria uma ordem de compra a limite na Coinbase."""
        try:
            client_order_id = str(uuid.uuid4())
            product_id = symbol.replace('/', '-') # Formato da Coinbase: 'BTC-USD'
            
            print(f"Enviando ordem de COMPRA para Coinbase: {quantity} {product_id} @ {price}")
            
            # Sintaxe correta para criar ordem com a biblioteca 'coinbase-advanced-py'
            result = self.client.post_order(
                client_order_id=client_order_id,
                product_id=product_id,
                side="BUY",
                order_configuration={
                    "limit_limit_gtc": {
                        "base_size": str(quantity),
                        "limit_price": f'{price:.2f}',
                        "post_only": False,
                    }
                },
            )
            
            order_id = result.get('order_id', '')
            print("Ordem criada com sucesso na Coinbase:", {"order_id": order_id})
            return {"orderId": order_id, "status": "NEW"}

        except Exception as e:
            print(f"Erro ao criar ordem na Coinbase: {e}")
            raise
    
    # As funções abaixo também foram atualizadas para a nova biblioteca
    def get_order_status(self, symbol: str, order_id: str) -> dict:
        try:
            print(f"Consultando status da ordem ID: {order_id} na Coinbase")
            result = self.client.get_order(order_id=order_id)
            status = result.get('order', {}).get('status', 'UNKNOWN')
            print("Status da ordem:", status)
            return {"status": status}
        except Exception as e:
            print(f"Erro ao consultar ordem na Coinbase: {e}")
            raise

    def cancel_order(self, symbol: str, order_id: str) -> dict:
        try:
            print(f"Cancelando ordem ID: {order_id} na Coinbase")
            result = self.client.cancel_orders(order_ids=[order_id])
            success_id = result.get('results', [{}])[0].get('order_id')
            print("Resultado do cancelamento:", result)
            return {"status": "CANCELED" if success_id == order_id else "UNKNOWN"}
        except Exception as e:
            print(f"Erro ao cancelar ordem na Coinbase: {e}")
            raise