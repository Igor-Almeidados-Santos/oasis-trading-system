-- Trading Control Center operational tables

BEGIN;

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    client_order_id TEXT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type TEXT NOT NULL,
    quantity NUMERIC(32, 16) NOT NULL,
    price NUMERIC(32, 16),
    status TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'REAL' CHECK (mode IN ('REAL', 'PAPER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fills (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity NUMERIC(32, 16) NOT NULL,
    price NUMERIC(32, 16),
    fee NUMERIC(32, 16),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_symbol_created_at
    ON orders(symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fills_symbol_executed_at
    ON fills(symbol, executed_at DESC);

COMMIT;
