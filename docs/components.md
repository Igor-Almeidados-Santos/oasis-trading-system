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
- **Função**: Implementar estratégias, receber comandos operacionais e emitir sinais para o Risk Engine.
- **Entradas/Saídas**:
  - Kafka `market-data.trades.coinbase` ou `market-data.trades.normalized` (configurável).
  - Kafka `control.commands` para controle de bot/estratégias.
  - gRPC `risk_engine.RiskService`.
- **Dependências**:
  - Poetry para gestão de pacotes.
  - Variáveis: `KAFKA_BROKERS`, `MARKET_DATA_TOPIC`, `CONTROL_COMMAND_TOPIC`, `STRATEGY_CONSUMER_GROUP`, `SYMBOL`, `RISK_ENGINE_GRPC_ADDR`.
- **Operação**:
  ```bash
  cd components/strategy-framework
  poetry install
  poetry run python src/run_framework.py
  ```
- **Testes**: `poetry run pytest`.
- **Utilitários**: `poetry run send-sample` para publicar mensagens de teste.
- **Funcionalidades recentes**:
  - Estratégias possuem estado (`enabled`, `mode`) ajustável via comandos Kafka.
  - Consumidor paralelo processa comandos `SET_BOT_STATUS` e `SET_STRATEGY_CONFIG` publicados pelo Control Center.

### Control Center API (`control-center/api-backend`)
- **Linguagem**: Go 1.21+.
- **Função**: Consolida posições (Redis), operações (PostgreSQL) e disponibiliza endpoints REST/JSON com autenticação JWT.
- **Entradas/Saídas**:
  - Redis (`REDIS_ADDR`) para cache de portfólio.
  - PostgreSQL (`DATABASE_URL`) para ordens e fills.
  - Kafka (`control.commands`) como produtor de comandos operacionais.
- **Dependências**:
  - Variáveis: `CONTROL_CENTER_API_PORT`, `CONTROL_CENTER_API_USER`, `CONTROL_CENTER_API_PASSWORD`, `JWT_SECRET`, `REDIS_ADDR`, `DATABASE_URL`, `KAFKA_BROKERS`.
- **Endpoints**:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/portfolio`
  - `GET /api/v1/operations`
  - `POST /api/v1/bot/status`
  - `POST /api/v1/strategies/:strategy_id/toggle`
- **Operação**:
  ```bash
  cd control-center/api-backend
  go run .
  ```
  > Se a porta desejada estiver ocupada, o serviço seleciona automaticamente uma porta livre e exibe nos logs.

### Control Center Frontend (`control-center/frontend`)
- **Linguagem**: TypeScript/React (Next.js 14).
- **Função**: Dashboard operacional (login, portfólio, operações históricas, bot/estratégias).
- **Dependências**:
  - `node` 18+, `npm` ou `pnpm`.
  - Variáveis: `NEXT_PUBLIC_API_BASE_URL` apontando para o backend.
- **Operação**:
  ```bash
  cd control-center/frontend
  npm install
  npm run dev
  ```
- **Build**: `npm run build && npm run start`.

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
- Prefira tópicos dedicados (`market-data.trades.normalized`, `control.commands`) para consumidores derivados e comandos operacionais.
