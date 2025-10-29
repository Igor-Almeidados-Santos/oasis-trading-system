"use client";

import Link from "next/link";
import type { SVGProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchControlState } from "../../lib/api";
import type {
  Operation,
  Position,
  StrategyConfigUpdatePayload,
  StrategyState,
} from "../../lib/types";

const ADVANCED_STRATEGY_ID = "advanced-alpha-001";
const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD"] as const;
const DEFAULTS = {
  usdBalance: "25000",
  takeProfitBps: 120,
  stopLossBps: 60,
  fastWindow: 5,
  slowWindow: 21,
  minSignalBps: 20,
  positionSizePct: 0.15,
};

type SimulationActionResult = {
  success: boolean;
  strategy?: StrategyState;
  errorMessage?: string;
};

type PaperSimulationState = {
  cash?: string | null;
  positions?: Position[];
  recentOperations?: Operation[];
  historicalOperations?: Operation[];
  operationsLoading?: boolean;
  operationsError?: string | null;
  historicalLoading?: boolean;
  historicalError?: string | null;
};

const createDefaultStrategy = (): StrategyState => ({
  strategy_id: ADVANCED_STRATEGY_ID,
  enabled: true,
  mode: "PAPER",
  symbols: [...DEFAULT_SYMBOLS],
  usd_balance: DEFAULTS.usdBalance,
  take_profit_bps: DEFAULTS.takeProfitBps,
  stop_loss_bps: DEFAULTS.stopLossBps,
  fast_window: DEFAULTS.fastWindow,
  slow_window: DEFAULTS.slowWindow,
  min_signal_bps: DEFAULTS.minSignalBps,
  position_size_pct: DEFAULTS.positionSizePct,
});

const mergeStrategyWithUpdate = (
  base: StrategyState,
  update: StrategyConfigUpdatePayload,
): StrategyState => {
  const next: StrategyState = { ...base };
  if (update.enabled !== undefined) {
    next.enabled = update.enabled;
  }
  if (update.mode !== undefined) {
    next.mode = update.mode;
  }
  if (update.symbols) {
    next.symbols = [...update.symbols];
  }
  if (update.usd_balance !== undefined) {
    next.usd_balance = update.usd_balance;
  }
  if (update.take_profit_bps !== undefined) {
    next.take_profit_bps = update.take_profit_bps;
  }
  if (update.stop_loss_bps !== undefined) {
    next.stop_loss_bps = update.stop_loss_bps;
  }
  if (update.fast_window !== undefined) {
    next.fast_window = update.fast_window;
  }
  if (update.slow_window !== undefined) {
    next.slow_window = update.slow_window;
  }
  if (update.min_signal_bps !== undefined) {
    next.min_signal_bps = update.min_signal_bps;
  }
  if (update.position_size_pct !== undefined) {
    next.position_size_pct = update.position_size_pct;
  }
  return next;
};

export interface SimulationsSectionProps {
  standalone?: boolean;
  showBackLink?: boolean;
  backHref?: string;
  strategy?: StrategyState;
  paperState?: PaperSimulationState;
  loading?: boolean;
  error?: string | null;
  onSubmit: (payload: StrategyConfigUpdatePayload) => Promise<SimulationActionResult>;
  onRefresh?: () => Promise<SimulationActionResult>;
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const parseUsdNumeric = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const sanitized = value.replace(/[^0-9.,-]/g, "");
  const normalized = sanitized.replace(/,/g, ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
};

export function SimulationsSection({
  standalone = false,
  showBackLink = true,
  backHref = "/dashboard",
  strategy,
  paperState,
  loading,
  error,
  onSubmit,
  onRefresh,
}: SimulationsSectionProps) {
  const shouldSelfFetch = strategy === undefined;
  const initialStrategy = strategy ?? createDefaultStrategy();

  const [currentStrategy, setCurrentStrategy] = useState<StrategyState>(initialStrategy);
  const [localLoading, setLocalLoading] = useState<boolean>(loading ?? shouldSelfFetch);
  const [localError, setLocalError] = useState<string | null>(error ?? null);

  const [usdBalance, setUsdBalance] = useState<string>(
    initialStrategy.usd_balance ?? DEFAULTS.usdBalance,
  );
  const [symbols, setSymbols] = useState<string[]>(
    initialStrategy.symbols && initialStrategy.symbols.length > 0
      ? [...initialStrategy.symbols]
      : [...DEFAULT_SYMBOLS],
  );
  const [newSymbol, setNewSymbol] = useState<string>("");
  const [takeProfitBps, setTakeProfitBps] = useState<number>(
    initialStrategy.take_profit_bps ?? DEFAULTS.takeProfitBps,
  );
  const [stopLossBps, setStopLossBps] = useState<number>(
    initialStrategy.stop_loss_bps ?? DEFAULTS.stopLossBps,
  );
  const [fastWindow, setFastWindow] = useState<number>(
    initialStrategy.fast_window ?? DEFAULTS.fastWindow,
  );
  const [slowWindow, setSlowWindow] = useState<number>(
    initialStrategy.slow_window ?? DEFAULTS.slowWindow,
  );
  const [minSignalBps, setMinSignalBps] = useState<number>(
    initialStrategy.min_signal_bps ?? DEFAULTS.minSignalBps,
  );
  const [positionSizePct, setPositionSizePct] = useState<number>(
    initialStrategy.position_size_pct ?? DEFAULTS.positionSizePct,
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    if (strategy) {
      setCurrentStrategy(strategy);
    }
  }, [strategy]);

