"use client";

import { useCallback } from "react";
import { SimulationsSection } from "../../../components/dashboard/SimulationsSection";
import { fetchControlState, setStrategyConfig } from "../../../lib/api";
import type { StrategyConfigUpdatePayload, StrategyState } from "../../../lib/types";

const ADVANCED_STRATEGY_ID = "advanced-alpha-001";

const createDefaultStrategy = (): StrategyState => ({
  strategy_id: ADVANCED_STRATEGY_ID,
  enabled: true,
  mode: "PAPER",
  symbols: ["BTC-USD", "ETH-USD"],
  usd_balance: "25000",
  take_profit_bps: 120,
  stop_loss_bps: 60,
  fast_window: 5,
  slow_window: 21,
  min_signal_bps: 20,
  position_size_pct: 0.15,
});

type SimulationActionResult = {
  success: boolean;
  strategy?: StrategyState;
  errorMessage?: string;
};

export default function SimulationsPage() {
  const handleSubmit = useCallback(
    async (payload: StrategyConfigUpdatePayload): Promise<SimulationActionResult> => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!token) {
        return { success: false, errorMessage: "Sessão expirada. Faça login novamente." };
      }
      try {
        const response = await setStrategyConfig(token, ADVANCED_STRATEGY_ID, payload);
        const strategy = response.config ?? createDefaultStrategy();
        return { success: true, strategy };
      } catch (err) {
        return {
          success: false,
          errorMessage:
            err instanceof Error ? err.message : "Falha ao atualizar configurações de simulação.",
        };
      }
    },
    []
  );

  const handleRefresh = useCallback(async (): Promise<SimulationActionResult> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) {
      return { success: false, errorMessage: "Sessão expirada. Faça login novamente." };
    }
    try {
      const control = await fetchControlState(token);
      const found = control.strategies?.find((item) => item.strategy_id === ADVANCED_STRATEGY_ID);
      const strategy = found ?? createDefaultStrategy();
      return { success: true, strategy };
    } catch (err) {
      return {
        success: false,
        errorMessage:
          err instanceof Error ? err.message : "Falha ao sincronizar configurações de simulação.",
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl">
        <SimulationsSection
          standalone
          onSubmit={handleSubmit}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
}
