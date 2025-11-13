"""Simple test strategy that emits alternating BUY/SELL signals for demos."""

from __future__ import annotations

import os
from dataclasses import dataclass
import logging
import math
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
        self._positions_qty: Dict[str, float] = {symbol: 0.0 for symbol in self._symbols}
        self._min_notional_usd = 1.0
        self._last_price: Dict[str, float] = {symbol: 0.0 for symbol in self._symbols}
        self._max_order_notional = float(os.getenv("TEST_SIM_MAX_ORDER_USD", "25000"))

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
            self._positions_qty[symbol] = 0.0
            self._last_price[symbol] = 0.0
        for symbol in removed:
            self._position_state.pop(symbol, None)
            self._last_action_ts.pop(symbol, None)
            self._last_batch_ts.pop(symbol, None)
            self._entry_price.pop(symbol, None)
            self._positions_qty.pop(symbol, None)
            self._last_price.pop(symbol, None)

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
        if not math.isfinite(price) or price <= 0:
            return []

        now = time.time()
        self._last_price[symbol] = price

        signals: List[actions_pb2.TradingSignal] = []
        signals.extend(self._maybe_emit_for_symbol(symbol, price, now))

        for other in sorted(self._symbols):
            if other == symbol:
                continue
        fallback_price = self._last_price.get(other)
        if fallback_price and fallback_price > 0:
            signals.extend(self._maybe_emit_for_symbol(other, fallback_price, now))

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
            "positions_qty": self._positions_qty.copy(),
            "average_price": self._entry_price.copy(),
        }

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _maybe_emit_for_symbol(self, symbol: str, price: float, now: float) -> List[actions_pb2.TradingSignal]:
        last_batch = self._last_batch_ts.get(symbol, 0.0)
        if now - last_batch < self._parameters.batch_interval_seconds:
            last_ts = self._last_action_ts.get(symbol, 0.0)
            if now - last_ts < self._parameters.cooldown_seconds:
                return []
            signal = (
                self._handle_buy(symbol, price)
                if self._position_state.get(symbol, "FLAT") != "LONG"
                else self._handle_sell(symbol, price)
            )
            if signal is None:
                return []
            self._last_action_ts[symbol] = now
            return [signal]

        signals: List[actions_pb2.TradingSignal] = []
        state = self._position_state.get(symbol, "FLAT")
        for _ in range(self._parameters.batch_size):
            signal = self._handle_buy(symbol, price) if state != "LONG" else self._handle_sell(symbol, price)
            if signal is None:
                continue
            signals.append(signal)
            state = "LONG" if signal.side == "BUY" else "FLAT"
        if signals:
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

    def _handle_buy(self, symbol: str, price: float) -> actions_pb2.TradingSignal | None:
        quantity = self._calculate_buy_quantity(price)
        if quantity <= 0:
            return None
        notional = quantity * price
        self._cash_balance = max(self._cash_balance - notional, 0.0)
        prev_qty = self._positions_qty.get(symbol, 0.0)
        new_qty = prev_qty + quantity
        avg_price = (
            ((self._entry_price.get(symbol, price) * prev_qty) + (price * quantity)) / new_qty
            if prev_qty > 0
            else price
        )
        self._positions_qty[symbol] = new_qty
        self._entry_price[symbol] = avg_price
        self._position_state[symbol] = "LONG"
        log.info(
            "[%s] TEST BUY %s qty=%.6f price=%.2f cash=%.2f",
            self.strategy_id,
            symbol,
            quantity,
            price,
            self._cash_balance,
        )
        return self._build_signal(symbol, "BUY", price, quantity)

    def _handle_sell(self, symbol: str, price: float) -> actions_pb2.TradingSignal | None:
        quantity = self._positions_qty.get(symbol, 0.0)
        if quantity <= 0:
            return None
        notional = quantity * price
        self._cash_balance += notional
        self._positions_qty[symbol] = 0.0
        self._entry_price.pop(symbol, None)
        self._position_state[symbol] = "FLAT"
        log.info(
            "[%s] TEST SELL %s qty=%.6f price=%.2f cash=%.2f",
            self.strategy_id,
            symbol,
            quantity,
            price,
            self._cash_balance,
        )
        return self._build_signal(symbol, "SELL", price, quantity)

    def _calculate_buy_quantity(self, price: float) -> float:
        if price <= 0 or self._cash_balance <= 0:
            return 0.0
        symbol_count = max(len(self._symbols), 1)
        allocatable = self._cash_balance * self._parameters.position_size_pct
        allocatable = allocatable / symbol_count
        allocatable = min(allocatable, self._cash_balance, self._max_order_notional)
        if allocatable < self._min_notional_usd:
            return 0.0
        quantity = allocatable / price
        return quantity if quantity > 0 else 0.0

    def _build_signal(self, symbol: str, side: str, price: float, quantity: float) -> actions_pb2.TradingSignal:
        timestamp = Timestamp()
        timestamp.GetCurrentTime()
        notional = price * quantity
        metadata = {
            "price": f"{price:.8f}",
            "quantity": f"{quantity:.10f}",
            "notional": f"{notional:.2f}",
        }
        return actions_pb2.TradingSignal(
            strategy_id=self.strategy_id,
            symbol=symbol,
            side=side,
            confidence=0.85 if side == "SELL" else 0.8,
            signal_timestamp=timestamp,
            mode=self.mode,
            metadata=metadata,
        )
