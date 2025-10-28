"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchControlState } from "../../lib/api";
import type { StrategyState } from "../../lib/types";

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const parseUsd = (value?: string) => {
  if (!value) {
    return 0;
  }
  const sanitized = value.replace(/[^0-9.,-]/g, "");
  const normalized = sanitized.replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface StrategiesSectionProps {
  strategies?: StrategyState[];
  botStatus?: string;
  loading?: boolean;
  error?: string | null;
  standalone?: boolean;
  showBackLink?: boolean;
  backHref?: string;
}

export function StrategiesSection({
  strategies,
  botStatus = "UNKNOWN",
  loading,
  error,
  standalone = false,
  showBackLink = true,
  backHref = "/dashboard",
}: StrategiesSectionProps) {
  const [localStrategies, setLocalStrategies] = useState<StrategyState[]>([]);
  const [localBotStatus, setLocalBotStatus] = useState<string>(botStatus);
  const [localLoading, setLocalLoading] = useState<boolean>(loading ?? true);
  const [localError, setLocalError] = useState<string | null>(error ?? null);

  const shouldSelfFetch = strategies === undefined;

  useEffect(() => {
    if (!shouldSelfFetch) {
      setLocalStrategies(strategies ?? []);
      setLocalBotStatus(botStatus);
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
        const control = await fetchControlState(token);
        setLocalBotStatus(control.bot_status ?? "UNKNOWN");
        setLocalStrategies(control.strategies ?? []);
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Falha ao obter estratégias."
        );
      } finally {
        setLocalLoading(false);
      }
    };

    void load();
  }, [shouldSelfFetch, strategies, botStatus, loading, error]);

  const hasStrategies = localStrategies.length > 0;
  const sortedStrategies = useMemo(
    () =>
      [...localStrategies].sort((a, b) =>
        a.strategy_id.localeCompare(b.strategy_id, undefined, {
          sensitivity: "base",
        })
      ),
    [localStrategies]
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Gestão das Estratégias
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Estratégias configuradas
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
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Estado do bot: {" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {localBotStatus}
          </span>
        </p>
      </section>

      {localLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          A carregar estratégias...
        </section>
      ) : localError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {localError}
        </section>
      ) : hasStrategies ? (
        <section className="grid gap-4 md:grid-cols-2">
          {sortedStrategies.map((strategy) => (
            <article
              key={strategy.strategy_id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500/60"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {strategy.strategy_id}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Estado atual:
              </p>
              <dl className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <dt>Ativa</dt>
                  <dd
                    className={`font-semibold ${
                      strategy.enabled
                        ? "text-emerald-600 dark:text-emerald-300"
                        : "text-rose-600 dark:text-rose-300"
                    }`}
                  >
                    {strategy.enabled ? "Sim" : "Não"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Modo</dt>
                  <dd
                    className={`font-semibold ${
                      strategy.mode === "PAPER"
                        ? "text-amber-600 dark:text-amber-300"
                        : "text-indigo-600 dark:text-indigo-300"
                    }`}
                  >
                    {strategy.mode}
                  </dd>
                </div>
              </dl>
              {(strategy.symbols && strategy.symbols.length > 0) || strategy.usd_balance ? (
                <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                  {strategy.symbols && strategy.symbols.length > 0 && (
                    <p className="text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-600 dark:text-slate-200">Ativos:</span> {strategy.symbols.join(", ")}
                    </p>
                  )}
                  {strategy.usd_balance && (
                    <p className="text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-600 dark:text-slate-200">Saldo paper:</span> {formatUsd(parseUsd(strategy.usd_balance))}
                    </p>
                  )}
                  {(strategy.take_profit_bps || strategy.stop_loss_bps) && (
                    <p className="text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-600 dark:text-slate-200">Risco:</span> TP {(strategy.take_profit_bps ?? 0) / 100}% · SL {(strategy.stop_loss_bps ?? 0) / 100}%
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Ainda não existem estratégias registadas no Redis. Utilize o dashboard para
          enviar comandos ou aguarde sincronização do Strategy Framework.
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Roadmap de novas estratégias
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• Estratégia de mean reversion baseada em janelas adaptativas.</li>
          <li>• Conector de breakout com gestão de risco avançada.</li>
          <li>• Controlo granular de exposição por ativo.</li>
        </ul>
      </section>
    </div>
  );
}
