-- ==================== scripts/sql/init.sql ====================
-- Oasis Trading System Database Initialization Script

-- Create database if not exists
SELECT 'CREATE DATABASE oasis_trading'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'oasis_trading')\gexec

-- Connect to the database
\c oasis_trading;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS market_data;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
SET search_path TO trading, market_data, analytics, audit, public;

-- ==========================================
-- Core Tables
-- ==========================================

-- Users table
CREATE TABLE IF NOT EXISTS trading.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    api_key_hash VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON trading.users(email);
CREATE INDEX idx_users_api_key ON trading.users(api_key_hash);

-- Exchanges table
CREATE TABLE IF NOT EXISTS trading.exchanges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_testnet BOOLEAN DEFAULT false,
    api_endpoint VARCHAR(255),
    ws_endpoint VARCHAR(255),
    rate_limits JSONB DEFAULT '{}'::jsonb,
    supported_features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO trading.exchanges (name, display_name, api_endpoint, ws_endpoint) VALUES
    ('binance', 'Binance', 'https://api.binance.com', 'wss://stream.binance.com:9443'),
    ('coinbase', 'Coinbase Pro', 'https://api.pro.coinbase.com', 'wss://ws-feed.pro.coinbase.com'),
    ('kraken', 'Kraken', 'https://api.kraken.com', 'wss://ws.kraken.com'),
    ('okx', 'OKX', 'https://www.okx.com', 'wss://ws.okx.com:8443'),
    ('bybit', 'Bybit', 'https://api.bybit.com', 'wss://stream.bybit.com')
ON CONFLICT (name) DO NOTHING;

-- Trading pairs table
CREATE TABLE IF NOT EXISTS trading.trading_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange_id UUID REFERENCES trading.exchanges(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    base_asset VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    min_quantity DECIMAL(20, 8),
    max_quantity DECIMAL(20, 8),
    step_size DECIMAL(20, 8),
    min_notional DECIMAL(20, 8),
    tick_size DECIMAL(20, 8),
    maker_fee DECIMAL(10, 6),
    taker_fee DECIMAL(10, 6),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exchange_id, symbol)
);

CREATE INDEX idx_trading_pairs_symbol ON trading.trading_pairs(symbol);
CREATE INDEX idx_trading_pairs_exchange ON trading.trading_pairs(exchange_id);

-- Strategies table
CREATE TABLE IF NOT EXISTS trading.strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'technical', 'ml_based', 'statistical', 'hybrid'
    version VARCHAR(20) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT false,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_parameters JSONB DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES trading.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategies_type ON trading.strategies(type);
CREATE INDEX idx_strategies_active ON trading.strategies(is_active);

-- Positions table
CREATE TABLE IF NOT EXISTS trading.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES trading.strategies(id),
    exchange_id UUID REFERENCES trading.exchanges(id),
    trading_pair_id UUID REFERENCES trading.trading_pairs(id),
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    entry_price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    exit_price DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed', 'pending'
    pnl DECIMAL(20, 8),
    pnl_percentage DECIMAL(10, 4),
    fees_paid DECIMAL(20, 8) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_positions_status ON trading.positions(status);
CREATE INDEX idx_positions_strategy ON trading.positions(strategy_id);
CREATE INDEX idx_positions_opened_at ON trading.positions(opened_at DESC);

-- Orders table
CREATE TABLE IF NOT EXISTS trading.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES trading.positions(id),
    exchange_id UUID REFERENCES trading.exchanges(id),
    exchange_order_id VARCHAR(100),
    trading_pair_id UUID REFERENCES trading.trading_pairs(id),
    type VARCHAR(20) NOT NULL, -- 'market', 'limit', 'stop_loss', 'take_profit'
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    price DECIMAL(20, 8),
    quantity DECIMAL(20, 8) NOT NULL,
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'open', 'filled', 'cancelled', 'rejected'
    time_in_force VARCHAR(10) DEFAULT 'GTC', -- 'GTC', 'IOC', 'FOK'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_orders_status ON trading.orders(status);
CREATE INDEX idx_orders_exchange_order_id ON trading.orders(exchange_order_id);
CREATE INDEX idx_orders_created_at ON trading.orders(created_at DESC);

-- ==========================================
-- Market Data Tables (Hypertables)
-- ==========================================

-- OHLCV data table
CREATE TABLE IF NOT EXISTS market_data.candles (
    time TIMESTAMPTZ NOT NULL,
    exchange_id UUID NOT NULL,
    trading_pair_id UUID NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    quote_volume DECIMAL(20, 8),
    trades_count INTEGER,
    FOREIGN KEY (exchange_id) REFERENCES trading.exchanges(id),
    FOREIGN KEY (trading_pair_id) REFERENCES trading.trading_pairs(id)
);

