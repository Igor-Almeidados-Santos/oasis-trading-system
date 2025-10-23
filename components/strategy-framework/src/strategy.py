# File: components/strategy-framework/src/strategy.py

from abc import ABC, abstractmethod
import logging

# Importamos as nossas mensagens Protobuf geradas
from generated import market_data_pb2
from generated import actions_pb2 # Assumindo que actions.proto também será gerado

log = logging.getLogger(__name__)

class Strategy(ABC):
    """
    Classe base abstrata para todas as estratégias de negociação.

    Define a interface que o StrategyFramework usará para interagir
    com a lógica de uma estratégia específica.
    """

    def __init__(self, strategy_id: str):
        self.strategy_id = strategy_id
        log.info(f"Estratégia '{self.strategy_id}' inicializada.")

    @abstractmethod
    async def on_trade(
        self, trade_update: market_data_pb2.TradeUpdate, header: market_data_pb2.Header
    ) -> list[actions_pb2.TradingSignal]:
        """
        Método chamado para cada nova negociação recebida do mercado.

        Args:
            trade_update: O objeto Protobuf TradeUpdate com os dados da negociação.
            header: O objeto Header com metadados como o símbolo.

        Returns:
            Uma lista de TradingSignal (pode estar vazia se nenhuma ação for necessária).
        """
        pass