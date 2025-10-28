"use client";

import Link from "next/link";

export interface MetricsSectionProps {
  standalone?: boolean;
  showBackLink?: boolean;
  backHref?: string;
}

export function MetricsSection({
  standalone = false,
  showBackLink = true,
  backHref = "/dashboard",
}: MetricsSectionProps) {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Observabilidade &amp; saúde
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Métricas &amp; alertas
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

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Integração com Prometheus / Grafana
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            As métricas já são expostas pelos serviços (Risk Engine e Strategy Framework)
            e podem ser vistas no stack Prometheus/Grafana do `docker-compose`. Esta
            secção futuramente trará um resumo rápido no próprio Control Center.
          </p>
          <Link
            href="http://localhost:3000"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:border-indigo-400 dark:border-indigo-500/60 dark:text-indigo-300"
          >
            Abrir Grafana
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Roadmap de monitorização
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <li>• Painel de latency para validação de sinais e execução de ordens.</li>
            <li>• Alertas de disponibilidade para Kafka, Redis e Risk Engine.</li>
            <li>• Heatmap de aprovação vs rejeição por estratégia e símbolo.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <p>
          Esta área será alimentada por uma API dedicada de observabilidade. Enquanto isso,
          utilize o dashboard principal e o Grafana para acompanhar o estado do sistema em
          tempo real.
        </p>
      </section>
    </div>
  );
}
