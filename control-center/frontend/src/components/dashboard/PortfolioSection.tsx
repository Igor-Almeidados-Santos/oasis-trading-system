"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchPortfolio } from "../../lib/api";
import type { PortfolioCash, PortfolioSnapshot, Position } from "../../lib/types";

export interface PortfolioSectionProps {
  positions?: Position[];
  cash?: PortfolioCash;
  loading?: boolean;
  error?: string | null;
  standalone?: boolean;
  showBackLink?: boolean;
  backHref?: string;
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const computeExposure = (items: Position[]) =>
  items.reduce((acc, pos) => {
    const price = Number(pos.average_price || "0");
    const quantity = Number(pos.quantity || "0");
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) {
      return acc;
    }
    return acc + price * quantity;
  }, 0);

const parseUsdValue = (value?: string): number => {
  if (!value) {
    return 0;
  }

  const sanitized = value.replace(/[^0-9.,-]/g, "");
  const normalized = sanitized.replace(/,/g, ".");
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? numeric : 0;
};

export function PortfolioSection({
  positions,
  cash,
  loading,
  error,
  standalone = false,
  showBackLink = true,
  backHref = "/dashboard",
}: PortfolioSectionProps) {
  const [localPositions, setLocalPositions] = useState<Position[]>(positions ?? []);
  const [localCash, setLocalCash] = useState<PortfolioCash>(cash ?? {});
  const [localLoading, setLocalLoading] = useState<boolean>(loading ?? true);
  const [localError, setLocalError] = useState<string | null>(error ?? null);

  const shouldSelfFetch = positions === undefined;

  useEffect(() => {
    if (!shouldSelfFetch) {
      setLocalPositions(positions ?? []);
      setLocalCash(cash ?? {});
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
        const data: PortfolioSnapshot = await fetchPortfolio(token);
        setLocalPositions(Array.isArray(data.positions) ? data.positions : []);
        setLocalCash(data.cash ?? {});
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Falha ao obter portfólio."
        );
      } finally {
        setLocalLoading(false);
      }
    };

    void load();
  }, [shouldSelfFetch, positions, loading, error, cash]);

  const metrics = useMemo(() => {
    const paperPositions = localPositions.filter((pos) => pos.mode === "PAPER");
    const livePositions = localPositions.filter((pos) => pos.mode === "REAL");
    const paperCash = parseUsdValue(localCash.PAPER);
    const liveCash = parseUsdValue(localCash.REAL);

    return [
      { label: "Exposição total (paper)", value: formatUsd(computeExposure(paperPositions)) },
      { label: "Caixa disponível (paper)", value: formatUsd(paperCash) },
      { label: "Exposição total (real)", value: formatUsd(computeExposure(livePositions)) },
      { label: "Caixa disponível (real)", value: formatUsd(liveCash) },
      { label: "Ativos monitorizados", value: localPositions.length.toString() },
      { label: "Última atualização", value: new Date().toLocaleString() },
    ];
  }, [localPositions, localCash]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Monitorização das posições
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Portfólio &amp; exposição
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

      {localLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          A carregar posições...
        </section>
      ) : localError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {localError}
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {metric.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {metric.value}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Posições atuais
            </h2>
            {localPositions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Não existem posições registadas neste momento.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Símbolo</th>
                      <th className="px-4 py-3">Quantidade</th>
                      <th className="px-4 py-3">Preço médio</th>
                      <th className="px-4 py-3">Modo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs text-slate-600 dark:divide-slate-700 dark:text-slate-300">
                    {localPositions.map((pos) => (
                      <tr key={`${pos.mode}-${pos.symbol}`}>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                          {pos.symbol}
                        </td>
                        <td className="px-4 py-3">{pos.quantity}</td>
                        <td className="px-4 py-3">{pos.average_price}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              pos.mode === "PAPER"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                            }`}
                          >
                            {pos.mode}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Reservas de caixa
            </h2>
            {Object.keys(localCash).length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Não existem valores de caixa registados para os modos atuais.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(localCash).map(([mode, value]) => (
                  <div
                    key={mode}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm transition dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Caixa {mode}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {formatUsd(parseUsdValue(value))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <p>
          Este painel será expandido para incluir comparativos históricos, gráficos de
          exposição e exportação de relatórios. Enquanto isso, continue a usar o
          dashboard principal para acompanhamento em tempo real.
        </p>
      </section>
    </div>
  );
}
