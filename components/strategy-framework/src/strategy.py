# File: components/strategy-framework/src/strategy.py

from abc import ABC, abstractmethod
import logging
from generated import market_data_pb2, actions_pb2

log = logging.getLogger(__name__)

class Strategy(ABC):
    """
    Classe base abstrata para todas as estratégias de negociação.

    Define a interface que o StrategyFramework usará para interagir
    com a lógica de uma estratégia específica.
    """

    def __init__(self, strategy_id: str):
        self.strategy_id = strategy_id
        # --- NOVOS ATRIBUTOS DE ESTADO ---
        self.enabled: bool = True
        self.mode: actions_pb2.TradingMode = actions_pb2.REAL
        log.info(
            "Estratégia '%s' inicializada (Enabled: %s, Mode: %s).",
            self.strategy_id,
            self.enabled,
            actions_pb2.TradingMode.Name(self.mode),
        )

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

    # --- NOVOS MÉTODOS PARA CONTROLO ---
    def set_enabled(self, enabled: bool):
        if self.enabled != enabled:
            self.enabled = enabled
            log.warning(
                "Estratégia '%s' alterada para Enabled: %s",
                self.strategy_id,
                self.enabled,
            )

    def set_mode(self, mode_str: str):
        new_mode = actions_pb2.TradingMode.Value(mode_str.upper())
        if self.mode != new_mode:
            self.mode = new_mode
            log.warning(
                "Estratégia '%s' alterada para Mode: %s",
                self.strategy_id,
                actions_pb2.TradingMode.Name(self.mode),
            )
