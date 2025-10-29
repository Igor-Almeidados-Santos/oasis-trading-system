# Oasis Trading System (OTS)

Plataforma modular para ingestão de dados de mercado, geração de sinais quantitativos, validação de risco e execução de ordens em corretoras cripto — agora acompanhada por um Control Center web para monitorização e controlo em tempo real.

```
Coinbase WS --> Coinbase Connector (Rust) --Kafka--> Data Normalizer (Rust) --Kafka--> Strategy Framework (Python)
                                                                                     |
                                                                                     v
                                                                               Risk Engine (Rust) --gRPC--> Order Manager (Go) --> Coinbase REST

Control Center Web (Next.js) --> Control Center API (Go) --Redis--> Portfolio cache
                                                  \                   ^
                                                   \--PostgreSQL--> Operations feed
                                                     \
                                                      -->Kafka control.commands --> Strategy Framework (Python)
```

---

## Destaques
- **Pipeline completo de trading**: do WebSocket de mercado à execução de ordens validadas.
- **Control Center**: painel Next.js com endpoints protegidos por JWT para visualizar posições, histórico de ordens e governar bots/estratégias.
- **Monitorização Real vs. Paper**: o dashboard principal exibe apenas métricas de produção (modo REAL), enquanto a nova página de **Simulações** centraliza o ambiente paper com filtros próprios, histórico dedicado e modal para configurar estratégias simuladas.
- **Arquitetura desacoplada**: comunicação assíncrona via Kafka e contratos Protobuf versionados.
- **Observabilidade pronta**: métricas Prometheus e integrações com Grafana.

---

