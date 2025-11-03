export interface Position {
  symbol: string;
  quantity: string;
  average_price: string;
  mode: string;
}

export interface PortfolioCash {
  [mode: string]: string | undefined;
}

export interface PortfolioSnapshot {
  positions: Position[];
  cash: PortfolioCash;
  cash_history?: CashHistoryEntry[];
}

export interface CashHistoryEntry {
  mode: string;
  balance: string;
  delta?: string;
  symbol?: string;
  side?: string;
  client_order_id?: string;
  timestamp: string;
}

export interface Operation {
  id: number;
  client_order_id?: string;
  symbol: string;
  side: string;
  order_type: string;
  status: string;
  price: string;
  quantity: string;
  executed_at?: string;
  fee?: string;
  mode: string;
}

export interface StrategyState {
  strategy_id: string;
  enabled: boolean;
  mode: "REAL" | "PAPER";
  symbols?: string[];
  usd_balance?: string;
  take_profit_bps?: number;
  stop_loss_bps?: number;
  fast_window?: number;
  slow_window?: number;
  min_signal_bps?: number;
  position_size_pct?: number;
  cooldown_seconds?: number;
  batch_size?: number;
  batch_interval_minutes?: number;
  fields?: StrategyField[];
}

export interface StrategyConfigUpdatePayload {
  enabled?: boolean;
  mode?: "REAL" | "PAPER";
  symbols?: string[];
  usd_balance?: string;
  take_profit_bps?: number;
  stop_loss_bps?: number;
  fast_window?: number;
  slow_window?: number;
  min_signal_bps?: number;
  position_size_pct?: number;
  cooldown_seconds?: number;
  batch_size?: number;
  batch_interval_minutes?: number;
}

export interface ControlState {
  bot_status: string;
  strategies: StrategyState[];
}

export interface StrategyField {
  key: string;
  label: string;
  type: "boolean" | "mode" | "symbol-list" | "currency" | "integer" | "number" | "percent";
  helper?: string;
  options?: string[];
}
