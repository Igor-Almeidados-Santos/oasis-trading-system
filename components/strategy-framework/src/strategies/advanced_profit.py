"""Advanced multi-asset trading strategy focused on trend following + risk control."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import logging
from typing import Deque, Dict, Iterable, List

from google.protobuf.timestamp_pb2 import Timestamp

from generated import actions_pb2, market_data_pb2
from strategy import Strategy

log = logging.getLogger(__name__)


@dataclass
class StrategyParameters:
    fast_window: int = 5
    slow_window: int = 21
    min_signal_strength: float = 0.002  # 20 bps
    take_profit: float = 0.012          # 1.2%
    stop_loss: float = 0.006            # 0.6%
    position_size_pct: float = 0.10     # 10% do capital disponível


class AdvancedProfitStrategy(Strategy):
    """Trend/momentum strategy that alternates between long/flat positions.

    The strategy monitors a configurable list of symbols, keeping short/long
    moving averages to detect breakouts. When the fast average crosses the slow
    average with sufficient strength it emits BUY signals. Once in position it
    monitors both take-profit and stop-loss thresholds to secure profits.
    """

    def __init__(
        self,
        strategy_id: str,
        symbols: Iterable[str],
        *,
        parameters: StrategyParameters | None = None,
        initial_cash: float = 10_000.0,
    ) -> None:
        super().__init__(strategy_id)
        self._parameters = parameters or StrategyParameters()
        self._symbols: set[str] = set()
        self._price_history: Dict[str, Deque[float]] = {}
        self._position_state: Dict[str, str] = {}
        self._entry_price: Dict[str, float] = {}
        self._last_price: Dict[str, float] = {}
        self._cash_balance: float = max(initial_cash, 0.0)
        self.set_symbols(symbols)

    # ------------------------------------------------------------------
    # Configuration helpers
    # ------------------------------------------------------------------
    def set_symbols(self, symbols: Iterable[str]) -> None:
        updated = {symbol.upper() for symbol in symbols if symbol}
        removed = self._symbols - updated
        added = updated - self._symbols

        if added:
            log.info(
                "[%s] Adicionando símbolos à estratégia: %s",
                self.strategy_id,
                ", ".join(sorted(added)),
            )
        if removed:
            log.info(
                "[%s] Removendo símbolos da estratégia: %s",
                self.strategy_id,
                ", ".join(sorted(removed)),
            )

        self._symbols = updated

        # Garante que o estado interno acompanha a nova lista
        for symbol in added:
            self._price_history[symbol] = deque(
                maxlen=max(self._parameters.slow_window, 50)
            )
            self._position_state.setdefault(symbol, "FLAT")

        for symbol in removed:
            self._price_history.pop(symbol, None)
            self._position_state.pop(symbol, None)
            self._entry_price.pop(symbol, None)
            self._last_price.pop(symbol, None)

    def set_cash_balance(self, amount: float) -> None:
        if amount < 0:
            log.warning(
                "[%s] Cash balance negativo recebido (%.2f). Normalizando para 0.",
                self.strategy_id,
                amount,
            )
            amount = 0.0
        self._cash_balance = float(amount)
        log.info(
            "[%s] Novo saldo de caixa configurado: %.2f USD",
            self.strategy_id,
            self._cash_balance,
        )

    def update_parameters(
        self,
        *,
        fast_window: int | None = None,
        slow_window: int | None = None,
        min_signal_strength: float | None = None,
        take_profit: float | None = None,
        stop_loss: float | None = None,
        position_size_pct: float | None = None,
    ) -> None:
        params = self._parameters

        if fast_window is not None and fast_window > 1:
            params.fast_window = fast_window
        if slow_window is not None and slow_window > params.fast_window:
            params.slow_window = slow_window
        if min_signal_strength is not None and min_signal_strength > 0:
            params.min_signal_strength = min_signal_strength
        if take_profit is not None and take_profit > 0:
            params.take_profit = take_profit
        if stop_loss is not None and stop_loss > 0:
            params.stop_loss = stop_loss
        if position_size_pct is not None and 0 < position_size_pct <= 1:
            params.position_size_pct = position_size_pct

        # Atualiza histórico para refletir janelas novas
        max_window = max(params.slow_window, 50)
        for symbol in list(self._price_history.keys()):
            history = self._price_history[symbol]
            if history.maxlen != max_window:
                self._price_history[symbol] = deque(history, maxlen=max_window)

        log.info(
            "[%s] Parâmetros atualizados: fast=%d slow=%d min_signal=%.4f TP=%.4f SL=%.4f pos%%=%.2f",
            self.strategy_id,
            params.fast_window,
            params.slow_window,
            params.min_signal_strength,
            params.take_profit,
            params.stop_loss,
            params.position_size_pct,
        )

    # ------------------------------------------------------------------
    # Trading logic
    # ------------------------------------------------------------------
    async def on_trade(
        self,
        trade_update: market_data_pb2.TradeUpdate,
        header: market_data_pb2.Header,
    ) -> List[actions_pb2.TradingSignal]:
        if not self.enabled:
            return []

        symbol = header.symbol.upper()
        if symbol not in self._symbols:
            return []

        price = float(trade_update.price)
        history = self._price_history.setdefault(
            symbol,
            deque(maxlen=max(self._parameters.slow_window, 50)),
        )
        history.append(price)
        self._last_price[symbol] = price

        if len(history) < self._parameters.slow_window:
            # Espera acumular histórico suficiente
            return []

        params = self._parameters
        fast_window = min(params.fast_window, len(history))
        slow_window = min(params.slow_window, len(history))

        history_list = list(history)
        fast_avg = sum(history_list[-fast_window:]) / fast_window
        slow_avg = sum(history_list[-slow_window:]) / slow_window

        if slow_avg <= 0:
            return []

        signal_strength = (fast_avg - slow_avg) / slow_avg
        state = self._position_state.get(symbol, "FLAT")
        signals: List[actions_pb2.TradingSignal] = []

        timestamp = Timestamp()
        timestamp.GetCurrentTime()

        # Condições de entrada (compra)
        if state != "LONG" and signal_strength > params.min_signal_strength:
            log.info(
                "[%s] BUY sinal %s | fast %.2f slow %.2f strength %.4f",
                self.strategy_id,
                symbol,
                fast_avg,
                slow_avg,
                signal_strength,
            )
            signals.append(
                actions_pb2.TradingSignal(
                    strategy_id=self.strategy_id,
                    symbol=symbol,
                    side="BUY",
                    confidence=min(0.99, 0.5 + abs(signal_strength) * 10),
                    signal_timestamp=timestamp,
                    mode=self.mode,
                )
            )
            self._position_state[symbol] = "LONG"
            self._entry_price[symbol] = price
            return signals

        if state == "LONG":
            entry_price = self._entry_price.get(symbol, price)
            unrealized = (
                (price - entry_price) / entry_price if entry_price else 0.0
            )

            exit_reasons: list[str] = []
            if unrealized >= params.take_profit:
                exit_reasons.append("take_profit")
            if unrealized <= -params.stop_loss:
                exit_reasons.append("stop_loss")
            if signal_strength < -params.min_signal_strength:
                exit_reasons.append("trend_reversal")

            if exit_reasons:
                log.info(
                    "[%s] SELL sinal %s | motivos=%s gain=%.4f",
                    self.strategy_id,
                    symbol,
                    ",".join(exit_reasons),
                    unrealized,
                )
                signals.append(
                    actions_pb2.TradingSignal(
                        strategy_id=self.strategy_id,
                        symbol=symbol,
                        side="SELL",
                        confidence=min(0.99, 0.6 + abs(unrealized) * 12),
                        signal_timestamp=timestamp,
                        mode=self.mode,
                    )
                )
                self._position_state[symbol] = "FLAT"
                self._entry_price.pop(symbol, None)

        return signals

    # ------------------------------------------------------------------
    # Introspection helpers (useful for the dashboard)
    # ------------------------------------------------------------------
    def snapshot(self) -> dict:
        return {
            "strategy_id": self.strategy_id,
            "symbols": sorted(self._symbols),
            "parameters": self._parameters.__dict__,
            "cash_balance": self._cash_balance,
            "positions": self._position_state.copy(),
            "entry_prices": self._entry_price.copy(),
        }
