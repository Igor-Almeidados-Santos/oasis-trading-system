"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOperations } from "../../lib/api";
import type { Operation } from "../../lib/types";

const STATUS_COLORS: Record<string, string> = {
  FILLED: "text-emerald-600 dark:text-emerald-300",
  REJECTED: "text-rose-600 dark:text-rose-300",
  PENDING: "text-amber-600 dark:text-amber-300",
};

export interface OperationsSectionProps {
  operations?: Operation[];
  loading?: boolean;
  error?: string | null;
  standalone?: boolean;
  showBackLink?: boolean;
  backHref?: string;
}

const FILTER_STORAGE_KEY = "dashboard-operations-filters";

export function OperationsSection({
  operations,
  loading,
  error,
  standalone = false,
  showBackLink = true,
  backHref = "/dashboard",
}: OperationsSectionProps) {
  const [mode, setMode] = useState<string>("ALL");
  const [limit, setLimit] = useState<number>(50);
  const [search, setSearch] = useState<string>("");

  const [localOperations, setLocalOperations] = useState<Operation[]>(operations ?? []);
  const [localLoading, setLocalLoading] = useState<boolean>(loading ?? true);
  const [localError, setLocalError] = useState<string | null>(error ?? null);

  const shouldSelfFetch = operations === undefined;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<{
          mode: string;
          limit: number;
          search: string;
        }>;
        if (parsed.mode && typeof parsed.mode === "string") {
          setMode(parsed.mode);
        }
        if (parsed.limit && Number.isFinite(parsed.limit)) {
          setLimit(parsed.limit);
        }
        if (parsed.search && typeof parsed.search === "string") {
          setSearch(parsed.search);
        }
      }
    } catch (error) {
      console.warn("Falha ao carregar filtros de operações:", error);
    }
  }, []);

  useEffect(() => {
    if (!shouldSelfFetch) {
      setLocalOperations(operations ?? []);
      setLocalLoading(Boolean(loading));
      setLocalError(error ?? null);
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLocalError("Sessão expirada. Faça login novamente.");
      setLocalLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLocalLoading(true);
        setLocalError(null);
        const data = await fetchOperations(token, { limit, mode });
        setLocalOperations(Array.isArray(data) ? data : []);
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Falha ao carregar operações."
        );
      } finally {
        setLocalLoading(false);
      }
    };

    void load();
  }, [shouldSelfFetch, operations, loading, error, limit, mode]);

  useEffect(() => {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ mode, limit, search })
    );
  }, [mode, limit, search]);

  const filteredOperations = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base =
      mode === "ALL"
        ? localOperations
        : localOperations.filter((operation) => operation.mode === mode);
    if (!term) {
      return base;
    }
    return base.filter((operation) =>
      [
        operation.symbol,
        operation.side,
        operation.status,
        operation.mode,
        operation.order_type,
        operation.client_order_id,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term))
    );
  }, [localOperations, search, mode]);

  const counters = useMemo(() => {
    const total = filteredOperations.length;
    const filled = filteredOperations.filter((op) =>
      op.status.toUpperCase().includes("FILL")
    ).length;
    const rejected = filteredOperations.filter((op) =>
      op.status.toUpperCase().includes("REJECT")
    ).length;
    const pending = filteredOperations.filter((op) =>
      ["PENDING", "NEW", "OPEN"].includes(op.status.toUpperCase())
    ).length;

    return [
      {
        label: "Total",
        value: total,
        tone: "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
      },
      {
        label: "Executadas",
        value: filled,
        tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
      },
      {
        label: "Pendentes",
        value: pending,
        tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
      },
      {
        label: "Rejeitadas",
        value: rejected,
        tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
      },
    ];
  }, [filteredOperations]);

  const handleExportCsv = useCallback(() => {
    if (typeof window === "undefined" || filteredOperations.length === 0) {
      return;
    }

    const header = [
      "id",
      "client_order_id",
      "symbol",
      "side",
      "quantity",
      "price",
      "mode",
      "status",
      "executed_at",
    ];

    const escape = (value: string | number | undefined) => {
      if (value == null) {
        return "";
      }
      const str = String(value);
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredOperations.map((op) =>
      [
        op.id,
        op.client_order_id ?? "",
        op.symbol,
        op.side,
        op.quantity,
        op.price,
        op.mode,
        op.status,
        op.executed_at ?? "",
      ]
        .map(escape)
        .join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `operations-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredOperations]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Histórico de ordens &amp; fills
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Operações
          </h1>
        </div>
        {standalone && showBackLink && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
          >
            ← Voltar ao dashboard
          </Link>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Filtro:</span>
          {["ALL", "REAL", "PAPER"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-full border px-3 py-1 font-semibold transition ${
                mode === value
                  ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:text-indigo-200"
                  : "border-slate-300 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-300 dark:hover-border-indigo-400 dark:hover:text-indigo-200"
              }`}
            >
              {value}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2">
            Limite
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:border-indigo-300 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {[20, 50, 100, 200].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar operações..."
            className="w-48 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 focus:border-indigo-300 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredOperations.length === 0}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filteredOperations.length === 0
                ? "cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-600 dark:text-slate-500"
                : "border-slate-300 text-indigo-600 hover:border-indigo-400 dark:border-slate-600 dark:text-indigo-300"
            }`}
          >
            Exportar CSV
          </button>
        </div>
      </section>

      {localLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          A carregar operações...
        </section>
      ) : localError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {localError}
        </section>
      ) : filteredOperations.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Não foram encontradas operações para os filtros selecionados.
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-3 md:grid-cols-4">
            {counters.map((counter) => (
              <div
                key={counter.label}
                className={`rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 ${counter.tone}`}
              >
                <p className="text-xs uppercase tracking-wide">{counter.label}</p>
                <p className="mt-2 text-lg font-semibold">{counter.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-700">
              <thead className="bg-slate-100 uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Símbolo</th>
                  <th className="px-4 py-3">Lado</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Modo</th>
                  <th className="px-4 py-3">Executado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600 dark:divide-slate-700 dark:text-slate-300">
                {filteredOperations.map((operation) => (
                  <tr key={`${operation.mode}-${operation.id}-${operation.client_order_id || ""}`}>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {operation.client_order_id || operation.id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                      {operation.symbol}
                    </td>
                    <td className="px-4 py-3">{operation.side}</td>
                    <td className="px-4 py-3">{operation.quantity}</td>
                    <td className="px-4 py-3">{operation.price}</td>
                    <td className={`px-4 py-3 ${
                      STATUS_COLORS[operation.status.toUpperCase()] || ""
                    }`}
                    >
                      {operation.status}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          operation.mode === "PAPER"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                        }`}
                      >
                        {operation.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {operation.executed_at
                        ? new Date(operation.executed_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <p>
          Esta página evoluirá com exportações, filtros por período e gráficos de execução.
          Certifique-se de que as tabelas <code>orders</code> e <code>fills</code> estão
          populadas para observar dados reais.
        </p>
      </section>
    </div>
  );
}
