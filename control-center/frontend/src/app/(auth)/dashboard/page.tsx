"use client";

import { useEffect, useMemo, useState } from "react";

interface Position {
  symbol: string;
  quantity: string;
  average_price: string;
  mode: string;
}

interface Operation {
  id: number;
  symbol: string;
  side: string;
  order_type: string;
  status: string;
  price: string;
  quantity: string;
  executed_at?: string;
  mode: string;
}

interface StrategyState {
  strategy_id: string;
  enabled: boolean;
  mode: "REAL" | "PAPER";
}

interface ControlState {
  bot_status: string;
  strategies: StrategyState[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081";

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<Position[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [controlState, setControlState] = useState<ControlState | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<string | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("Trader");
  const [selectedStrategy, setSelectedStrategy] =
    useState<string>("momentum-001");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("username");
    if (storedUser) {
      setUsername(storedUser);
    }

    const storedTheme = localStorage.getItem("control-center-theme");
    if (storedTheme === "dark") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("control-center-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setPortfolioError("Sessão expirada. Faça login novamente.");
        setOperationsError("Sessão expirada. Faça login novamente.");
        setControlError("Sessão expirada. Faça login novamente.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setPortfolioError(null);
        setOperationsError(null);
        setControlError(null);

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [portfolioRes, operationsRes, controlRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/portfolio`, { headers }),
          fetch(`${API_BASE}/api/v1/operations?limit=8`, { headers }),
          fetch(`${API_BASE}/api/v1/control/state`, { headers }),
        ]);

        if (portfolioRes.ok) {
          setPortfolio(await portfolioRes.json());
        } else {
          setPortfolioError(await safeError(portfolioRes));
        }

        if (operationsRes.ok) {
          setOperations(await operationsRes.json());
        } else {
          setOperationsError(await safeError(operationsRes));
        }

        if (controlRes.ok) {
          const state: ControlState = await controlRes.json();
          setControlState(state);
          if (state.strategies.length > 0) {
            setSelectedStrategy(state.strategies[0].strategy_id);
          }
        } else {
          setControlError(await safeError(controlRes));
        }
      } catch {
        setPortfolioError("Falha ao contactar o servidor.");
        setOperationsError("Falha ao contactar o servidor.");
        setControlError("Falha ao contactar o servidor.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const strategiesList = useMemo(
    () => controlState?.strategies ?? [],
    [controlState]
  );
  const hasStrategies = strategiesList.length > 0;

  const summary = useMemo(() => {
    const positions = Array.isArray(portfolio) ? portfolio : [];
    const ops = Array.isArray(operations) ? operations : [];
    const real = positions.filter((p) => p.mode === "REAL").length;
    const paper = positions.filter((p) => p.mode === "PAPER").length;
    const total = positions.length;
    const lastOperation = ops[0]?.executed_at
      ? new Date(ops[0].executed_at).toLocaleString()
      : "—";

    return {
      real,
      paper,
      total,
      lastOperation,
      botStatus: controlState?.bot_status ?? "—",
      activeStrategies: strategiesList.filter((s) => s.enabled).length,
      totalStrategies: strategiesList.length,
    };
  }, [portfolio, operations, controlState, strategiesList]);

  async function sendBotCommand(status: "START" | "STOP") {
    await sendCommand(async (token) => {
      const res = await fetch(`${API_BASE}/api/v1/bot/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error(await safeError(res));
      }
      setCommandStatus(
        status === "START"
          ? "Comando enviado: bot a iniciar."
          : "Comando enviado: bot a parar."
      );
    });
  }

  async function sendStrategyCommand(
    strategyId: string,
    payload: { enabled: boolean; mode: "REAL" | "PAPER" }
  ) {
    await sendCommand(async (token) => {
      const res = await fetch(
        `${API_BASE}/api/v1/strategies/${strategyId}/toggle`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error(await safeError(res));
      }
      setCommandStatus(
        `Estratégia ${strategyId} atualizada para ${payload.mode}.`
      );
    });
  }

  async function sendCommand(fn: (token: string) => Promise<void>) {
    try {
      setCommandLoading(true);
      setCommandStatus(null);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      await fn(token);
      await reloadData(token);
    } catch (err) {
      setCommandStatus(
        err instanceof Error ? err.message : "Falha ao enviar comando."
      );
    } finally {
      setCommandLoading(false);
    }
  }

  async function reloadData(token: string) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [portfolioRes, operationsRes, controlRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/portfolio`, { headers }),
        fetch(`${API_BASE}/api/v1/operations?limit=8`, { headers }),
        fetch(`${API_BASE}/api/v1/control/state`, { headers }),
      ]);

      if (portfolioRes.ok) {
        setPortfolio(await portfolioRes.json());
      }
      if (operationsRes.ok) {
        setOperations(await operationsRes.json());
      }
      if (controlRes.ok) {
        const state: ControlState = await controlRes.json();
        setControlState(state);
        if (
          state.strategies.length > 0 &&
          !state.strategies.some((s) => s.strategy_id === selectedStrategy)
        ) {
          setSelectedStrategy(state.strategies[0].strategy_id);
        }
      }
    } catch (error) {
      console.error("Erro ao recarregar dados:", error);
    }
  }

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex min-h-screen w-full bg-slate-100 transition-colors dark:bg-slate-900">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:gap-4">
          <aside
            className={`flex flex-shrink-0 flex-col justify-between bg-gradient-to-br from-[#191835] via-[#26264a] to-[#343466] text-white transition-all duration-300 ${
              sidebarCollapsed ? "w-[92px] p-5 items-center" : "w-64 p-6"
            }`}
          >
            <div className="w-full">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="mb-6 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/80 transition hover:bg-white/20"
                aria-label="Alternar barra lateral"
              >
                {sidebarCollapsed ? (
                  <ArrowRightIcon className="h-5 w-5" />
                ) : (
                  <ArrowLeftIcon className="h-5 w-5" />
                )}
              </button>

              {!sidebarCollapsed && (
                <div className="mb-10 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold">
                    O
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Oasis</p>
                    <p className="text-sm text-white/60">Control Center</p>
                  </div>
                </div>
              )}

              <nav className="space-y-3 text-sm font-medium">
                <NavItem
                  icon={<GridIcon className="h-5 w-5" />}
                  label="Dashboard"
                  collapsed={sidebarCollapsed}
                />
                <NavItem
                  icon={<BrainIcon className="h-5 w-5" />}
                  label="Estratégias"
                  collapsed={sidebarCollapsed}
                />
                <NavItem
                  icon={<ChartUpIcon className="h-5 w-5" />}
                  label="Portfólio"
                  collapsed={sidebarCollapsed}
                />
                <NavItem
                  icon={<ClipboardIcon className="h-5 w-5" />}
                  label="Operações"
                  collapsed={sidebarCollapsed}
                />
                <NavItem
                  icon={<RadarIcon className="h-5 w-5" />}
                  label="Métricas"
                  collapsed={sidebarCollapsed}
                />
                <NavItem
                  icon={<CogIcon className="h-5 w-5" />}
                  label="Configurações"
                  collapsed={sidebarCollapsed}
                />
              </nav>
            </div>

            {!sidebarCollapsed && (
              <div className="mt-6 bg-white/10 px-6 py-6">
                <p className="text-sm text-white/70">Gestão do Bot</p>
                <p className="mt-2 text-lg font-semibold">
                  Status {summary.botStatus}
                </p>
                <p className="mt-3 text-xs text-white/60">
                  Utilize o painel para alternar modos (REAL/PAPER) e pausar
                  estratégias em segundos.
                </p>
              </div>
            )}
          </aside>

          <main className="flex-1 space-y-5 bg-white px-6 py-8 shadow transition-colors dark:bg-slate-800">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Bem-vindo de volta
                </p>
                <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
                  {username} 👋
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDarkMode((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  {darkMode ? (
                    <>
                      <SunIcon className="h-4 w-4" />
                      Modo claro
                    </>
                  ) : (
                    <>
                      <MoonIcon className="h-4 w-4" />
                      Modo escuro
                    </>
                  )}
                </button>
                <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Pipeline em execução
                </div>
              </div>
            </header>

            <section className="grid gap-4 border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:grid-cols-3">
              <SummaryCard
                title="Posições ativas"
                value={summary.total.toString()}
                description={`${summary.real} REAL · ${summary.paper} PAPER`}
                accent="from-emerald-400 to-emerald-500"
              />
              <SummaryCard
                title="Estado do Bot"
                value={summary.botStatus}
                description={`Última operação: ${summary.lastOperation}`}
                accent="from-indigo-400 to-indigo-500"
              />
              <SummaryCard
                title="Estratégias ativas"
                value={`${summary.activeStrategies}/${summary.totalStrategies}`}
                description="Geridas via Control Center"
                accent="from-amber-400 to-amber-500"
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="bg-slate-50 p-6 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Visão Geral de Portfólio
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Distribuição entre modos e ativos em tempo real.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Atualizado
                  </span>
                </div>

                {loading ? (
                  <EmptyState
                    message="A carregar dados do portfólio..."
                    darkMode={darkMode}
                  />
                ) : portfolioError ? (
                  <ErrorState message={portfolioError} />
                ) : controlError ? (
                  <ErrorState message={controlError} />
                ) : portfolio.length === 0 ? (
                  <EmptyState
                    message="Nenhuma posição registada no momento."
                    darkMode={darkMode}
                  />
                ) : (
                  <div className="mt-6 space-y-4">
                    {portfolio.map((pos) => (
                      <div
                        key={`${pos.mode}-${pos.symbol}`}
                        className="flex items-center justify-between border border-slate-200 bg-white px-4 py-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            {pos.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {pos.symbol}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Modo {pos.mode}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            Qty {pos.quantity}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Média {pos.average_price}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-6 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Operações Recentes
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Últimas ordens aprovadas pelo Risk Engine.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
                  >
                    Ver histórico
                  </button>
                </div>

                {loading ? (
                  <EmptyState
                    message="A carregar operações..."
                    darkMode={darkMode}
                  />
                ) : operationsError ? (
                  <ErrorState message={operationsError} />
                ) : operations.length === 0 ? (
                  <EmptyState
                    message="Ainda não foram registadas operações."
                    darkMode={darkMode}
                  />
                ) : (
                  <ul className="mt-6 space-y-4">
                    {operations.slice(0, 5).map((op) => (
                      <li
                        key={op.id}
                        className="flex items-center justify-between border border-slate-200 bg-white px-4 py-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {op.symbol} · {op.side}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {op.executed_at
                              ? new Date(op.executed_at).toLocaleString()
                              : "Pendente"}{" "}
                            · {op.mode} · {op.order_type}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {op.quantity}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {op.status}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Controlo Rápido
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Dispare comandos diretamente para o Strategy Framework via
                    Kafka.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  {hasStrategies ? (
                    <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                      Estratégia
                      <select
                        value={selectedStrategy}
                        onChange={(event) =>
                          setSelectedStrategy(event.target.value)
                        }
                        className="rounded-full border-none bg-transparent text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-200"
                      >
                        {strategiesList.map((strategy) => (
                          <option
                            key={strategy.strategy_id}
                            value={strategy.strategy_id}
                          >
                            {strategy.strategy_id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                      Sem estratégias registadas
                    </span>
                  )}
                  <ActionButton
                    label="Ativar Bot"
                    tone="emerald"
                    onClick={() => sendBotCommand("START")}
                    disabled={commandLoading}
                  />
                  <ActionButton
                    label="Pausar Bot"
                    tone="rose"
                    onClick={() => sendBotCommand("STOP")}
                    disabled={commandLoading}
                  />
                  <ActionButton
                    label="Modo Paper"
                    tone="amber"
                    onClick={() =>
                      sendStrategyCommand(selectedStrategy, {
                        enabled: true,
                        mode: "PAPER",
                      })
                    }
                    disabled={commandLoading || !hasStrategies}
                  />
                  <ActionButton
                    label="Modo Real"
                    tone="indigo"
                    onClick={() =>
                      sendStrategyCommand(selectedStrategy, {
                        enabled: true,
                        mode: "REAL",
                      })
                    }
                    disabled={commandLoading || !hasStrategies}
                  />
                </div>
              </div>

              {commandStatus && (
                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                  {commandStatus}
                </div>
              )}
              {controlError && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  {controlError}
                </div>
              )}

              <div className="mt-6 grid gap-4 border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 md:grid-cols-4">
                <ControlCard
                  title="Status do Bot"
                  value={summary.botStatus}
                  description="Estado sincronizado com o Strategy Framework."
                  accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                />
                <ControlCard
                  title="Estratégias ativas"
                  value={`${summary.activeStrategies}/${summary.totalStrategies}`}
                  description="Configure o modo via Control Center."
                  accent="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                />
                <ControlCard
                  title="Alertas"
                  value={operations.length.toString()}
                  description="Operações processadas nas últimas leituras."
                  accent="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                />
                <ControlCard
                  title="Próximo review"
                  value={summary.lastOperation}
                  description="Última atividade registada."
                  accent="bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
                />
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  label,
  icon,
  collapsed,
}: {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/10 ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <span className="text-white">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  accent,
}: {
  title: string;
  value: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
      <div
        className={`mb-4 inline-flex rounded-2xl bg-gradient-to-r ${accent} px-3 py-1 text-xs font-semibold text-white`}
      >
        {title}
      </div>
      <p className="text-2xl font-semibold text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function EmptyState({
  message,
  darkMode,
}: {
  message: string;
  darkMode: boolean;
}) {
  return (
    <div
      className={`mt-6 border border-dashed px-4 py-10 text-center text-sm ${
        darkMode
          ? "border-slate-700 bg-slate-800/60 text-slate-400"
          : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {message}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mt-6 border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
      {message}
    </div>
  );
}

function ActionButton({
  label,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  tone: "emerald" | "rose" | "amber" | "indigo";
  onClick: () => void;
  disabled?: boolean;
}) {
  const map = {
    emerald:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
    rose: "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-900/60",
    amber:
      "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60",
    indigo:
      "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${map[tone]} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      {label}
    </button>
  );
}

function ControlCard({
  title,
  value,
  description,
  accent,
}: {
  title: string;
  value: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
      <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>
        {title}
      </p>
      <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

async function safeError(res: Response) {
  try {
    const body = await res.json();
    return body.error || body.message || "Falha ao carregar dados.";
  } catch {
    return "Falha ao carregar dados.";
  }
}

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      width="20"
      height="20"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5L8.25 12l7.5-7.5"
      />
    </svg>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      width="20"
      height="20"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 4.5L15.75 12l-7.5 7.5"
      />
    </svg>
  );
}

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      width="20"
      height="20"
      {...props}
    >
      <circle cx="12" cy="12" r="3.5" />
      <path strokeLinecap="round" d="M12 3v2.5M12 18.5V21M4.5 12H3m18 0h-1.5M6.2 6.2l-1.7-1.7m14.2 14.2-1.7-1.7M6.2 17.8l-1.7 1.7m14.2-14.2 1.7-1.7" />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      width="20"
      height="20"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79z"
      />
    </svg>
  );
}

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      width="20"
      height="20"
      {...props}
    >
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function BrainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      width="20"
      height="20"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 3.5c-1.7 0-3 1.4-3 3v3.5c0 1.7 1.3 3 3 3v6.5M9.5 3.5c1.7 0 3 1.4 3 3v3.5c0 1.7-1.3 3-3 3M14.5 3.5c1.7 0 3 1.4 3 3v3.5c0 1.7-1.3 3-3 3v6.5M14.5 3.5c-1.7 0-3 1.4-3 3v3.5c0 1.7 1.3 3 3 3"
      />
    </svg>
  );
}

function ChartUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      width="20"
      height="20"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 19h16M6 16l3-4 3 3 4-6 2 2"
      />
    </svg>
  );
}

function ClipboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      width="20"
      height="20"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 4h8a2 2 0 0 1 2 2v14H6V6a2 2 0 0 1 2-2z"
      />
      <path d="M9 2h6v3H9z" />
    </svg>
  );
}

function RadarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      width="20"
      height="20"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 12l6-6" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CogIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      width="20"
      height="20"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.4 2.6a1.6 1.6 0 0 1 3.2 0l.2 1.2c.1.5.5.9 1 .9l1.2.2a1.6 1.6 0 0 1 .9 2.7l-.9.9a1 1 0 0 0 0 1.4l.9.9a1.6 1.6 0 0 1-.9 2.7l-1.2.2c-.5.1-.9.5-1 .9l-.2 1.2a1.6 1.6 0 0 1-3.2 0l-.2-1.2c-.1-.5-.5-.9-1-.9l-1.2-.2a1.6 1.6 0 0 1-.9-2.7l.9-.9a1 1 0 0 0 0-1.4l-.9-.9a1.6 1.6 0 0 1 .9-2.7l1.2-.2c.5-.1.9-.5 1-.9l.2-1.2z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
