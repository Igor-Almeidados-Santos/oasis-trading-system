# Guia dos Componentes

Este guia descreve responsabilidades, dependências e configurações de cada serviço do Oasis Trading System.

## Componentes de Dados

### Coinbase Connector (`components/coinbase-connector`)
- **Linguagem**: Rust.
- **Função**: Conexão WebSocket com a Coinbase, recebendo trades em tempo real.
- **Entrada/Saída**: Publica eventos JSON em Kafka (`market-data.trades.coinbase`).
- **Dependências**:
  - `librdkafka` (binding C) e `rdkafka` crate.
  - Variáveis: `COINBASE_WS_URL`, `KAFKA_BROKERS`, `CONNECTOR_METRICS_PORT`.
- **Operação**:
  ```bash
  cd components/coinbase-connector
  cargo run
  ```
- **Testes**: `cargo test` (usa WebSocket simulado).

### Data Normalizer (`components/data-normalizer`)
- **Linguagem**: Rust.
- **Função**: Normalizar campos (precisão, casing, símbolos) e republicar eventos.
- **Entrada/Saída**: Consome `market-data.trades.coinbase`, produz `market-data.trades.normalized`.
- **Dependências**:
  - `librdkafka`.
  - Variáveis: `KAFKA_BROKERS`, `GROUP_ID`, `CONNECTOR_METRICS_PORT`.
- **Operação**:
  ```bash
  cd components/data-normalizer
  cargo run
  ```
- **Testes**: `cargo test`.

## Componentes de Estratégia e Risco

### Strategy Framework (`components/strategy-framework`)
- **Linguagem**: Python 3.11 com Poetry.
- **Função**: Implementar estratégias e emitir sinais para o Risk Engine.
- **Entradas/Saídas**:
  - Kafka `market-data.trades.normalized`.
  - gRPC `risk_engine.RiskService`.
- **Dependências**:
  - Poetry para gestão de pacotes.
  - Variáveis: `KAFKA_BROKERS`, `KAFKA_TOPIC`, `STRATEGY_SYMBOL`, `RISK_ENGINE_GRPC_ADDR`.
- **Operação**:
  ```bash
  cd components/strategy-framework
  poetry install
  poetry run python src/run_framework.py
  ```
- **Testes**: `poetry run pytest`.
- **Utilitários**: `poetry run send-sample` para publicar mensagens de teste.

### Risk Engine (`components/risk-engine`)
- **Linguagem**: Rust.
- **Função**: Aplicar políticas de risco (limites de ordem, posição, exposição).
- **Entradas/Saídas**:
  - Recebe sinais via gRPC (`risk_engine` proto).
  - Opcional: integra Redis para persistência.
  - Envia requisições gRPC ao Order Manager.
- **Dependências**:
  - Variáveis: `RISK_ENGINE_GRPC_ADDR`, `ORDER_MANAGER_ADDR`, `RISK_USE_REDIS`, `REDIS_URL`.
- **Operação**:
  ```bash
  cd components/risk-engine
  cargo run
  ```
- **Testes**: `cargo test`, `cargo clippy`, `cargo fmt`.

### Order Manager (`components/order-manager`)
- **Linguagem**: Go (1.21+).
- **Função**: Encaminhar ordens aprovadas para a Coinbase via REST.
- **Entradas/Saídas**:
  - Recebe gRPC do Risk Engine.
  - Chama Coinbase REST com autenticação.
- **Dependências**:
  - Variáveis: `ORDER_MANAGER_GRPC_ADDR`, `COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_API_PASSPHRASE`.
- **Operação**:
  ```bash
  cd components/order-manager
  go run .
  ```
- **Testes**: `go test ./...`.

## Ferramentas Compartilhadas
- **Contratos Protobuf**: `api/proto/` (use `scripts/gen-proto.sh` ou `.ps1`).
- **Infraestrutura local**:
  - `docker-compose.yml` para Kafka, Zookeeper, Prometheus, Grafana.
  - Scripts de automação em `scripts/`.
- **Monitoramento**:
  - Métricas expostas nas portas `9091-9094`.
  - Configure dashboards no Grafana (`docs/operations/observability.md`).

## Convenções de Configuração
- Arquivo `.env.example` lista variáveis para os serviços.
- Use `RISK_USE_REDIS=0` para executar sem Redis.
- Prefira tópicos dedicados (`market-data.trades.normalized`) para consumidores derivados.
