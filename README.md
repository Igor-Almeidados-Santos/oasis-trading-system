# Oasis Trading System (OTS)

> Plataforma modular para ingestão de dados de mercado, geração de sinais quantitativos, validação de risco e execução de ordens em corretoras cripto — acompanhada por um Control Center web para monitorização e governação em tempo real.

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stack](https://img.shields.io/badge/stack-Rust%20|%20Go%20|%20Python%20|%20Next.js-593d88) ![Kafka](https://img.shields.io/badge/messaging-Kafka-orange) ![Observability](https://img.shields.io/badge/observability-Prometheus%20%2B%20Grafana-306998)

---

## 📥 Downloads e Links Rápidos
| Recurso | Link |
|--------|------|
| Código (git) | `git clone https://github.com/Igor-Almeidados-Santos/oasis-trading-system-OTS.git` |
| Download ZIP (main) | [Clique aqui](https://github.com/Igor-Almeidados-Santos/oasis-trading-system-OTS/archive/refs/heads/main.zip) |
| Releases/Binários | [github.com/Igor-Almeidados-Santos/oasis-trading-system-OTS/releases](https://github.com/Igor-Almeidados-Santos/oasis-trading-system-OTS/releases) |
| Documentação técnica | [`docs/`](docs/) |
| Docker Compose base | [`docker-compose.yml`](docker-compose.yml) |
| Variáveis modelo | [`.env.example`](.env.example) |

---

## Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura em Camadas](#arquitetura-em-camadas)
3. [Diagrama de Fluxo](#diagrama-de-fluxo)
4. [Pré-requisitos por Sistema](#pré-requisitos-por-sistema)
5. [Configuração Rápida](#configuração-rápida)
6. [Variáveis de Ambiente Essenciais](#variáveis-de-ambiente-essenciais)
7. [Execução dos Componentes](#execução-dos-componentes)
8. [Control Center (API + Dashboard)](#control-center-api--dashboard)
9. [Simulações e Ambiente Paper](#simulações-e-ambiente-paper)
10. [Modos de Operação](#modos-de-operação)
11. [Observabilidade e Operações](#observabilidade-e-operações)
12. [Verificações e Testes](#verificações-e-testes)
13. [Documentação Complementar](#documentação-complementar)

---

## Visão Geral
- **Pipeline ponta a ponta**: do WebSocket da Coinbase até a execução validada e persistida em Redis/PostgreSQL.
- **Governança centralizada**: Control Center (Next.js + Go) com autenticação JWT e comandos em tempo real via Kafka.
- **Paper vs. Real**: modos independentes, filtros dedicados e simulador rápido para validar estratégias sem tocar produção.
- **Contratos versionados**: Protobuf compartilhado entre Rust, Go e Python.
- **Observabilidade pronta**: endpoints `/metrics`, stack Prometheus+Grafana e runbooks em `docs/operations/`.

---

## Arquitetura em Camadas

| Camada | Tecnologia / Responsabilidade |
|--------|-------------------------------|
| Ingestão | **Coinbase Connector (Rust)** — WebSocket → Kafka (`market-data.trades.coinbase`) |
| Normalização | **Data Normalizer (Rust)** — limpeza e publicação em `market-data.trades.normalized` |
| Estratégias | **Strategy Framework (Python)** — consome mercado, recebe comandos (`control.commands`) e gera sinais |
| Validação | **Risk Engine (Rust)** — políticas de risco, limites e roteamento |
| Execução | **Order Manager (Go)** — gRPC interno → REST Coinbase |
| Controle | **Control Center API (Go)** — Redis (portfólio), PostgreSQL (operações), publicação de comandos |
| UI | **Control Center Frontend (Next.js 16 / TS)** — dashboards Real/Paper, login, governança |
| Observabilidade | **Prometheus + Grafana** — métricas, dashboards e alertas |

---

## Diagrama de Fluxo

```mermaid
flowchart LR
    subgraph Market Data
        A[Coinbase WS] --> B[Coinbase Connector<br>(Rust)]
        B -->|market-data.trades.coinbase| C[Kafka]
    end

    C --> D[Data Normalizer<br>(Rust)]
    D -->|market-data.trades.normalized| C
    C --> E[Strategy Framework<br>(Python)]
    E --> F[Risk Engine<br>(Rust)]
    F --> G[Order Manager<br>(Go)]
    G --> H[Coinbase REST]

    subgraph Control Center
        I[Control Center API<br>(Go)] -->|Redis cache| J[(Redis)]
        I -->|Feed operações| K[(PostgreSQL)]
        L[Control Center Frontend<br>(Next.js)] --> I
        L -->|control.commands| C
    end

    E -->|positions/orders| J
    G -->|operations| K
```

---

## Pré-requisitos por Sistema

| Sistema | Dependências base | Comandos sugeridos |
|---------|------------------|--------------------|
| **Linux (Ubuntu/Debian)** | Git, Docker, Docker Compose, `build-essential`, `cmake`, `pkg-config`, `protoc` 3.20+, Rust (`rustup`), Python 3.11 + Poetry, Go 1.21+, Node 18+ | ```bash\nsudo apt update && sudo apt install -y git docker.io docker-compose cmake pkg-config protobuf-compiler python3.11 python3.11-venv make\ncurl https://sh.rustup.rs -sSf | sh\ncurl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -\nsudo apt install -y nodejs golang\n``` |
| **macOS (Apple Silicon/Intel)** | Homebrew, Docker Desktop, `protoc`, Rust, Python 3.11, Go 1.21, Node 18 | ```bash\n/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"\nbrew install protobuf cmake pkg-config python@3.11 go node rustup-init\nrustup-init\n``` |
| **Windows 11** | WSL2 (Ubuntu recomendado) OU Docker Desktop + PowerShell, `winget`/`choco` para Git, Go, Node; Python 3.11; Rust via `rustup.exe` | ```powershell\nwsl --install -d Ubuntu\nwinget install --id Git.Git\nwinget install --id Docker.DockerDesktop\nwinget install --id Python.Python.3.11\nwinget install --id GoLang.Go\nwinget install --id OpenJS.NodeJS.LTS\nwinget install --id Protobuf.Tools\nInvoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe\n``` |

> Detalhes adicionais e soluções de problemas: [`docs/development-environment.md`](docs/development-environment.md).

---

## Configuração Rápida

1. **Obter o código**
   ```bash
   git clone https://github.com/Igor-Almeidados-Santos/oasis-trading-system-OTS.git
   cd oasis-trading-system-OTS
   ```
   > Alternativa: [Download ZIP](https://github.com/Igor-Almeidados-Santos/oasis-trading-system-OTS/archive/refs/heads/main.zip) e extração manual.

2. **Criar `.env`**
   ```bash
   cp .env.example .env          # Linux/macOS
   Copy-Item .env.example .env   # PowerShell
   ```
   Preencha credenciais Coinbase para modo REAL e ajuste hosts/ports se necessário.

3. **Gerar contratos Protobuf (sempre que `api/proto` mudar)**
   ```bash
   ./scripts/gen-proto.sh      # Linux/macOS
   ./scripts/gen-proto.ps1     # Windows PowerShell
   ```

4. **Subir infraestrutura base**
   ```bash
   docker compose up -d zookeeper kafka redis postgres prometheus grafana
   ```
   - PostgreSQL: `localhost:5432` (user/password `postgres`).
   - Redis: `redis://localhost:6380` (ajuste `REDIS_ADDR` quando usar porta padrão 6379).

5. **Inicializar todo o pipeline (modo desenvolvimento)**
   - Utilize terminais dedicados ou `tmux` para cada componente (ver [Execução dos Componentes](#execução-dos-componentes)).
   - Configure `NEXT_PUBLIC_API_BASE_URL` apontando para a API (ex.: `http://localhost:8080`).

---

## Variáveis de Ambiente Essenciais

| Categoria | Principais chaves | Notas |
|-----------|------------------|-------|
| Kafka & dados | `KAFKA_BROKERS`, `RAW_MARKET_TOPIC`, `NORMALIZED_MARKET_TOPIC`, `CONTROL_COMMAND_TOPIC`, `STRATEGY_CONSUMER_GROUP` | Ajuste brokers se usar ambientes remotos/SASL. |
| Strategy Framework | `SYMBOL`, `STRATEGY_METRICS_PORT`, `MARKET_DATA_TOPIC` | Cada estratégia pode sobrescrever `StrategyConfigUpdatePayload`. |
| Risco & execução | `RISK_ENGINE_GRPC_ADDR`, `ORDER_MANAGER_GRPC_ADDR`, `ORDER_MANAGER_MODE`, `ORDER_MANAGER_COINBASE_VARIANT`, `ORDER_MANAGER_COINBASE_ENV` | `ORDER_MANAGER_MODE=paper` por padrão. |
| Credenciais Coinbase | `COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_API_PASSPHRASE`, `COINBASE_API_BASE_URL` | Obrigatórias para modo REAL. |
| Control Center API | `CONTROL_CENTER_API_PORT`, `CONTROL_CENTER_API_USER`, `CONTROL_CENTER_API_PASSWORD`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_ADDR`, `CONTROL_CENTER_ALLOWED_ORIGINS` | JWT assinado com `HS256` usando `JWT_SECRET`. |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | Deve corresponder ao host público da API. |

> Todos os campos estão documentados em [`.env.example`](.env.example). Em produção, utilize um gestor de segredos (Vault, AWS SM, etc.).

---

## Execução dos Componentes

### Makefile (atalhos principais)
```bash
make proto                # Gera Protobuf
make kafka-up             # Kafka + Zookeeper (docker)
make coinbase-connector   # Executa o conector (Rust)
make risk-engine          # Executa o serviço de risco (Rust)
make order-manager        # Executa o order manager (Go)
make data-normalizer      # Executa o normalizador (Rust)
make strategy-framework   # Inicia o consumidor/estratégia (Python)
make test                 # Testes principais
```

### Execução manual

```bash
# Coinbase Connector (Rust)
cd components/coinbase-connector && cargo run

# Data Normalizer (Rust)
cd components/data-normalizer && cargo run

# Risk Engine (Rust)
cd components/risk-engine && cargo run

# Order Manager (Go)
cd components/order-manager && go run .

# Strategy Framework (Python)
cd components/strategy-framework
poetry install
poetry run python src/consumer.py
```

### Control Center

```bash
# API (Go)
cd control-center/api-backend && go run .

# Frontend (Next.js 16)
cd control-center/frontend
npm install
npm run dev   # http://localhost:3000
```

> A API registra a porta final nos logs. Use `POST /api/v1/auth/login` com as credenciais do `.env` para obter o JWT e aceder às rotas protegidas.

---

## Control Center (API & Dashboard)

- **API**: expõe `/api/v1` com autenticação Bearer. Endpoints mais usados:
  - `POST /api/v1/auth/login` → retorna JWT.
  - `GET /api/v1/portfolio` → posições agregadas (Redis).
  - `GET /api/v1/operations?mode=REAL|PAPER&limit=50` → histórico no PostgreSQL.
  - `POST /api/v1/bot/status` → envia `SET_BOT_STATUS` (START/STOP) via Kafka.
  - `POST /api/v1/strategies/:id/toggle` → atualiza `enabled/mode`.
- **Dashboard Next.js**:
  - Página inicial: métricas modo REAL (posições, operações, estado do bot).
  - Página **Simulações**: filtros PAPER, modal de configuração, reset rápido e simulador.
  - Notificações UI refletem o resultado das chamadas da API (erro/sucesso).
- **Autorização**: defina `CONTROL_CENTER_API_USER/PASSWORD` e `JWT_SECRET`. O token deve acompanhar cada request com `Authorization: Bearer <token>`.

---

## Simulações e Ambiente Paper

- **Página dedicada** (`/simulations`): gráficos de saldo paper, tabelas filtradas e modal persistente para atualizar `StrategyConfigUpdatePayload`.
- **Estratégia `advanced-alpha-001`**: exposta na UI, inicia em PAPER desativada até confirmação manual.
- **Simulador rápido `test-simulator-001`**: gera BUY/SELL alternados com o saldo definido no modal.
- **Reset Paper**: botão “Zerar ambiente paper” remove `position:paper:*`, reinicia `wallet:paper:USD` e limpa histórico de caixa.
- **Scripts de apoio**: `poetry run python src/tools/send_sample.py` injeta trades artificiais para testes em Kafka.

### Reproduzir dados sintéticos
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

---

## Modos de Operação

| Modo | Configuração | Observações |
|------|--------------|-------------|
| **Paper (default)** | `ORDER_MANAGER_MODE=paper` e credenciais Coinbase vazias. Use o simulador ou dados históricos. | Control Center continua ativo; ordens nunca chegam à exchange. |
| **Real** | `ORDER_MANAGER_MODE=real`, `COINBASE_API_*`, `ORDER_MANAGER_COINBASE_VARIANT=advanced_trade|exchange`, `ORDER_MANAGER_COINBASE_ENV=prod|sandbox`. | Revise limites no Risk Engine, proteja o `.env` e audite logs antes de ativar. |

Alternar entre modos pelo dashboard (toggle da estratégia) ou diretamente pela API `POST /api/v1/strategies/:id/toggle`.

---

## Observabilidade e Operações
- Cada serviço expõe `/metrics` (ports configuradas no `.env`).
- `docker compose up prometheus grafana` disponibiliza dashboards prontos (login `admin/admin`).
- Monitorize lag de consumidores com:
  ```bash
  kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group strategy-framework-group
  ```
- Runbooks, dashboards e guias de operação estão em [`docs/operations/`](docs/operations/) e [`docs/runbooks/`](docs/runbooks/).

---

## Verificações e Testes

| Serviço | Comando |
|---------|---------|
| Coinbase Connector / Data Normalizer / Risk Engine | `cargo fmt --check && cargo clippy -- -D warnings && cargo test` |
| Strategy Framework | `poetry run black --check . && poetry run isort --check . && poetry run pytest` |
| Order Manager | `cd components/order-manager && go test ./...` |
| Control Center API | `cd control-center/api-backend && go test ./...` |
| Frontend | `cd control-center/frontend && npm run lint && npm run test` (configure Jest/Playwright conforme necessário) |
| Pipeline integrado | Utilize `docker compose logs -f` + testes end-to-end descritos em [`docs/components.md`](docs/components.md). |

---

## Documentação Complementar
- [Visão de Arquitetura](docs/architecture-overview.md)
- [Detalhes por Componente](docs/components.md)
- [Ambiente de Desenvolvimento](docs/development-environment.md)
- [Operações & Observabilidade](docs/operations/)
- [Runbooks](docs/runbooks/)

---

Sinta-se à vontade para adaptar as estratégias, integrar novas corretoras ou estender o Control Center. Pull requests e sugestões são bem-vindos! 🚀