## Sumário
1. [Stack e Componentes](#stack-e-componentes)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração de Ambiente](#configuração-de-ambiente)
4. [Quickstart: pipeline + control center](#quickstart-pipeline--control-center)
5. [Control Center (API e Dashboard)](#control-center-api-e-dashboard)
6. [Simulações e Ambiente Paper](#simulações-e-ambiente-paper)
7. [Modos de Operação](#modos-de-operação)
8. [Verificações e Testes](#verificações-e-testes)
9. [Documentação Complementar](#documentação-complementar)

---

## Stack e Componentes

| Camada             | Tecnologia / Responsabilidade                                                                      |
|--------------------|----------------------------------------------------------------------------------------------------|
| Ingestão           | **Coinbase Connector (Rust)** — WebSocket → Kafka (`market-data.trades.coinbase`)                 |
| Normalização       | **Data Normalizer (Rust)** — saneia e publica `market-data.trades.normalized`                     |
| Estratégias        | **Strategy Framework (Python)** — consome mercado, recebe comandos (`control.commands`) e gera sinais |
| Validação de risco | **Risk Engine (Rust)** — políticas de risco e roteamento de ordens                                 |
| Execução           | **Order Manager (Go)** — gRPC → REST Coinbase                                                      |
| Control Center API | **Go** — Redis (portfólio), PostgreSQL (operações) e publicação de comandos Kafka                 |
| Dashboard Web      | **Next.js 16 / TypeScript** — interface operacional (login, monitorização, controlo)             |
| Observabilidade    | **Prometheus + Grafana**                                                                           |

---

## Pré-requisitos
- **Ferramentas gerais**: Git, Docker, Docker Compose, `protoc` 3.20+, `cmake`, `pkg-config`, Redis (local ou Docker).
- **Linguagens/SDKs**: Rust (stable), Python 3.11 + Poetry, Go 1.21+, Node 18+.
- **Kafka + Zookeeper**: fornecidos pelo `docker-compose.yml`.

> Consulte `docs/development-environment.md` para comandos detalhados de instalação por sistema operativo.

---

## Configuração de Ambiente
1. Clone e entre no repositório:
   ```bash
   git clone git@github.com:seu-org/oasis-trading-system-OTS.git
   cd oasis-trading-system-OTS
   ```

2. Crie seu arquivo `.env`:
   ```bash
   cp .env.example .env
   ```
   Preencha variáveis importantes:
   - **Kafka / Dados**: `KAFKA_BROKERS`, `MARKET_DATA_TOPIC`, `CONTROL_COMMAND_TOPIC`.
   - **Risk/Order**: `RISK_ENGINE_GRPC_ADDR`, `ORDER_MANAGER_GRPC_ADDR`, `ORDER_MANAGER_MODE`.
   - **Control Center**:
     - `CONTROL_CENTER_API_PORT`, `CONTROL_CENTER_API_USER`, `CONTROL_CENTER_API_PASSWORD`, `JWT_SECRET`.
     - `REDIS_ADDR` (portfólio) e `DATABASE_URL` (operações).
     - `NEXT_PUBLIC_API_BASE_URL` para o frontend apontar ao backend.
   - **Credenciais Coinbase** (modo real): `COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_API_PASSPHRASE`.

3. Gere contratos Protobuf sempre que modificar `api/proto/`:
   ```bash
   ./scripts/gen-proto.sh     # Linux/macOS
   ./scripts/gen-proto.ps1    # Windows PowerShell
   ```

---

## Quickstart: pipeline + control center

### 1. Infraestrutura base
```bash
docker compose up -d zookeeper kafka redis postgres prometheus grafana
```
- Postgres: exposto em `localhost:5432` (utilize `DATABASE_URL` compatível).
- Redis: exposto em `localhost:6379`.

### 2. Componentes principais
Abra terminais separados e execute:

```bash
# Order Manager (Go)
cd components/order-manager
go run .
```

```bash
# Risk Engine (Rust)
cd components/risk-engine
cargo run
```

```bash
# Data Normalizer (Rust)
cd components/data-normalizer
cargo run
```

```bash
# Strategy Framework (Python)
cd components/strategy-framework
poetry install
poetry run python src/consumer.py
```

```bash
# Coinbase Connector (Rust)
cd components/coinbase-connector
cargo run
```

### 3. Control Center
```bash
# API Backend (Go)
cd control-center/api-backend
go run .
```
- Autenticação JWT (`POST /api/v1/auth/login`) com credenciais definidas no `.env`.
- Integra Redis e PostgreSQL; se a porta estiver ocupada, seleciona automaticamente outra e registra nos logs.

```bash
# Frontend (Next.js)
cd control-center/frontend
npm install
npm run dev
```
- Aceda http://localhost:3000.
- Configure `NEXT_PUBLIC_API_BASE_URL` (por exemplo, `http://localhost:8080`) antes de `npm run dev`.
- O dashboard inicial mostra apenas métricas do modo REAL (posições, operações, estado do bot). Utilize a navegação lateral para abrir **Simulações** quando quiser trabalhar com o ambiente paper.

### Fluxo de dados completo
1. Coinbase Connector → Kafka (`market-data.trades.coinbase`).
2. Data Normalizer → Kafka (`market-data.trades.normalized`).
3. Strategy Framework → Risk Engine → Order Manager.
4. Redis/PostgreSQL recebem atualizações (positions/operations).
5. Control Center API expõe portfólio/operacional e publica comandos (`control.commands`).
6. Dashboard Web autentica, lê dados e envia ações (pausar bot, alternar modo, ativar/desativar estratégias).

---

## Control Center (API e Dashboard)

### Endpoints principais (todos sob `/api/v1`, exceto login)
| Método | Rota                                   | Descrição                                                       |
|--------|----------------------------------------|-----------------------------------------------------------------|
| POST   | `/api/v1/auth/login`                   | Retorna JWT (payload: `{"username","password"}`)                |
| GET    | `/api/v1/portfolio`                    | Posições agregadas do Redis                                     |
| GET    | `/api/v1/operations?mode=REAL&limit=50`| Ordens/Fills recentes a partir do PostgreSQL                    |
| POST   | `/api/v1/bot/status`                   | Envia comando `SET_BOT_STATUS` (payload: `{status: START\|STOP}`) |
| POST   | `/api/v1/strategies/:id/toggle`        | Envia `SET_STRATEGY_CONFIG` (payload: `{enabled, mode}`)        |

> Autentique cada requisição com `Authorization: Bearer <token>`.

### Fluxo sugerido de validação
1. `POST /auth/login` → receber token.
2. `GET /portfolio` → validar leitura de posições.
3. `GET /operations` → confirmar integração com PostgreSQL.
4. `POST /bot/status` (`STOP`) → Strategy Framework deve parar de processar trades (ver logs).
5. `POST /bot/status` (`START`) → Strategy Framework retoma consumo.
6. `POST /strategies/:id/toggle` → ajuste de `enabled`/`mode` reflete nos logs da estratégia.

### Dashboard Web
- Login com as credenciais do `.env`.
- Widgets de portfólio e operações consumem os mesmos endpoints.
- Botões de controlo disparam as rotas acima (feedback visual/fonte de verdade partilhada com o backend).
- O dashboard é pensado como visão de produção: exibe apenas dados `mode=REAL`. Quando precisar validar paper trading, mude para a aba **Simulações** (ver abaixo).

---

## Simulações e Ambiente Paper

A página “Simulações” (acesso via sidebar do Control Center ou diretamente em `/simulations`) concentra tudo o que pertence ao modo paper:

- **Resumo paper**: saldo disponível, número de posições simuladas, volume de operações recentes e taxa de fills.
- **Listagens dedicadas**: posições e operações paper são filtradas automaticamente e podem ser revisadas sem misturar dados reais.
- **Histórico paper**: tabela paginada com até 20 registos recentes (modo PAPER). Utilize a API (`/api/v1/operations?mode=PAPER`) para consultas completas.
- **Configuração no modal**: um ícone de engrenagem abre um pop-up persistente para ajustar a estratégia simulada (capital, símbolos, janelas, take profit, etc.). As alterações são enviadas via `SET_STRATEGY_CONFIG`.

### Estratégia de exemplo (`advanced-alpha-001`)
- Ativada por padrão em modo PAPER e exposta na UI.
- Campos suportados no modal correspondem às chaves do `StrategyConfigUpdatePayload` (ex.: `usd_balance`, `symbols`, `fast_window`).
- O Control Center sincroniza automaticamente o estado atual antes de abrir o modal; caso prefira script, use `POST /api/v1/strategies/advanced-alpha-001/toggle`.

### Reproduzindo dados paper
1. Replique o saldo inicial e símbolos no modal de Simulações.
2. Envie trades artificiais para o Kafka:
   ```bash
   cd components/strategy-framework
   poetry run python src/tools/send_sample.py \
     --topic market-data.trades.coinbase \
     --symbol BTC-USD \
     --price 68000 \
     --qty 0.01 \
     --side BUY \
     --count 50 \
     --interval 0.5
   ```
   > Adapte `symbol`, `price` e `side` conforme a estratégia (é comum alternar BUY/SELL ou usar múltiplos símbolos).
3. Verifique os logs do Strategy Framework: sinais paper aprovados devem resultar em ordens simuladas.
4. Abra a aba **Simulações** para confirmar posições/ordens no modo PAPER. A API `/api/v1/operations?mode=PAPER&limit=10` deve retornar os mesmos registos.

### Reset do ambiente paper
- **Limpar ordens**: `TRUNCATE TABLE orders;` no PostgreSQL (ou utilize scripts específicos).
- **Limpar posições**: `FLUSHDB` no Redis ou elimine chaves com prefixos `position:paper:*`.
- Atualize a página de Simulações para garantir que os contadores foram zerados.

---

## Modos de Operação

| Modo        | Configuração-chave                                                                                                 | Observações                                                                                   |
|-------------|---------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| **Paper**   | `ORDER_MANAGER_MODE=paper`, não definir credenciais Coinbase. Opcional: gerar market data via `poetry run send-sample`. | Control Center continua operacional; ordens não são enviadas para a exchange.                |
| **Real**    | Definir `COINBASE_API_*`, `ORDER_MANAGER_MODE=real`, `ORDER_MANAGER_COINBASE_VARIANT` conforme API vigente.         | Rever limites do Risk Engine e ambiente de produção; proteger `.env` com gestor de segredos. |

> O bot inicia em modo PAPER por padrão. Alterne entre REAL/PAPER no painel principal ou via `POST /api/v1/strategies/:id/toggle`.

---

## Verificações e Testes
- **Coinbase Connector**: `cargo fmt --check && cargo clippy -- -D warnings && cargo test`.
- **Data Normalizer**: `cargo test`.
- **Strategy Framework**: `poetry run pytest`.
- **Risk Engine**: `cargo test`.
- **Order Manager**: `go test ./...`.
- **Control Center API**:
  ```bash
  cd control-center/api-backend
  go test ./...
  curl -s -X POST http://localhost:8080/api/v1/auth/login -d '{"username":"admin","password":"changeme"}' \
       -H 'Content-Type: application/json'
  ```
- **Kafka**: monitorize lag com `kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group strategy-framework-group`.
- **Métricas**: cada serviço expõe `/metrics` (ports definidas no `.env`), prontas para Prometheus/Grafana.

---

## Documentação Complementar
- **Arquitetura Detalhada**: `docs/architecture-overview.md`
- **Guia por Componente**: `docs/components.md`
- **Ambiente de Desenvolvimento**: `docs/development-environment.md`
- **Operações / Observabilidade**: `docs/operations/`
- **Runbooks**: `docs/runbooks/`

Sinta-se à vontade para adaptar as estratégias, integrar novas corretoras ou estender o Control Center. Pull requests e sugestões são bem-vindos.
