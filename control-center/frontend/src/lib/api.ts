import type {
  ControlState,
  Operation,
  PortfolioSnapshot,
  StrategyConfigUpdatePayload,
  StrategyState,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081";

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "Erro ao contactar serviço";
    try {
      const body = await res.json();
      detail = body.error || body.message || detail;
    } catch {
      detail = res.statusText || detail;
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function normalizePortfolioSnapshot(data: unknown): PortfolioSnapshot {
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "positions" in data
  ) {
    const snapshot = data as {
      positions?: unknown;
      cash?: Record<string, string>;
    };
    const positions = Array.isArray(snapshot.positions)
      ? (snapshot.positions as PortfolioSnapshot["positions"])
      : [];
    const cash =
      snapshot.cash && typeof snapshot.cash === "object"
        ? snapshot.cash
        : {};
    return { positions, cash };
  }

  if (Array.isArray(data)) {
    return { positions: data, cash: {} };
  }

  return { positions: [], cash: {} };
}

export async function fetchPortfolio(token: string) {
  const data = await request<unknown>("/api/v1/portfolio", token);
  return normalizePortfolioSnapshot(data);
}

export async function fetchOperations(
  token: string,
  options: { limit?: number; mode?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.mode) params.set("mode", options.mode);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<Operation[]>(
    `/api/v1/operations${suffix}`,
    token
  );
}

export async function fetchControlState(token: string) {
  return request<ControlState>("/api/v1/control/state", token);
}

export async function setStrategyConfig(
  token: string,
  strategyId: string,
  payload: StrategyConfigUpdatePayload
) {
  return request<{ message: string; config: StrategyState }>(
    `/api/v1/strategies/${strategyId}/toggle`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function setBotStatus(
  token: string,
  status: "START" | "STOP"
) {
  return request<{ message: string }>("/api/v1/bot/status", token, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
