import os
from binance.client import Client
from binance.exceptions import BinanceAPIException

class BinanceClient:
    def __init__(self):
        api_key = os.getenv("BINANCE_TESTNET_API_KEY")
        api_secret = os.getenv("BINANCE_TESTNET_API_SECRET")

        if not api_key or not api_secret:
            raise ValueError("As variáveis BINANCE_TESTNET_API_KEY ou BINANCE_TESTNET_API_SECRET não foram encontradas no ambiente do contêiner.")

        try:
            self.client = Client(api_key, api_secret)
            self.client.API_URL = 'https://testnet.binance.vision/api'
            self.client.get_account()
            print("Cliente Binance inicializado com sucesso e conectado à Testnet.")
        except BinanceAPIException as e:
            print(f"ERRO CRÍTICO: Falha ao conectar com a Binance. Verifique suas chaves de API e permissões. Erro: {e}")
            raise
        except Exception as e:
            print(f"ERRO CRÍTICO INESPERADO ao inicializar o cliente da Binance: {e}")
            raise

    def create_limit_buy_order(self, symbol: str, quantity: float, price: float) -> dict:
        try:
            order = self.client.create_order(
                symbol=symbol,
                side=Client.SIDE_BUY,
                type=Client.ORDER_TYPE_LIMIT,
                timeInForce=Client.TIME_IN_FORCE_GTC,
                quantity=quantity,
                price=f'{price:.8f}'
            )
            print("Ordem criada com sucesso:", order)
            return order
        except BinanceAPIException as e:
            print(f"Erro ao criar ordem: {e}")
            raise
    # ... (o resto das funções get_order_status e cancel_order permanecem as mesmas)
    def get_order_status(self, symbol: str, order_id: int) -> dict:
        try:
            print(f"Consultando status da ordem ID: {order_id}")
            order = self.client.get_order(symbol=symbol, orderId=order_id)
            print("Status da ordem:", order)
            return order
        except BinanceAPIException as e:
            print(f"Erro ao consultar ordem: {e}")
            raise

    def cancel_order(self, symbol: str, order_id: int) -> dict:
        try:
            print(f"Cancelando ordem ID: {order_id}")
            result = self.client.cancel_order(symbol=symbol, orderId=order_id)
            print("Ordem cancelada com sucesso:", result)
            return result
        except BinanceAPIException as e:
            print(f"Erro ao cancelar ordem: {e}")
            raise