# Oasis Trading System — Guia de Instalação e Configuração

O Oasis Trading System (OTS) é uma plataforma modular para ingestão de dados de mercado, geração de sinais, validação de risco e execução de ordens em exchanges cripto. Este documento orienta a instalação, configuração e validação do sistema em ambiente local ou de staging.

```
Coinbase WS --> Coinbase Connector (Rust) --Kafka--> Data Normalizer (Rust) --Kafka--> Strategy Framework (Python)
                                                                                     |
                                                                                     v
                                                                               Risk Engine (Rust) --gRPC--> Order Manager (Go) --> Coinbase REST
```

## Sumário
1. [Pré-requisitos por sistema operacional](#1-pré-requisitos-por-sistema-operacional)
2. [Clonar o repositório](#2-clonar-o-repositório)
3. [Configurar variáveis de ambiente](#3-configurar-variáveis-de-ambiente)
4. [Instalar dependências por componente](#4-instalar-dependências-por-componente)
5. [Gerar código Protobuf](#5-gerar-código-protobuf)
6. [Inicializar infraestrutura local](#6-inicializar-infraestrutura-local)
7. [Executar os serviços](#7-executar-os-serviços)
8. [Verificações e testes](#8-verificações-e-testes)
9. [Próximos passos](#9-próximos-passos)

---

## 1. Pré-requisitos por sistema operacional

### 1.1 Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y git curl build-essential pkg-config cmake protobuf-compiler \
    librdkafka-dev redis-server python3 python3-venv python3-pip
curl https://sh.rustup.rs -sSf | sh -s -- -y
source $HOME/.cargo/env
curl -LO https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
curl -sSL https://install.python-poetry.org | python3 -
```
> Ajuste a versão de Go conforme necessário.

### 1.2 macOS (Homebrew)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install git docker docker-compose protobuf cmake pkg-config librdkafka redis go python@3.11
curl https://sh.rustup.rs -sSf | sh -s -- -y
source $HOME/.cargo/env
pip3 install --user pipx
pipx install poetry
```
- Inicie o Docker Desktop para habilitar o daemon.
- Adicione `/opt/homebrew/bin` ao `PATH` se necessário (Apple Silicon).

### 1.3 Windows 10/11
1. Instale [WSL](https://learn.microsoft.com/windows/wsl/install) (Ubuntu recomendado).
2. Via PowerShell (administrador):
   ```powershell
   winget install -e --id Git.Git
   winget install -e --id Docker.DockerDesktop
   winget install -e --id Rustlang.Rustup
   winget install -e --id GoLang.Go
   winget install -e --id Python.Python.3.11
   winget install -e --id Kitware.CMake
   winget install -e --id ProtobufTools.MicrosoftWindows
   choco install pkgconfiglite redis-64 lz4 zstd -y
   ```
3. Abra o terminal WSL e execute:
   ```bash
   curl -sSL https://install.python-poetry.org | python3 -
   ```
4. Configure o PATH do `protoc` e do Go se necessário (`setx PATH "%PATH%;C:\Program Files\Go\bin"`).

### 1.4 Links úteis
- Git: https://git-scm.com/downloads
- Docker Engine/Desktop: https://docs.docker.com/get-docker/
- Protobuf: https://github.com/protocolbuffers/protobuf/releases
- Rust (rustup): https://www.rust-lang.org/tools/install
- Go: https://go.dev/dl/
- Python 3.11: https://www.python.org/downloads/
- Poetry: https://python-poetry.org/docs/#installation
- librdkafka: https://github.com/confluentinc/librdkafka#installation

---

## 2. Clonar o repositório
```bash
git clone git@github.com:seu-org/oasis-trading-system.git
cd oasis-trading-system
```
> Se utilizar HTTPS: `git clone https://github.com/seu-org/oasis-trading-system.git`.

---

## 3. Configurar variáveis de ambiente
1. Copie o template:
   ```bash
   cp .env.example .env
   ```
   - Windows PowerShell: `Copy-Item .env.example .env`.
2. Edite `.env` e defina:
   - Credenciais Coinbase (`COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_API_PASSPHRASE`).
   - Endereços dos serviços (`KAFKA_BROKERS`, `RISK_ENGINE_GRPC_ADDR`, `ORDER_MANAGER_GRPC_ADDR`).
3. **Nunca** comite o arquivo `.env`. Utilize secret managers em produção.

Principais variáveis:
- `KAFKA_BROKERS=localhost:9092`
- `KAFKA_TOPIC=market-data.trades.normalized`
- `GROUP_ID=ots-strategy`
- `COINBASE_WS_URL=wss://advanced-trade-ws.coinbase.com`
- `RISK_USE_REDIS=1` (use `0` para modo stateless)

---

## 4. Instalar dependências por componente

### 4.1 Serviços Rust
```bash
rustup default stable
cargo check --all
```
- Executar nas pastas `components/coinbase-connector`, `components/data-normalizer`, `components/risk-engine`.

### 4.2 Strategy Framework (Python)
```bash
cd components/strategy-framework
poetry install
poetry run pre-commit install  # opcional, se utilizar hooks
cd ../..
```

### 4.3 Order Manager (Go)
```bash
cd components/order-manager
go mod tidy
go test ./...
cd ../..
```

---

## 5. Gerar código Protobuf
Execute sempre que alterar arquivos em `api/proto/`.

- Linux/macOS:
  ```bash
  ./scripts/gen-proto.sh
  ```
- Windows PowerShell:
  ```powershell
  ./scripts/gen-proto.ps1
  ```
- Alternativa via Poetry:
  ```bash
  cd components/strategy-framework
  poetry run gen-proto
  cd ../..
  ```

---

## 6. Inicializar infraestrutura local
1. Suba Kafka e Zookeeper:
   ```bash
   docker compose up -d zookeeper kafka
   ```
2. (Opcional) Redis standalone:
   ```bash
   docker run -d --name redis -p 6379:6379 redis:7
   ```
3. Observabilidade:
   ```bash
   docker compose up -d prometheus grafana
   ```
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000 (admin/admin). Adicione Prometheus (`http://prometheus:9090`) como data source.

---

## 7. Executar os serviços
Abra terminais separados e siga a ordem recomendada.

1. **Order Manager (Go)**
   ```bash
   cd components/order-manager
   go run .
   ```
2. **Risk Engine (Rust)**
   ```bash
   cd components/risk-engine
   cargo run
   ```
3. **Data Normalizer (Rust)**
   ```bash
   cd components/data-normalizer
   cargo run
   ```
4. **Strategy Framework (Python)**
   ```bash
   cd components/strategy-framework
   poetry run python src/run_framework.py
   ```
5. **Coinbase Connector (Rust)**
   ```bash
   cd components/coinbase-connector
   cargo run
   ```

Fluxo ponta a ponta:
1. Connector publica `market-data.trades.coinbase`.
2. Normalizer consome e republica `market-data.trades.normalized`.
3. Strategy Framework gera sinais e chama o Risk Engine.
4. Risk Engine valida limites (consulta Redis se ativado) e chama o Order Manager.
5. Order Manager envia ordens para a Coinbase e retorna o resultado.

---

## 8. Verificações e testes
- **Kafka**: verifique lag com `kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group ots-strategy`.
- **Conector**: `cd components/coinbase-connector && cargo test`.
- **Risk Engine**: `cd components/risk-engine && cargo fmt && cargo clippy && cargo test`.
- **Strategy Framework**: `cd components/strategy-framework && poetry run pytest`.
- **Order Manager**: `cd components/order-manager && go test ./...`.
- **Mensagens de teste**:
  ```bash
  cd components/strategy-framework
  poetry run send-sample --topic market-data.trades.coinbase --count 5
  ```
- **Monitore métricas**: cada serviço expõe `/metrics` na porta definida em `.env` (`9091-9094` por padrão).

---

## 9. Próximos passos
- Consulte `docs/architecture-overview.md` para entender a topologia completa.
- Revise `docs/components.md` para detalhes específicos de cada serviço.
- Planeje deploys com `docs/operations/deployment.md`.
- Configure observabilidade seguindo `docs/operations/observability.md`.
- Em caso de incidentes, utilize o runbook `docs/runbooks/incident-response.md`.

Para contribuir ou customizar estratégias, leia `docs/development-environment.md`.
