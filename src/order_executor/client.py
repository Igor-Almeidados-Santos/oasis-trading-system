import os
import uuid
from coinbase.rest import RESTClient  # ✅ Import correto!

class CoinbaseClient:
    """
    Encapsula toda a lógica de comunicação com a API da Coinbase Advanced Trade.
    """
    def __init__(self):
        api_key = os.getenv("COINBASE_API_KEY")
        private_key = os.getenv("COINBASE_PRIVATE_KEY")
        
        # Modo Mock para desenvolvimento sem credenciais válidas
        self.mock_mode = os.getenv("USE_MOCK_EXCHANGE", "false").lower() == "true"
        
        if self.mock_mode:
            print("⚠️  MODO MOCK ATIVADO - Simulando API da Coinbase")
            self.client = None
            return

        if not api_key or not private_key:
            raise ValueError("As variáveis COINBASE_API_KEY ou COINBASE_PRIVATE_KEY não foram encontradas.")

        try:
            self.client = RESTClient(api_key=api_key, api_secret=private_key)
            print("Cliente Coinbase inicializado com sucesso.")
        except Exception as e:
            print(f"ERRO: Falha ao inicializar o cliente da Coinbase: {e}")
            raise

    def create_limit_buy_order(self, symbol: str, quantity: float, price: float) -> dict:
        """Cria uma ordem de compra a limite na Coinbase."""
        if self.mock_mode:
            order_id = f"MOCK-{uuid.uuid4().hex[:8]}"
            print(f"[MOCK] Ordem criada: {quantity} {symbol} @ ${price:.2f} (ID: {order_id})")
            return {"orderId": order_id, "status": "NEW"}
        
        try:
            client_order_id = str(uuid.uuid4())
            product_id = symbol.replace('/', '-')
            
            print(f"Enviando ordem de COMPRA para Coinbase: {quantity} {product_id} @ {price}")
            
            result = self.client.limit_order_gtc_buy(
                client_order_id=client_order_id,
                product_id=product_id,
                base_size=str(quantity),
                limit_price=str(price)
            )
            
            order_id = result.get('order_id', '')
            print("Ordem criada com sucesso na Coinbase:", {"order_id": order_id})
            return {"orderId": order_id, "status": "NEW"}

        except Exception as e:
            print(f"Erro ao criar ordem na Coinbase: {e}")
            raise