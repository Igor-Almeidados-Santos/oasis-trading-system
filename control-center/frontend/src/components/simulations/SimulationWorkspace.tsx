"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
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
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [chartRange, setChartRange] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");

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
      if (result.success) {
        if (result.strategy) {
          setCurrentStrategy(result.strategy);
          setFormValues(extractFormValues(result.strategy, result.strategy.fields ?? fields));
        }
        setFeedback({ type: "success", message: "Configuração atualizada com sucesso." });
        setConfigModalOpen(false);
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

  const syncCurrentStrategy = async () => {
    if (!selectedStrategyId) {
      return;
    }
    const result = await onRefresh(selectedStrategyId);
    if (result.success && result.strategy) {
      setCurrentStrategy(result.strategy);
      setFormValues(extractFormValues(result.strategy, result.strategy.fields ?? fields));
      setFeedback({ type: "success", message: "Configuração sincronizada com sucesso." });
    } else if (!result.success && result.errorMessage) {
      setFeedback({ type: "error", message: result.errorMessage });
    }
  };

  const closeConfigModal = () => {
    setConfigModalOpen(false);
    setFeedback(null);
  };

  const openConfigModal = () => {
    setFeedback(null);
    setConfigModalOpen(true);
  };

  const effectiveLoading = Boolean(loading);
  const positions = paperState?.positions ?? [];
  const recentOperations = paperState?.recentOperations ?? [];
  const historicalOperations = paperState?.historicalOperations ?? [];
  const cashHistory = useMemo(() => paperState?.cashHistory ?? [], [paperState?.cashHistory]);
  const filteredHistory = useMemo(
    () => filterCashHistoryByRange(cashHistory, chartRange),
    [cashHistory, chartRange],
  );
  const pnlSummary = useMemo(() => summarizePnl(filteredHistory), [filteredHistory]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">Laboratório de Simulações</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Ambiente Paper & Estratégias
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ative a estratégia em modo PAPER no dashboard principal para gerar sinais com o caixa fictício configurado.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Estratégia atual:{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {currentStrategy?.strategy_id ?? "nenhuma selecionada"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500"
            onClick={openConfigModal}
            disabled={effectiveLoading || strategies.length === 0}
          >
            Configurar simulação
          </button>
          <button
            type="button"
            className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700 dark:border-rose-400/60 dark:text-rose-200 dark:hover:border-rose-400 dark:hover:text-rose-100"
            onClick={() => void handleResetPaper()}
            disabled={resetting || effectiveLoading}
          >
            {resetting ? "A limpar..." : "Limpar histórico paper"}
          </button>
        </div>
      </header>

      <section className="grid gap-4 border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Caixa (paper)">{summary.cashDisplay}</SummaryTile>
        <SummaryTile label="Lucro/Prejuízo">{summary.pnlDisplay}</SummaryTile>
        <SummaryTile label="Operações recentes">{summary.operations}</SummaryTile>
        <SummaryTile label="Posições simuladas">{summary.positions}</SummaryTile>
      </section>

      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={closeConfigModal}
          />
          <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Configurar simulação
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Escolha a estratégia e ajuste os parâmetros utilizados para gerar sinais em modo paper.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
                onClick={closeConfigModal}
                aria-label="Fechar configuração"
              >
                ✕
              </button>
            </div>
            <form className="mt-6 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Estratégia a simular
                </label>
                <div className="flex flex-col gap-3 md:flex-row">
                  <select
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                    onClick={() => void syncCurrentStrategy()}
                    disabled={effectiveLoading || strategies.length === 0}
                  >
                    Sincronizar
                  </button>
                </div>
              </div>
              {fields.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Esta estratégia não expõe parâmetros editáveis através do painel.
                </p>
              ) : (
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
              )}

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
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                    onClick={closeConfigModal}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:disabled:bg-indigo-500/40"
                    disabled={effectiveLoading || submitting}
                  >
                    {submitting ? "Enviando..." : "Guardar alterações"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Desempenho</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Evolução do saldo disponível no ambiente paper.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <LegendChip color="bg-emerald-400" label="Lucro" value={pnlSummary.gainDisplay} />
                <LegendChip color="bg-rose-500" label="Perda" value={pnlSummary.lossDisplay} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-full px-3 py-1 ${
                    chartRange === label
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                  onClick={() => setChartRange(label)}
                >
                  {label.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-52 md:h-60">
            <PerformanceChart data={normalizeCashHistory(filteredHistory)} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configuração ativa</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Resumo do que foi aplicado no laboratório de simulações.
          </p>
          {currentStrategy ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Saldo fictício</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatUsd(parseCurrency(currentStrategy.usd_balance ?? "0"))}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Ativos monitorados</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {Array.isArray(currentStrategy.symbols) && currentStrategy.symbols.length > 0
                    ? currentStrategy.symbols.join(", ")
                    : "—"}
                </dd>
              </div>
              {typeof currentStrategy.position_size_pct === "number" && (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">% por posição</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {(currentStrategy.position_size_pct * 100).toFixed(1)}%
                  </dd>
                </div>
              )}
              {typeof currentStrategy.cooldown_seconds === "number" && (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Cooldown</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {currentStrategy.cooldown_seconds}s
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Carregando parâmetros da estratégia selecionada...
            </p>
          )}
          <button
            type="button"
            className="mt-6 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
            onClick={openConfigModal}
            disabled={effectiveLoading || strategies.length === 0}
          >
            Ajustar parâmetros
          </button>
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
  label: string;
  online: number;
  store: number;
};

function filterCashHistoryByRange(history: CashHistoryEntry[], range: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY") {
  if (!history || history.length === 0) {
    return [];
  }
  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case "DAILY":
      start.setDate(now.getDate() - 1);
      break;
    case "WEEKLY":
      start.setDate(now.getDate() - 7);
      break;
    case "MONTHLY":
      start.setMonth(now.getMonth() - 1);
      break;
    case "YEARLY":
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      break;
  }
  return history.filter((entry) => {
    if (!entry.timestamp) {
      return false;
    }
    const ts = new Date(entry.timestamp);
    return ts >= start && ts <= now;
  });
}

function normalizeCashHistory(history: CashHistoryEntry[]): PerformancePoint[] {
  return history
    .map((entry, index, arr) => {
      const date = entry.timestamp ? new Date(entry.timestamp) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return null;
      }
      const balance = parseCurrency(entry.balance);
      if (!Number.isFinite(balance)) {
        return null;
      }
      const previousBalance = index > 0 ? parseCurrency(arr[index - 1]?.balance) : null;
      const delta = previousBalance != null ? balance - previousBalance : 0;
      const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return {
        label,
        online: delta > 0 ? delta : 0,
        store: delta < 0 ? Math.abs(delta) : 0,
      };
    })
    .filter((item): item is PerformancePoint => item !== null)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function summarizePnl(data: PerformancePoint[]) {
  return data.reduce(
    (acc, point) => {
      acc.gain += point.online;
      acc.loss += point.store;
      return acc;
    },
    { gain: 0, loss: 0 },
  );
}

function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
        Sem dados suficientes para o gráfico.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded-2xl bg-gradient-to-b from-slate-900/5 to-slate-100 dark:from-slate-900 dark:to-slate-900/20 p-4 shadow-inner">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="simOnline" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="simStore" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fdba74" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis hide />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="store"
            stroke="#fb923c"
            strokeWidth={2}
            fill="url(#simStore)"
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="online"
            stroke="#7c3aed"
            strokeWidth={2}
            fill="url(#simOnline)"
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0].payload as PerformancePoint;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{datum.label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
        Lucro <span className="font-bold text-emerald-500">{formatUsd(datum.online)}</span>
      </p>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
        Perda <span className="font-bold text-rose-500">{formatUsd(datum.store)}</span>
      </p>
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
function LegendChip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
      <span className="text-slate-500 dark:text-slate-400">{value}</span>
    </div>
  );
}
