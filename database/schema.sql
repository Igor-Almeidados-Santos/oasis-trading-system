-- Cria a tabela para armazenar todas as ordens enviadas
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    client_order_id VARCHAR(255) UNIQUE NOT NULL,
    exchange_order_id VARCHAR(255),
    product_id VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    quantity DECIMAL(20, 10) NOT NULL,
    price DECIMAL(20, 10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela para armazenar o estado da estratégia
CREATE TABLE IF NOT EXISTS strategy_state (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(20) UNIQUE NOT NULL,
    grid_state JSONB NOT NULL, -- Armazena o dicionário da grade como um JSON
    last_price DECIMAL(20, 10),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela para armazenar as execuções (fills) de cada ordem
CREATE TABLE IF NOT EXISTS fills (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    exchange_trade_id VARCHAR(255) UNIQUE NOT NULL,
    price DECIMAL(20, 10) NOT NULL,
    quantity DECIMAL(20, 10) NOT NULL,
    commission DECIMAL(20, 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);