"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CashHistoryEntry,
  Operation,
  Position,
  StrategyConfigUpdatePayload,
  StrategyField,
  StrategyState,
} from "../../lib/types";

type SimulationActionResult = {
  success: boolean;
  strategy?: StrategyState;
  errorMessage?: string;
};

export type PaperSimulationSnapshot = {
  cash?: string | null;
  cashHistory?: CashHistoryEntry[];
  positions?: Position[];
  recentOperations?: Operation[];
  historicalOperations?: Operation[];
  operationsLoading?: boolean;
  operationsError?: string | null;
  historicalLoading?: boolean;
  historicalError?: string | null;
};

export interface SimulationWorkspaceProps {
  strategies: StrategyState[];
  paperState?: PaperSimulationSnapshot;
  loading?: boolean;
  onSubmit: (strategyId: string, payload: StrategyConfigUpdatePayload) => Promise<SimulationActionResult>;
  onRefresh: (strategyId: string) => Promise<SimulationActionResult>;
  onResetPaper: () => Promise<void>;
}

type FormValue = string | number | boolean | string[];

export function SimulationWorkspace({
  strategies,
  paperState,
  loading,
  onSubmit,
  onRefresh,
  onResetPaper,
}: SimulationWorkspaceProps) {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(() =>
    strategies.length > 0 ? strategies[0].strategy_id : "",
  );
  const [currentStrategy, setCurrentStrategy] = useState<StrategyState | undefined>(() =>
    strategies.find((item) => item.strategy_id === selectedStrategyId),
  );
  const [formValues, setFormValues] = useState<Record<string, FormValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fields: StrategyField[] = useMemo(() => currentStrategy?.fields ?? [], [currentStrategy]);

  useEffect(() => {
    if (strategies.length === 0) {
      setSelectedStrategyId("");
      setCurrentStrategy(undefined);
      setFormValues({});
      return;
    }
    if (!strategies.some((item) => item.strategy_id === selectedStrategyId)) {
      const fallback = strategies[0].strategy_id;
      setSelectedStrategyId(fallback);
      setCurrentStrategy(strategies[0]);
      setFormValues(extractFormValues(strategies[0], strategies[0].fields ?? []));
      return;
    }
    const next = strategies.find((item) => item.strategy_id === selectedStrategyId);
    setCurrentStrategy(next);
    if (next) {
      setFormValues(extractFormValues(next, next.fields ?? []));
    } else {
      setFormValues({});
    }
  }, [strategies, selectedStrategyId]);

  const summary = useMemo(() => {
    const cash = parseCurrency(formValues.usd_balance) ?? parseCurrency(currentStrategy?.usd_balance);
    const cashHistory = paperState?.cashHistory ?? [];
    let latest = cash ?? 0;
    let initial = latest;
    if (cashHistory.length > 0) {
      initial = parseCurrency(cashHistory[0]?.balance) ?? 0;
      latest = parseCurrency(cashHistory[cashHistory.length - 1]?.balance) ?? initial;
    }
    const pnl = latest - initial;
    const recentOps = paperState?.recentOperations ?? [];
    const positions = paperState?.positions ?? [];
    return {
      cashDisplay: formatUsd(latest),
      pnlDisplay: pnl >= 0 ? `+${formatUsd(pnl)}` : formatUsd(pnl),
      operations: recentOps.length,
      positions: positions.length,
      pnl,
    };
  }, [paperState, formValues, currentStrategy]);

  const handleSelectStrategy = async (strategyId: string) => {
    setSelectedStrategyId(strategyId);
    setFeedback(null);
    const selected = strategies.find((item) => item.strategy_id === strategyId);
    if (selected) {
      setFormValues(extractFormValues(selected, selected.fields ?? []));
    } else {
      setFormValues({});
    }
    if (onRefresh) {
      const result = await onRefresh(strategyId);
      if (result.success && result.strategy) {
        setCurrentStrategy(result.strategy);
        setFormValues(extractFormValues(result.strategy, result.strategy.fields ?? []));
      } else if (!result.success && result.errorMessage) {
        setFeedback({ type: "error", message: result.errorMessage });
      }
    }
  };

  const handleFieldChange = (key: string, value: FormValue) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStrategyId) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = buildPayload(formValues);
      const result = await onSubmit(selectedStrategyId, payload);
      if (result.success && result.strategy) {
        setFeedback({ type: "success", message: "Configuração atualizada com sucesso." });
        setCurrentStrategy(result.strategy);
        setFormValues(extractFormValues(result.strategy, result.strategy.fields ?? fields));
      } else if (result.errorMessage) {
        setFeedback({ type: "error", message: result.errorMessage });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Falha ao atualizar a configuração.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedStrategyId) {
      return;
    }
    const result = await onRefresh(selectedStrategyId);
    if (result.success && result.strategy) {
      setCurrentStrategy(result.strategy);
      setFormValues(extractFormValues(result.strategy, result.strategy.fields ?? fields));
      setFeedback({ type: "success", message: "Configuração sincronizada." });
    } else if (!result.success && result.errorMessage) {
      setFeedback({ type: "error", message: result.errorMessage });
    }
  };

  const handleResetPaper = async () => {
    setResetting(true);
    setFeedback(null);
    try {
      await onResetPaper();
      if (selectedStrategyId) {
        const result = await onRefresh(selectedStrategyId);
        if (result.success && result.strategy) {
          setCurrentStrategy(result.strategy);
          setFormValues(extractFormValues(result.strategy, result.strategy.fields ?? fields));
        }
      }
      setFeedback({ type: "success", message: "Ambiente paper reinicializado." });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Falha ao reinicializar o ambiente paper.",
      });
    } finally {
      setResetting(false);
    }
  };

  const effectiveLoading = Boolean(loading);
  const positions = paperState?.positions ?? [];
  const recentOperations = paperState?.recentOperations ?? [];
  const historicalOperations = paperState?.historicalOperations ?? [];
  const cashHistory = paperState?.cashHistory ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">Laboratório de Simulações</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Ambiente Paper & Estratégias
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700 dark:border-rose-400/60 dark:text-rose-200 dark:hover:border-rose-400 dark:hover:text-rose-100"
            onClick={() => void handleResetPaper()}
            disabled={resetting || effectiveLoading}
          >
            {resetting ? "A limpar..." : "Zerar ambiente paper"}
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
            onClick={() => void handleRefresh()}
            disabled={effectiveLoading}
          >
            Atualizar configuração
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Estratégia</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecione qual estratégia deseja simular em modo paper.
            </p>
          </div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={selectedStrategyId}
            onChange={(event) => void handleSelectStrategy(event.target.value)}
            disabled={effectiveLoading || strategies.length === 0}
          >
            {strategies.map((strategy) => (
              <option key={strategy.strategy_id} value={strategy.strategy_id}>
                {strategy.strategy_id}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Caixa (paper)">{summary.cashDisplay}</SummaryTile>
        <SummaryTile label="Lucro/Prejuízo">{summary.pnlDisplay}</SummaryTile>
        <SummaryTile label="Operações recentes">{summary.operations}</SummaryTile>
        <SummaryTile label="Posições simuladas">{summary.positions}</SummaryTile>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:col-span-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Configuração da simulação
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ajuste parâmetros específicos da estratégia selecionada.
              </p>
            </div>
          </div>
          {fields.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Esta estratégia não possui parâmetros configuráveis através da interface.
            </p>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={formValues[field.key]}
                    onChange={(value) => handleFieldChange(field.key, value)}
                  />
                ))}
              </div>
              <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                  onClick={() =>
                    currentStrategy &&
                    setFormValues(extractFormValues(currentStrategy, currentStrategy.fields ?? fields))
                  }
                  disabled={effectiveLoading || submitting}
                >
                  Restaurar valores
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:disabled:bg-indigo-500/40"
                  disabled={effectiveLoading || submitting}
                >
                  {submitting ? "Enviando..." : "Guardar alterações"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Desempenho</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Evolução do saldo disponível no modo paper.
          </p>
          <div className="mt-4 h-48 md:h-60">
            <PerformanceChart data={normalizeCashHistory(cashHistory)} />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Posições simuladas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ativos mantidos atualmente no ambiente paper.
            </p>
          </div>
        </div>
        {positions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Nenhuma posição está aberta no momento.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {positions.map((position) => (
              <li
                key={`${position.symbol}-${position.mode}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {position.symbol}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Modo {position.mode} · Média {position.average_price}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Qty {position.quantity}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Operações paper recentes
        </h2>
        {paperState?.operationsLoading ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">A carregar operações...</p>
        ) : paperState?.operationsError ? (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">
            {paperState.operationsError}
          </p>
        ) : recentOperations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Nenhuma operação foi registada recentemente.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentOperations.slice(0, 10).map((operation, index) => (
              <li
                key={`${operation.mode}-${operation.client_order_id ?? operation.id ?? "idx"}-${index}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {operation.symbol}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {operation.side} · {operation.order_type} · {operation.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Qty {operation.quantity}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Preço {operation.price}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-100 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Ordem
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Símbolo
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Side
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Qty
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Preço
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900/40">
              {historicalOperations.slice(0, 10).map((operation, index) => (
                <tr
                  key={`${operation.mode}-${operation.id ?? operation.client_order_id ?? "row"}-${index}`}
                >
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {operation.client_order_id ?? operation.id}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{operation.symbol}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{operation.side}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{operation.quantity}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{operation.price}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{operation.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/40 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/40 dark:text-rose-100"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: StrategyField;
  value: FormValue | undefined;
  onChange: (value: FormValue) => void;
}) {
  const helper = field.helper ?? "";
  switch (field.type) {
    case "boolean":
      return (
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-medium text-slate-700 dark:text-slate-200">{field.label}</span>
        </label>
      );
    case "mode":
      return (
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            {field.label}
          </label>
          <select
            value={String(value ?? "PAPER")}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="PAPER">PAPER</option>
            <option value="REAL">REAL</option>
          </select>
          {helper && <span className="text-xs text-slate-400 dark:text-slate-500">{helper}</span>}
        </div>
      );
    case "symbol-list":
      return (
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            {field.label}
          </label>
          <input
            type="text"
            value={Array.isArray(value) ? value.join(", ") : String(value ?? "")}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split(",")
                  .map((token) => token.trim().toUpperCase())
                  .filter(Boolean),
              )
            }
            placeholder="Ex.: BTC-USD, ETH-USD"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {helper && <span className="text-xs text-slate-400 dark:text-slate-500">{helper}</span>}
        </div>
      );
    case "currency":
      return (
        <NumberInput
          field={field}
          value={value}
          onChange={onChange}
          prefix="USD "
          step={50}
          min={0}
        />
      );
    case "percent":
      return <NumberInput field={field} value={value} onChange={onChange} step={0.01} min={0.01} max={1} />;
    case "integer":
      return <NumberInput field={field} value={value} onChange={onChange} step={1} min={0} />;
    case "number":
    default:
      return <NumberInput field={field} value={value} onChange={onChange} step={0.1} />;
  }
}

function NumberInput({
  field,
  value,
  onChange,
  step,
  min,
  max,
  prefix,
}: {
  field: StrategyField;
  value: FormValue | undefined;
  onChange: (value: FormValue) => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string;
}) {
  const numericValue = typeof value === "number" ? value : value !== undefined ? Number(value) : "";
  return (
    <div className="flex flex-col space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
        {field.label}
      </label>
      <div className="flex rounded-lg border border-slate-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 dark:border-slate-600 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-400/40">
        {prefix && (
          <span className="inline-flex items-center px-2 text-sm text-slate-500 dark:text-slate-300">
            {prefix}
          </span>
        )}
        <input
          type="number"
          className="flex-1 rounded-r-lg border-0 bg-transparent px-3 py-2 text-sm text-slate-700 focus:outline-none dark:text-slate-100"
          value={numericValue}
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
          step={step}
          min={min}
          max={max}
        />
      </div>
      {field.helper && <span className="text-xs text-slate-400 dark:text-slate-500">{field.helper}</span>}
    </div>
  );
}

type PerformancePoint = {
  date: Date;
  balance: number;
};

function normalizeCashHistory(history: CashHistoryEntry[]): PerformancePoint[] {
  return history
    .map((entry) => {
      const date = entry.timestamp ? new Date(entry.timestamp) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return null;
      }
      return {
        date,
        balance: parseCurrency(entry.balance),
      };
    })
    .filter((item): item is PerformancePoint => item !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
        Sem dados suficientes para o gráfico.
      </div>
    );
  }

  const balances = data.map((point) => point.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const range = maxBalance - minBalance || 1;

  const coords = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((point.balance - minBalance) / range) * 100;
    return { x, y, balance: point.balance };
  });

  type ChartPoint = typeof coords[number];
  const pointToString = (point: { x: number; y: number }) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`;

  const initialBalance = data[0].balance;
  const baselineY = 100 - ((initialBalance - minBalance) / range) * 100;

  const segments: Array<{ color: "positive" | "negative"; path: string }> = [];
  const addSegment = (color: "positive" | "negative", from: ChartPoint, to: ChartPoint) => {
    if (Math.abs(from.x - to.x) < 0.0001 && Math.abs(from.y - to.y) < 0.0001) {
      return;
    }
    const move = `M ${pointToString(from)} L ${pointToString(to)}`;
    const last = segments[segments.length - 1];
    if (last && last.color === color) {
      last.path = `${last.path} L ${pointToString(to)}`;
    } else {
      segments.push({ color, path: move });
    }
  };

  for (let index = 0; index < coords.length - 1; index += 1) {
    const start = coords[index];
    const end = coords[index + 1];
    const startDelta = start.balance - initialBalance;
    const endDelta = end.balance - initialBalance;
    const startColor: "positive" | "negative" = startDelta >= 0 ? "positive" : "negative";
    const endColor: "positive" | "negative" = endDelta >= 0 ? "positive" : "negative";

    if (startColor === endColor) {
      addSegment(startColor, start, end);
      continue;
    }

    const denom = startDelta - endDelta;
    const ratio = denom === 0 ? 0 : startDelta / denom;
    const crossX = start.x + (end.x - start.x) * ratio;
    const crossY = start.y + (end.y - start.y) * ratio;
    const crossing: ChartPoint = { x: crossX, y: crossY, balance: initialBalance };

    addSegment(startColor, start, crossing);
    addSegment(endColor, crossing, end);
  }

  const firstDate = data[0].date.toLocaleString();
  const lastDate = data[data.length - 1].date.toLocaleString();

  const segmentColor = (color: "positive" | "negative") => (color === "positive" ? "#22c55e" : "#ef4444");

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <rect x="0" y="0" width="100" height="100" fill="rgba(15, 23, 42, 0.05)" />
        <line
          x1="0"
          x2="100"
          y1={baselineY.toFixed(2)}
          y2={baselineY.toFixed(2)}
          stroke="#cbd5f5"
          strokeWidth={0.6}
          strokeDasharray="3 2"
        />
        {segments.map((segment, index) => (
          <path
            key={`line-segment-${index}`}
            d={segment.path}
            stroke={segmentColor(segment.color)}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
        ))}
        {coords.map((point, index) => {
          const markerColor = point.balance >= initialBalance ? "#22c55e" : "#ef4444";
          return (
            <circle
              key={`chart-point-${index}`}
              cx={point.x}
              cy={point.y}
              r={1.2}
              fill="#0f172a"
              stroke={markerColor}
              strokeWidth={0.7}
            />
          );
        })}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  );
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{children}</p>
    </div>
  );
}

function extractFormValues(strategy: StrategyState, fields: StrategyField[]): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};
  for (const field of fields) {
    switch (field.key) {
      case "enabled":
        values[field.key] = strategy.enabled ?? false;
        break;
      case "mode":
        values[field.key] = strategy.mode ?? "PAPER";
        break;
      case "symbols":
        values[field.key] = Array.isArray(strategy.symbols) ? [...strategy.symbols] : [];
        break;
      case "usd_balance":
        values[field.key] = strategy.usd_balance ?? "0";
        break;
      case "take_profit_bps":
        values[field.key] = strategy.take_profit_bps ?? 0;
        break;
      case "stop_loss_bps":
        values[field.key] = strategy.stop_loss_bps ?? 0;
        break;
      case "fast_window":
        values[field.key] = strategy.fast_window ?? 0;
        break;
      case "slow_window":
        values[field.key] = strategy.slow_window ?? 0;
        break;
      case "min_signal_bps":
        values[field.key] = strategy.min_signal_bps ?? 0;
        break;
      case "position_size_pct":
        values[field.key] = strategy.position_size_pct ?? 0;
        break;
      case "cooldown_seconds":
        values[field.key] = strategy.cooldown_seconds ?? 0;
        break;
      case "batch_size":
        values[field.key] = strategy.batch_size ?? 0;
        break;
      case "batch_interval_minutes":
        values[field.key] = strategy.batch_interval_minutes ?? 0;
        break;
      default:
        values[field.key] = "";
    }
  }
  return values;
}

function buildPayload(values: Record<string, FormValue>): StrategyConfigUpdatePayload {
  const payload: StrategyConfigUpdatePayload = {};
  Object.entries(values).forEach(([key, rawValue]) => {
    switch (key) {
      case "enabled":
        payload.enabled = Boolean(rawValue);
        break;
      case "mode":
        payload.mode = String(rawValue).toUpperCase() as "REAL" | "PAPER";
        break;
      case "symbols":
        payload.symbols = Array.isArray(rawValue)
          ? rawValue.filter((item) => typeof item === "string")
          : String(rawValue || "")
              .split(",")
              .map((token) => token.trim().toUpperCase())
              .filter(Boolean);
        break;
      case "usd_balance":
        payload.usd_balance = rawValue === "" ? "0" : String(rawValue);
        break;
      case "take_profit_bps":
        payload.take_profit_bps = Number(rawValue);
        break;
      case "stop_loss_bps":
        payload.stop_loss_bps = Number(rawValue);
        break;
      case "fast_window":
        payload.fast_window = Number(rawValue);
        break;
      case "slow_window":
        payload.slow_window = Number(rawValue);
        break;
      case "min_signal_bps":
        payload.min_signal_bps = Number(rawValue);
        break;
      case "position_size_pct":
        payload.position_size_pct = Number(rawValue);
        break;
      case "cooldown_seconds":
        payload.cooldown_seconds = Number(rawValue);
        break;
      case "batch_size":
        payload.batch_size = Number(rawValue);
        break;
      case "batch_interval_minutes":
        payload.batch_interval_minutes = Number(rawValue);
        break;
      default:
        break;
    }
  });
  return payload;
}

function parseCurrency(value?: string | number | null): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
