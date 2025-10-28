"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchControlState } from "../../lib/api";
import type { StrategyConfigUpdatePayload, StrategyState } from "../../lib/types";

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

  const [usdBalance, setUsdBalance] = useState<string>(initialStrategy.usd_balance ?? DEFAULTS.usdBalance);
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
  const [fastWindow, setFastWindow] = useState<number>(initialStrategy.fast_window ?? DEFAULTS.fastWindow);
  const [slowWindow, setSlowWindow] = useState<number>(initialStrategy.slow_window ?? DEFAULTS.slowWindow);
  const [minSignalBps, setMinSignalBps] = useState<number>(
    initialStrategy.min_signal_bps ?? DEFAULTS.minSignalBps,
  );
  const [positionSizePct, setPositionSizePct] = useState<number>(
    initialStrategy.position_size_pct ?? DEFAULTS.positionSizePct,
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const totals = useMemo(() => {
    const paperUsd = parseUsdNumeric(currentStrategy.usd_balance);
    return {
      paperUsd,
      formatted: formatUsd(paperUsd),
    };
  }, [currentStrategy]);

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
      baseline.symbols && baseline.symbols.length > 0 ? [...baseline.symbols] : [...DEFAULT_SYMBOLS]
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
          className="md:hidden inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
        >
          ← Voltar ao dashboard
        </Link>
      )}

      {effectiveLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          A carregar dados de simulação...
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <SummaryTile label="Caixa atual (paper)">
              {totals.formatted}
            </SummaryTile>
            <SummaryTile label="Take profit alvo">
              {(takeProfitBps / 100).toFixed(2)}%
            </SummaryTile>
            <SummaryTile label="Stop-loss previsto">
              {(stopLossBps / 100).toFixed(2)}%
            </SummaryTile>
          </div>

          {effectiveError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-100">
              {effectiveError}
            </div>
          )}

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
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover-border-indigo-400 dark:hover:text-indigo-200"
            >
              Repor valores
            </button>
          </div>
        </form>
      )}
    </div>
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

function NumberField({ label, value, onChange, min, max, step = 1, hint, disabled }: NumberFieldProps) {
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
