# File: components/strategy-framework/src/strategies/momentum.py

from strategy import Strategy
from generated import market_data_pb2, actions_pb2
from google.protobuf.timestamp_pb2 import Timestamp
import logging

log = logging.getLogger(__name__)

class SimpleMomentum(Strategy):
    """
    Uma estratégia de momentum muito simples que gera um sinal de compra
    se o preço atual for maior que o preço anterior para um dado símbolo.
    """
    def __init__(self, strategy_id: str, symbol_to_watch: str):
        super().__init__(strategy_id)
        self.symbol_to_watch = symbol_to_watch
        self.last_price = 0.0

    async def on_trade(
        self, trade_update: market_data_pb2.TradeUpdate, header: market_data_pb2.Header
    ) -> list[actions_pb2.TradingSignal]:
        """
        Processa uma nova negociação e decide se gera um sinal.
        """
        # --- VERIFICAÇÃO DE ESTADO (NOVO) ---
        if not self.enabled:
            return []

        # Ignora trades de símbolos que não estamos a monitorizar
        if header.symbol != self.symbol_to_watch:
            return []

        signals = []
        current_price = float(trade_update.price)

        if self.last_price > 0 and current_price > self.last_price:
            log.warning(
                f"SINAL DE COMPRA ({actions_pb2.TradingMode.Name(self.mode)}): "
                f"Símbolo={header.symbol}, Preço Atual ({current_price}) > Preço Anterior ({self.last_price})"
            )

            # Cria o objeto TradingSignal
            signal = actions_pb2.TradingSignal(
                strategy_id=self.strategy_id,
                symbol=header.symbol,
                side="BUY",
                confidence=0.75,
                signal_timestamp=Timestamp(),
                mode=self.mode,
            )
            signals.append(signal)

        self.last_price = current_price
        return signals
