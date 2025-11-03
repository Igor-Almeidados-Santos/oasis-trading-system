"""Simple test strategy that emits alternating BUY/SELL signals for demos."""

from __future__ import annotations

from dataclasses import dataclass
import logging
import time
from typing import Dict, Iterable, List

from google.protobuf.timestamp_pb2 import Timestamp

from generated import actions_pb2, market_data_pb2
from strategy import Strategy

log = logging.getLogger(__name__)


@dataclass
class TestStrategyParameters:
    cooldown_seconds: float = 3.0
    position_size_pct: float = 0.5  # fraction of the configured cash balance
    batch_size: int = 10
    batch_interval_seconds: float = 600.0  # 10 minutos


class TestSimulatorStrategy(Strategy):
    """Strategy that alternates BUY/SELL signals to populate paper trading quickly."""

    def __init__(
        self,
        strategy_id: str,
        symbols: Iterable[str],
        *,
        parameters: TestStrategyParameters | None = None,
        initial_cash: float = 1_000.0,
    ) -> None:
        super().__init__(strategy_id)
        self._parameters = parameters or TestStrategyParameters()
        self._symbols: set[str] = set(symbol.upper() for symbol in symbols if symbol)
        self._cash_balance: float = max(initial_cash, 0.0)
        self._position_state: Dict[str, str] = {symbol: "FLAT" for symbol in self._symbols}
        self._last_action_ts: Dict[str, float] = {symbol: 0.0 for symbol in self._symbols}
        self._last_batch_ts: Dict[str, float] = {symbol: 0.0 for symbol in self._symbols}
        self._entry_price: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # Configuration helpers
    # ------------------------------------------------------------------
    def set_symbols(self, symbols: Iterable[str]) -> None:
        updated = {symbol.upper() for symbol in symbols if symbol}
        removed = self._symbols - updated
        added = updated - self._symbols

        if added:
            log.info("[%s] Test strategy adicionando símbolos: %s", self.strategy_id, ", ".join(sorted(added)))
        if removed:
            log.info("[%s] Test strategy removendo símbolos: %s", self.strategy_id, ", ".join(sorted(removed)))

        self._symbols = updated
        for symbol in added:
            self._position_state[symbol] = "FLAT"
            self._last_action_ts[symbol] = 0.0
            self._last_batch_ts[symbol] = 0.0
        for symbol in removed:
            self._position_state.pop(symbol, None)
            self._last_action_ts.pop(symbol, None)
            self._last_batch_ts.pop(symbol, None)
            self._entry_price.pop(symbol, None)

    def set_cash_balance(self, amount: float) -> None:
        self._cash_balance = max(float(amount), 0.0)
        log.info("[%s] Test strategy cash atualizado: %.2f USD", self.strategy_id, self._cash_balance)

    def update_parameters(
        self,
        *,
        cooldown_seconds: float | None = None,
        position_size_pct: float | None = None,
        batch_size: int | None = None,
        batch_interval_seconds: float | None = None,
        fast_window: float | None = None,
        slow_window: float | None = None,
        **_: object,
    ) -> None:
        params = self._parameters
        effective_cooldown = cooldown_seconds
        if effective_cooldown is None:
            if fast_window is not None:
                effective_cooldown = float(fast_window)
            elif slow_window is not None:
                effective_cooldown = float(slow_window)
        if effective_cooldown is not None and effective_cooldown >= 0:
            params.cooldown_seconds = float(effective_cooldown)
        if position_size_pct is not None and 0 < position_size_pct <= 1:
            params.position_size_pct = float(position_size_pct)
        if batch_size is not None and batch_size > 0:
            params.batch_size = int(batch_size)
        if batch_interval_seconds is not None and batch_interval_seconds >= 0:
            params.batch_interval_seconds = float(batch_interval_seconds)
        log.info(
            "[%s] Test strategy parâmetros atualizados: cooldown=%.2fs pos%%=%.2f lotes=%d intervalo=%.1fs",
            self.strategy_id,
            params.cooldown_seconds,
            params.position_size_pct,
            params.batch_size,
            params.batch_interval_seconds,
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

        try:
            price = float(trade_update.price)
        except (TypeError, ValueError):
            price = 0.0

        now = time.time()
        last_batch = self._last_batch_ts.get(symbol, 0.0)

        if now - last_batch < self._parameters.batch_interval_seconds:
            last_ts = self._last_action_ts.get(symbol, 0.0)
            if now - last_ts < self._parameters.cooldown_seconds:
                return []
            state = self._position_state.get(symbol, "FLAT")
            signals: List[actions_pb2.TradingSignal] = []
            timestamp = Timestamp()
            timestamp.GetCurrentTime()
            if state != "LONG":
                log.info("[%s] TEST BUY %s (cooldown %.1fs)", self.strategy_id, symbol, self._parameters.cooldown_seconds)
                signals.append(
                    actions_pb2.TradingSignal(
                        strategy_id=self.strategy_id,
                        symbol=symbol,
                        side="BUY",
                        confidence=0.8,
                        signal_timestamp=timestamp,
                        mode=self.mode,
                    )
                )
                self._position_state[symbol] = "LONG"
                self._entry_price[symbol] = price
            else:
                log.info("[%s] TEST SELL %s (cooldown %.1fs)", self.strategy_id, symbol, self._parameters.cooldown_seconds)
                signals.append(
                    actions_pb2.TradingSignal(
                        strategy_id=self.strategy_id,
                        symbol=symbol,
                        side="SELL",
                        confidence=0.85,
                        signal_timestamp=timestamp,
                        mode=self.mode,
                    )
                )
                self._position_state[symbol] = "FLAT"
                self._entry_price.pop(symbol, None)
            self._last_action_ts[symbol] = now
            return signals

        signals: List[actions_pb2.TradingSignal] = []
        state = self._position_state.get(symbol, "FLAT")
        for _ in range(self._parameters.batch_size):
            timestamp = Timestamp()
            timestamp.GetCurrentTime()
            if state != "LONG":
                signals.append(
                    actions_pb2.TradingSignal(
                        strategy_id=self.strategy_id,
                        symbol=symbol,
                        side="BUY",
                        confidence=0.8,
                        signal_timestamp=timestamp,
                        mode=self.mode,
                    )
                )
                state = "LONG"
                self._entry_price[symbol] = price
            else:
                signals.append(
                    actions_pb2.TradingSignal(
                        strategy_id=self.strategy_id,
                        symbol=symbol,
                        side="SELL",
                        confidence=0.85,
                        signal_timestamp=timestamp,
                        mode=self.mode,
                    )
                )
                state = "FLAT"
                self._entry_price.pop(symbol, None)
        self._position_state[symbol] = state
        self._last_batch_ts[symbol] = now
        self._last_action_ts[symbol] = now
        log.info(
            "[%s] Lote de %d ordens emitido para %s (intervalo %.0fs)",
            self.strategy_id,
            self._parameters.batch_size,
            symbol,
            self._parameters.batch_interval_seconds,
        )
        return signals

    # ------------------------------------------------------------------
    # Introspection helpers (for dashboard)
    # ------------------------------------------------------------------
    def snapshot(self) -> dict:
        return {
            "strategy_id": self.strategy_id,
            "symbols": sorted(self._symbols),
            "parameters": {
                "cooldown_seconds": self._parameters.cooldown_seconds,
                "position_size_pct": self._parameters.position_size_pct,
            },
            "cash_balance": self._cash_balance,
            "positions": self._position_state.copy(),
        }