-- Convert to hypertable
SELECT create_hypertable('market_data.candles', 'time', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX idx_candles_exchange_pair_time ON market_data.candles(exchange_id, trading_pair_id, time DESC);
CREATE INDEX idx_candles_timeframe ON market_data.candles(timeframe, time DESC);

-- Order book snapshots
CREATE TABLE IF NOT EXISTS market_data.order_book_snapshots (
    time TIMESTAMPTZ NOT NULL,
    exchange_id UUID NOT NULL,
    trading_pair_id UUID NOT NULL,
    bids JSONB NOT NULL, -- Array of [price, quantity]
    asks JSONB NOT NULL, -- Array of [price, quantity]
    spread DECIMAL(20, 8),
    mid_price DECIMAL(20, 8)
);

SELECT create_hypertable('market_data.order_book_snapshots', 'time', if_not_exists => TRUE);

-- Trades table
CREATE TABLE IF NOT EXISTS market_data.trades (
    time TIMESTAMPTZ NOT NULL,
    exchange_id UUID NOT NULL,
    trading_pair_id UUID NOT NULL,
    trade_id VARCHAR(100),
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    side VARCHAR(10) NOT NULL,
    is_maker BOOLEAN
);

SELECT create_hypertable('market_data.trades', 'time', if_not_exists => TRUE);

-- ==========================================
-- Analytics Tables
-- ==========================================

-- Strategy performance
CREATE TABLE IF NOT EXISTS analytics.strategy_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES trading.strategies(id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    total_pnl DECIMAL(20, 8) DEFAULT 0,
    total_fees DECIMAL(20, 8) DEFAULT 0,
    max_drawdown DECIMAL(10, 4),
    sharpe_ratio DECIMAL(10, 4),
    win_rate DECIMAL(10, 4),
    profit_factor DECIMAL(10, 4),
    avg_win DECIMAL(20, 8),
    avg_loss DECIMAL(20, 8),
    largest_win DECIMAL(20, 8),
    largest_loss DECIMAL(20, 8),
    metadata JSONB DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategy_performance_strategy ON analytics.strategy_performance(strategy_id);
CREATE INDEX idx_strategy_performance_period ON analytics.strategy_performance(period_start, period_end);

-- Risk metrics
CREATE TABLE IF NOT EXISTS analytics.risk_metrics (
    time TIMESTAMPTZ NOT NULL,
    portfolio_value DECIMAL(20, 8),
    total_exposure DECIMAL(20, 8),
    var_95 DECIMAL(20, 8), -- Value at Risk 95%
    var_99 DECIMAL(20, 8), -- Value at Risk 99%
    current_drawdown DECIMAL(10, 4),
    leverage_ratio DECIMAL(10, 4),
    concentration_risk JSONB, -- Per asset concentration
    correlation_matrix JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

SELECT create_hypertable('analytics.risk_metrics', 'time', if_not_exists => TRUE);

-- ==========================================
-- Audit Tables
-- ==========================================

-- Audit log
CREATE TABLE IF NOT EXISTS audit.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES trading.users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user ON audit.activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON audit.activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action ON audit.activity_log(action);

-- ==========================================
-- Functions and Triggers
-- ==========================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON trading.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchanges_updated_at BEFORE UPDATE ON trading.exchanges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON trading.strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON trading.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate PnL function
CREATE OR REPLACE FUNCTION calculate_position_pnl()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exit_price IS NOT NULL THEN
        IF NEW.side = 'buy' THEN
            NEW.pnl = (NEW.exit_price - NEW.entry_price) * NEW.quantity - NEW.fees_paid;
        ELSE
            NEW.pnl = (NEW.entry_price - NEW.exit_price) * NEW.quantity - NEW.fees_paid;
        END IF;
        NEW.pnl_percentage = (NEW.pnl / (NEW.entry_price * NEW.quantity)) * 100;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_pnl_trigger BEFORE UPDATE ON trading.positions
    FOR EACH ROW EXECUTE FUNCTION calculate_position_pnl();

-- ==========================================
-- Continuous Aggregates (TimescaleDB)
-- ==========================================

-- 1-hour candles aggregate
CREATE MATERIALIZED VIEW market_data.candles_1h
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS bucket,
    exchange_id,
    trading_pair_id,
    FIRST(open, time) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, time) AS close,
    SUM(volume) AS volume,
    SUM(quote_volume) AS quote_volume,
    SUM(trades_count) AS trades_count
FROM market_data.candles
WHERE timeframe = '1m'
GROUP BY bucket, exchange_id, trading_pair_id
WITH NO DATA;

-- Add retention policy (keep 2 years of 1-minute data)
SELECT add_retention_policy('market_data.candles', INTERVAL '2 years');
SELECT add_retention_policy('market_data.trades', INTERVAL '6 months');
SELECT add_retention_policy('market_data.order_book_snapshots', INTERVAL '1 month');

-- ==========================================
-- Permissions
-- ==========================================

-- Create roles
CREATE ROLE oasis_read;
CREATE ROLE oasis_write;
CREATE ROLE oasis_admin;

-- Grant permissions
GRANT USAGE ON SCHEMA trading, market_data, analytics, audit TO oasis_read, oasis_write, oasis_admin;

GRANT SELECT ON ALL TABLES IN SCHEMA trading, market_data, analytics, audit TO oasis_read;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA trading, market_data, analytics TO oasis_write;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA trading, market_data, analytics, audit TO oasis_admin;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA trading, market_data, analytics, audit TO oasis_write, oasis_admin;

-- Grant role to user
GRANT oasis_admin TO oasis;

-- ==========================================
-- Initial Data
-- ==========================================

-- Insert default admin user (password: admin123 - change immediately!)
INSERT INTO trading.users (email, username, password_hash, is_superuser)
VALUES (
    'admin@oasis-trading.com',
    'admin',
    crypt('admin123', gen_salt('bf')),
    true
) ON CONFLICT (email) DO NOTHING;

-- ==========================================
-- Database Info
-- ==========================================

-- Show database configuration
SELECT version();
SELECT current_database();
SELECT current_schema();

-- Show TimescaleDB version
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';

-- List all hypertables
SELECT * FROM timescaledb_information.hypertables;