  useEffect(() => {
    if (loading !== undefined) {
      setLocalLoading(loading);
    }
  }, [loading]);

  useEffect(() => {
    if (error !== undefined) {
      setLocalError(error);
    }
  }, [error]);

  useEffect(() => {
    const next = currentStrategy;
    setUsdBalance(next.usd_balance ?? DEFAULTS.usdBalance);
    setSymbols(next.symbols && next.symbols.length > 0 ? [...next.symbols] : [...DEFAULT_SYMBOLS]);
    setTakeProfitBps(next.take_profit_bps ?? DEFAULTS.takeProfitBps);
    setStopLossBps(next.stop_loss_bps ?? DEFAULTS.stopLossBps);
    setFastWindow(next.fast_window ?? DEFAULTS.fastWindow);
    setSlowWindow(next.slow_window ?? DEFAULTS.slowWindow);
    setMinSignalBps(next.min_signal_bps ?? DEFAULTS.minSignalBps);
    setPositionSizePct(next.position_size_pct ?? DEFAULTS.positionSizePct);
  }, [currentStrategy]);

  const {
    positions: paperPositions = [],
    recentOperations: paperRecentOperations = [],
    historicalOperations: paperHistoricalOperations = [],
    cash: paperCashBalance,
    operationsLoading: paperOperationsLoading = false,
    operationsError: paperOperationsError = null,
    historicalLoading: paperHistoricalLoading = false,
    historicalError: paperHistoricalError = null,
  } = paperState ?? {};

  const totals = useMemo(() => {
    const sourceBalance =
      paperCashBalance ?? currentStrategy.usd_balance ?? DEFAULTS.usdBalance;
    const paperUsd = parseUsdNumeric(sourceBalance);
    return {
      paperUsd,
      formatted: formatUsd(paperUsd),
    };
  }, [paperCashBalance, currentStrategy]);

  const paperInsights = useMemo(() => {
    const dataset = Array.isArray(paperRecentOperations) ? paperRecentOperations : [];
    const total = dataset.length;
    const filled = dataset.filter((op) =>
      ["FILLED", "FILLS", "COMPLETED", "EXECUTED"].includes((op.status || "").toUpperCase()),
    ).length;
    const rejected = dataset.filter((op) =>
      (op.status || "").toUpperCase().includes("REJECT"),
    ).length;
    const buyCount = dataset.filter((op) => (op.side || "").toUpperCase() === "BUY").length;
    const sellCount = dataset.filter((op) => (op.side || "").toUpperCase() === "SELL").length;
    return { total, filled, rejected, buyCount, sellCount };
  }, [paperRecentOperations]);

  const strategySnapshot = currentStrategy ?? createDefaultStrategy();
  const configuredSymbols =
    strategySnapshot.symbols && strategySnapshot.symbols.length > 0
      ? strategySnapshot.symbols
      : symbols;
  const takeProfit = strategySnapshot.take_profit_bps ?? takeProfitBps;
  const stopLoss = strategySnapshot.stop_loss_bps ?? stopLossBps;
  const minSignal = strategySnapshot.min_signal_bps ?? minSignalBps;
  const fastWindowValue = strategySnapshot.fast_window ?? fastWindow;
  const slowWindowValue = strategySnapshot.slow_window ?? slowWindow;
  const positionPctDisplay = (
    (strategySnapshot.position_size_pct ?? positionSizePct) * 100
  ).toFixed(0);

  const fetchAdvancedStrategy = useCallback(async (): Promise<SimulationActionResult> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) {
      const message = "Sessão expirada. Faça login novamente.";
      setLocalError(message);
      return { success: false, errorMessage: message };
    }

