"use client";

import Link from "next/link";
import { useState } from "react";

export interface SettingsSectionProps {
  standalone?: boolean;
  showBackLink?: boolean;
  backHref?: string;
}

export function SettingsSection({
  standalone = false,
  showBackLink = true,
  backHref = "/dashboard",
}: SettingsSectionProps) {
  const [themePreference, setThemePreference] = useState<string>("system");

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Preferências do Control Center
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Configurações
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

      <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Aparência
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ajustes rápidos do tema para futuras personalizações.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { label: "Automático", value: "system" },
              { label: "Claro", value: "light" },
              { label: "Escuro", value: "dark" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setThemePreference(option.value)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  themePreference === option.value
                    ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:text-indigo-200"
                    : "border-slate-300 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Integração com o tema real da aplicação ocorrerá numa fase posterior.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Controlo remoto
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Brevemente poderemos configurar webhooks, alertas por Slack/Teams e chaves
            de API para automatizar comandos fora da UI.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <p>
          As configurações ainda são mockadas mas este espaço já prepara a estrutura
          para salvar preferências persistentes (tema, notificações, limites do bot).
          Feedbacks são bem-vindos para priorizarmos as definições mais críticas.
        </p>
      </section>
    </div>
  );
}
