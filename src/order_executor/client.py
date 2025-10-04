import os
import uuid
from coinbase.rest import RESTClient  
class CoinbaseClient:
    def __init__(self):
        self.execution_mode = os.getenv("EXECUTION_MODE", "PAPER").upper()
        if self.execution_mode == "LIVE":
            api_key = os.getenv("COINBASE_API_KEY")
            private_key = os.getenv("COINBASE_PRIVATE_KEY")
            if not api_key or not private_key:
                raise ValueError("Para o modo LIVE, as chaves de API da Coinbase são necessárias.")
            try:
                self.client = RESTClient(api_key=api_key, api_secret=private_key) # ✅ CORREÇÃO
                self.client.get_accounts()
                print("Cliente Coinbase inicializado com sucesso em modo LIVE.")
            except Exception as e:
                print(f"ERRO CRÍTICO ao inicializar o cliente Coinbase: {e}")
                raise
        else:
            self.client = None
            print("Cliente Coinbase inicializado em modo PAPER (simulação).")

    def create_limit_buy_order(self, symbol: str, quantity: float, price: float) -> dict:
        if self.execution_mode == "PAPER":
            order_id = f"PAPER-{uuid.uuid4().hex[:12]}"
            print(f"[PAPER_MODE] Ordem de compra simulada: {quantity} {symbol} @ ${price:.2f} (ID: {order_id})")
            return {"orderId": order_id, "status": "NEW"}
        
        client_order_id = str(uuid.uuid4())
        product_id = symbol.replace('/', '-')
        try:
            result = self.client.post_order(
                client_order_id=client_order_id, product_id=product_id, side="BUY",
                order_configuration={"limit_limit_gtc": {"base_size": str(quantity), "limit_price": f'{price:.2f}'}}
            )
            return {"orderId": result.get('order_id', ''), "status": "NEW"}
        except Exception as e:
            print(f"Erro ao criar ordem na Coinbase: {e}")
            raise