    try {
      setLocalLoading(true);
      setLocalError(null);
      const control = await fetchControlState(token);
      const found = control.strategies?.find((item) => item.strategy_id === ADVANCED_STRATEGY_ID);
      if (found) {
        setCurrentStrategy(found);
        setLocalError(null);
        return { success: true, strategy: found };
      }
      const fallback = createDefaultStrategy();
      setCurrentStrategy(fallback);
      setLocalError(null);
      return { success: true, strategy: fallback };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar configurações.";
      setLocalError(message);
      return { success: false, errorMessage: message };
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (shouldSelfFetch) {
      void fetchAdvancedStrategy();
    }
  }, [shouldSelfFetch, fetchAdvancedStrategy]);

  const effectiveLoading = loading ?? localLoading;
  const effectiveError = error ?? localError;

  const handleAddSymbol = () => {
    const clean = newSymbol.trim().toUpperCase();
    if (!clean) {
      return;
    }
    setSymbols((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setNewSymbol("");
  };

  const handleRemoveSymbol = (symbol: string) => {
    setSymbols((prev) => prev.filter((item) => item !== symbol));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const payload: StrategyConfigUpdatePayload = {
      usd_balance: usdBalance,
      symbols,
      take_profit_bps: takeProfitBps,
      stop_loss_bps: stopLossBps,
      fast_window: fastWindow,
      slow_window: slowWindow,
      min_signal_bps: minSignalBps,
      position_size_pct: Number(positionSizePct.toFixed(3)),
    };

    const result = await onSubmit(payload);
    setSubmitting(false);

    if (result.success) {
      const nextStrategy = result.strategy
        ? result.strategy
        : mergeStrategyWithUpdate(currentStrategy, payload);
      setCurrentStrategy(nextStrategy);
      setFeedback({ type: "success", message: "Configurações de simulação atualizadas." });
      setLocalError(null);
    } else {
      const message = result.errorMessage ?? "Não foi possível guardar as alterações.";
      setFeedback({ type: "error", message });
      setLocalError((prev) => prev ?? message);
    }
  };

  const handleReset = () => {
    const baseline = currentStrategy ?? createDefaultStrategy();
    setUsdBalance(baseline.usd_balance ?? DEFAULTS.usdBalance);
    setSymbols(
      baseline.symbols && baseline.symbols.length > 0 ? [...baseline.symbols] : [...DEFAULT_SYMBOLS],
    );
    setTakeProfitBps(baseline.take_profit_bps ?? DEFAULTS.takeProfitBps);
    setStopLossBps(baseline.stop_loss_bps ?? DEFAULTS.stopLossBps);
    setFastWindow(baseline.fast_window ?? DEFAULTS.fastWindow);
    setSlowWindow(baseline.slow_window ?? DEFAULTS.slowWindow);
    setMinSignalBps(baseline.min_signal_bps ?? DEFAULTS.minSignalBps);
    setPositionSizePct(baseline.position_size_pct ?? DEFAULTS.positionSizePct);
    setFeedback(null);
  };

  const handleRefreshClick = useCallback(async () => {
    if (onRefresh) {
      const result = await onRefresh();
      if (result.success && result.strategy) {
        setCurrentStrategy(result.strategy);
        setLocalError(null);
        setFeedback({ type: "success", message: "Configurações sincronizadas com a API." });
      } else if (!result.success) {
        const message = result.errorMessage ?? "Falha ao atualizar simulações.";
        setFeedback({ type: "error", message });
        setLocalError((prev) => prev ?? message);
      }
      return;
    }

    const result = await fetchAdvancedStrategy();
    if (result.success && result.strategy) {
      setFeedback({ type: "success", message: "Configurações sincronizadas com a API." });
    } else if (!result.success) {
      const message = result.errorMessage ?? "Falha ao atualizar simulações.";
      setFeedback({ type: "error", message });
    }
  }, [onRefresh, fetchAdvancedStrategy]);

  const canRefresh = Boolean(onRefresh) || shouldSelfFetch;
  const disableForm = effectiveLoading || submitting;

  return (
    <>
      <div className="space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Configurações de simulação &amp; ambiente paper trading
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
              Laboratório de Simulações
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {standalone && showBackLink && (
              <Link
                href={backHref}
                className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200 md:inline-flex"
              >
                ← Voltar ao dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
            >
              <GearIcon className="h-4 w-4" />
              Ajustar simulação
            </button>
            {canRefresh && (
              <button
                type="button"
                onClick={() => void handleRefreshClick()}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                disabled={effectiveLoading}
              >
                Atualizar estado
              </button>
            )}
          </div>
        </header>

        {standalone && showBackLink && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200 md:hidden"
          >
            ← Voltar ao dashboard
          </Link>
        )}

        {effectiveLoading ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            A carregar dados de simulação...
          </section>
        ) : (
          <>
            {effectiveError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-100">
                {effectiveError}
              </div>
            )}

            <section className="grid gap-4 border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryTile label="Caixa (paper)">
                {totals.formatted}
              </SummaryTile>
              <SummaryTile label="Posições simuladas">
                {paperPositions.length}
              </SummaryTile>
              <SummaryTile label="Operações recentes">
                {paperInsights.total}
              </SummaryTile>
              <SummaryTile label="Taxa de fills">
                {paperInsights.total > 0
                  ? `${Math.round((paperInsights.filled / paperInsights.total) * 100)}%`
                  : "0%"}
              </SummaryTile>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Posições simuladas
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ativos mantidos no ambiente paper.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {paperPositions.length} ativo{paperPositions.length === 1 ? "" : "s"}
                </span>
              </div>

              {paperPositions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma posição registada no modo paper no momento.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {paperPositions.map((pos) => (
                    <li
                      key={`${pos.mode}-${pos.symbol}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/40"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {pos.symbol}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Modo {pos.mode} · Média {pos.average_price}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Qty {pos.quantity}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Operações simuladas
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Últimos sinais processados pelo ambiente paper.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {paperInsights.total} recentes · {paperHistoricalOperations.length} histórico
                </span>
              </div>

              {paperOperationsLoading ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  A carregar operações simuladas...
                </p>
              ) : paperOperationsError ? (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/40 dark:text-rose-100">
                  {paperOperationsError}
                </div>
              ) : paperRecentOperations.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Ainda não foram registadas operações simuladas.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {paperRecentOperations.slice(0, 6).map((op) => (
                    <li
                      key={`${op.id}-${op.client_order_id ?? "paper"}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/40"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {op.symbol} · {op.side}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {op.executed_at
                            ? new Date(op.executed_at).toLocaleString()
                            : "Pendente"}{" "}
                          · {op.status} · {op.order_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {op.quantity}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{op.mode}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Histórico paper
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Registos consolidados do ambiente simulado.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {paperHistoricalOperations.length} registo
                  {paperHistoricalOperations.length === 1 ? "" : "s"}
                </span>
              </div>

              {paperHistoricalLoading ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  A carregar histórico de operações...
                </p>
              ) : paperHistoricalError ? (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/40 dark:text-rose-100">
                  {paperHistoricalError}
                </div>
              ) : paperHistoricalOperations.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Não existem operações históricas registadas para o modo paper.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Símbolo</th>
                        <th className="px-4 py-3">Lado</th>
                        <th className="px-4 py-3">Quantidade</th>
                        <th className="px-4 py-3">Preço</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Executado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs dark:divide-slate-700">
                      {paperHistoricalOperations.slice(0, 20).map((op) => (
                        <tr
                          key={`${op.mode}-${op.id}-${op.client_order_id ?? "paper"}`}
                          className="hover:bg-slate-100/60 dark:hover:bg-slate-700/40"
                        >
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {op.client_order_id || op.id}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                            {op.symbol}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{op.side}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                            {op.quantity}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{op.price}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{op.status}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                            {op.executed_at ? new Date(op.executed_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {paperHistoricalOperations.length > 20 && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      A mostrar 20 de {paperHistoricalOperations.length} operações. Utilize a API para consultar
                      o histórico completo, se necessário.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Configurações atuais
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Resumo dos parâmetros aplicados ao modo paper.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                >
                  <GearIcon className="h-4 w-4" />
                  Ajustar
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <KeyValue label="Estratégia" value={strategySnapshot.strategy_id} />
                <KeyValue label="Estado" value={strategySnapshot.enabled ? "Ativa" : "Pausada"} />
                <KeyValue label="Saldo configurado" value={totals.formatted} />
                <KeyValue label="Posição por ordem" value={`${positionPctDisplay}%`} />
                <KeyValue label="Take profit" value={`${(takeProfit / 100).toFixed(2)}%`} />
                <KeyValue label="Stop-loss" value={`${(stopLoss / 100).toFixed(2)}%`} />
                <KeyValue label="Intensidade mínima" value={`${minSignal} bps`} />
                <KeyValue label="Janela rápida" value={fastWindowValue} />
                <KeyValue label="Janela lenta" value={slowWindowValue} />
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ativos monitorizados
                </h3>
                {configuredSymbols.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Nenhum símbolo configurado para a simulação.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {configuredSymbols.map((symbol) => (
                      <span
                        key={symbol}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200"
                      >
                        {symbol}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur">
          <div className="relative w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="absolute right-4 top-4 rounded-full border border-slate-200 p-1 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-300"
              aria-label="Fechar"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Configurar modo simulado
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Ajuste o capital, os ativos monitorizados e os parâmetros avançados da estratégia paper.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              {feedback && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    feedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200"
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Capital de simulação
                </legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Saldo USD disponível
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={usdBalance}
                      onChange={(event) => setUsdBalance(event.target.value)}
                      placeholder={DEFAULTS.usdBalance}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      disabled={disableForm}
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Utilize números inteiros ou notação com underscores (ex.: 25_000) para definir o capital inicial.
                    </span>
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Percentual por ordem
                    </span>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0.01}
                        max={1}
                        step={0.01}
                        value={positionSizePct}
                        onChange={(event) => setPositionSizePct(Number(event.target.value))}
                        className="flex-1"
                        disabled={disableForm}
                      />
                      <span className="w-16 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {(positionSizePct * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Percentual do saldo paper a arriscar em cada ordem simulada.
                    </span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Ativos monitorizados
                </legend>
                <div className="flex flex-wrap items-center gap-2">
                  {symbols.length === 0 && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhum símbolo configurado.
                    </span>
                  )}
                  {symbols.map((symbol) => (
                    <span
                      key={symbol}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200"
                    >
                      {symbol}
                      <button
                        type="button"
                        onClick={() => handleRemoveSymbol(symbol)}
                        className="rounded-full bg-slate-200 px-1 text-slate-600 transition hover:bg-rose-200 hover:text-rose-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-rose-900/60 dark:hover:text-rose-100"
                        aria-label={`Remover ${symbol}`}
                        disabled={disableForm}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={newSymbol}
                    onChange={(event) => setNewSymbol(event.target.value)}
                    placeholder="Adicionar símbolo (ex.: SOL-USD)"
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    disabled={disableForm}
                  />
                  <button
                    type="button"
                    onClick={handleAddSymbol}
                    disabled={disableForm || newSymbol.trim() === ""}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                  >
                    Adicionar
                  </button>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Parâmetros avançados
                </legend>
                <div className="grid gap-4 lg:grid-cols-3">
                  <NumberField
                    label="Take profit (bps)"
                    value={takeProfitBps}
                    onChange={setTakeProfitBps}
                    min={10}
                    step={10}
                    hint="Basis points. 100 bps = 1%."
                    disabled={disableForm}
                  />
                  <NumberField
                    label="Stop loss (bps)"
                    value={stopLossBps}
                    onChange={setStopLossBps}
                    min={10}
                    step={10}
                    disabled={disableForm}
                  />
                  <NumberField
                    label="Intensidade mínima (bps)"
                    value={minSignalBps}
                    onChange={setMinSignalBps}
                    min={5}
                    step={5}
                    disabled={disableForm}
                  />
                  <NumberField
                    label="Janela rápida"
                    value={fastWindow}
                    onChange={setFastWindow}
                    min={2}
                    step={1}
                    disabled={disableForm}
                  />
                  <NumberField
                    label="Janela lenta"
                    value={slowWindow}
                    onChange={setSlowWindow}
                    min={fastWindow + 1}
                    step={1}
                    disabled={disableForm}
                  />
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={disableForm}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "A guardar..." : "Guardar alterações"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={disableForm}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                >
                  Repor valores
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function GearIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94a1.5 1.5 0 0 1 2.812 0l.299 1.018a1.5 1.5 0 0 0 2.243.897l.916-.53a1.5 1.5 0 0 1 2.062.548l.75 1.3a1.5 1.5 0 0 1-.55 2.06l-.916.53a1.5 1.5 0 0 0 0 2.598l.916.53a1.5 1.5 0 0 1 .55 2.06l-.75 1.3a1.5 1.5 0 0 1-2.062.548l-.916-.53a1.5 1.5 0 0 0-2.243.898l-.299 1.017a1.5 1.5 0 0 1-2.812 0l-.299-1.017a1.5 1.5 0 0 0-2.243-.898l-.916.53a1.5 1.5 0 0 1-2.062-.548l-.75-1.3a1.5 1.5 0 0 1 .55-2.06l.916-.53a1.5 1.5 0 0 0 0-2.598l-.916-.53a1.5 1.5 0 0 1-.55-2.06l.75-1.3a1.5 1.5 0 0 1 2.062-.548l.916.53a1.5 1.5 0 0 0 2.243-.897z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0"
      />
    </svg>
  );
}

function CloseIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 18 12-12M6 6l12 12" />
    </svg>
  );
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{children}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  disabled,
}: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
      {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}
