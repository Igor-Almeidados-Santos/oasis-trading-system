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
   - Parâmetros do Coinbase Connector (ver próximos bullet points).
3. **Nunca** comite o arquivo `.env`. Utilize secret managers em produção.

Principais variáveis:
- `KAFKA_BROKERS=localhost:9092`
- `KAFKA_TOPIC=market-data.trades.normalized`
- `GROUP_ID=ots-strategy`
- `COINBASE_WS_URL=wss://ws-feed.exchange.coinbase.com`
- `COINBASE_KAFKA_TOPIC=market-data.trades.coinbase`
- `COINBASE_PRODUCT_IDS=BTC-USD,ETH-USD` (lista separada por vírgula)
- `COINBASE_CHANNELS=matches`
- `CONNECTOR_MAX_MESSAGES=` (opcional; vazio = fluxo contínuo)
- `CONNECTOR_BACKOFF_INITIAL_MS=1000` e `CONNECTOR_BACKOFF_MAX_MS=60000`
- `RISK_USE_REDIS=1` (use `0` para modo stateless)
- `ORDER_MANAGER_MODE=paper|real` (paper = simulado, não envia ordens reais)
- `COINBASE_API_BASE_URL=https://api.exchange.coinbase.com` (ajuste conforme API da Coinbase Exchange/Advanced Trade)
- `ORDER_MANAGER_COINBASE_VARIANT=advanced_trade|exchange` (define esquema de autenticação e paths)
- `ORDER_MANAGER_COINBASE_ENV=prod|sandbox` (se `COINBASE_API_BASE_URL` não for definido, escolhe um base URL padrão)
- `ORDER_MANAGER_HTTP_MAX_RETRIES=3` e `ORDER_MANAGER_HTTP_BACKOFF_MS=500` (retries de 429/5xx com backoff exponencial simples)

Kafka: em Windows, este projeto já configura listeners no `docker-compose.yml` para expor `localhost:9092`. Caso altere portas, mantenha `KAFKA_ADVERTISED_LISTENERS` consistente e atualize `KAFKA_BROKERS`.

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
   - Métricas: expostas em `http://localhost:9094/metrics` (configure `ORDER_MANAGER_METRICS_PORT`).
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
   # opcional: export COINBASE_PRODUCT_IDS="BTC-USD,ETH-USD"
   # opcional: export CONNECTOR_MAX_MESSAGES=100
  cargo run
  ```

Fluxo ponta a ponta:
1. Connector publica `market-data.trades.coinbase`.
2. Normalizer consome e republica `market-data.trades.normalized`.
3. Strategy Framework gera sinais e chama o Risk Engine.
4. Risk Engine valida limites (consulta Redis se ativado) e chama o Order Manager.
5. Order Manager envia ordens para a Coinbase e retorna o resultado.

### 7.1 Coinbase Connector – visão rápida
- Ciclo principal com backoff exponencial (configurável via `CONNECTOR_BACKOFF_*`) e reconexão automática ao feed.
- Classificação de mensagens (`match`, `subscriptions`, `heartbeat`, `status`, `error`) com logs específicos.
- Ping/Pong respondidos automaticamente; mensagens de erro do feed abortam o ciclo e disparam reconexão.
- Publicação em Kafka usando `COINBASE_KAFKA_TOPIC`; a key de cada mensagem é o símbolo (`BTC-USD` etc.).
- Para smoke tests, defina `CONNECTOR_MAX_MESSAGES=5` e verifique a saída antes de desligar.

---

## 8. Modos de operação: Teste (Paper) e Real

### 8.1 Negociação de Teste (Paper/Sandbox)
- Objetivo: validar o pipeline sem enviar ordens reais.
- Opções de fonte de dados:
  - Injetar mensagens de teste via Strategy Framework:
    - `cd components/strategy-framework`
    - `poetry run send-sample --topic market-data.trades.coinbase --symbol BTC-USD --price 10000 --count 5`
  - Usar o Coinbase Connector em tempo real, mas apenas para consumir dados:
    - Garanta que NÃO definiu credenciais da Coinbase no `.env`.
    - Opcional: `CONNECTOR_MAX_MESSAGES=50` para encerrar após N mensagens.
- Consumidores:
  - `poetry run python src/run_framework.py` ou `poetry run python src/consumer.py`.
  - Estes aguardam Kafka/tópico e fazem retry automático quando indisponíveis.
- Risk Engine e Order Manager:
  - Podem ser executados juntos; sem credenciais, o Order Manager rejeita submissões, mantendo a simulação segura.
- Segurança: não configure `COINBASE_API_*` neste modo.

Checklist rápido (teste):
- `docker compose up -d zookeeper kafka`
- `docker exec -it kafka kafka-topics --create --topic market-data.trades.coinbase --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1` (ou confie em autocriação)
- Rodar conector OU `send-sample` para povoar Kafka.
- Rodar Strategy Framework e observar sinais e chamadas gRPC ao Risk Engine.

### 8.2 Negociação Real (Produção)
- Aviso: revise o código, limites de risco e endpoint de API antes de ativar. Teste em ambiente de staging.
- Credenciais obrigatórias no `.env`:
  - `COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_API_PASSPHRASE`.
- Endpoints:
  - WebSocket (mercado): `COINBASE_WS_URL=wss://ws-feed.exchange.coinbase.com`.
  - REST de ordens: use `ORDER_MANAGER_COINBASE_VARIANT`:
    - `advanced_trade`: endpoint padrão `https://api.coinbase.com` e path `/api/v3/brokerage/orders`, headers `CB-ACCESS-KEY`, `CB-ACCESS-SIGNATURE`, `CB-ACCESS-TIMESTAMP`.
    - `exchange` (legacy): endpoint padrão `https://api.exchange.coinbase.com` e path `/orders`, headers `CB-ACCESS-KEY`, `CB-ACCESS-SIGN`, `CB-ACCESS-TIMESTAMP`, `CB-ACCESS-PASSPHRASE`.
    - Override com `COINBASE_API_BASE_URL` se necessário. Para sandbox, defina `ORDER_MANAGER_COINBASE_ENV=sandbox` (para Exchange usa `https://api-public.sandbox.exchange.coinbase.com`; verifique se há sandbox disponível para Advanced Trade).
- Limites de risco (no Risk Engine):
  - Limite por ordem (valor nocional), e limite de exposição por ativo, definidos no código (`components/risk-engine/src/main.rs`). Ajuste antes de operar real.
  - `RISK_USE_REDIS=1` recomendado para persistir posições; configure `REDIS_ADDR`.
- Ordem de start:
  1) Order Manager (Go) – porta padrão `0.0.0.0:50052` (ajuste `ORDER_MANAGER_GRPC_ADDR` se necessário).
  2) Risk Engine (Rust) – ligará ao Order Manager (use `ORDER_MANAGER_ADDR` ou `ORDER_MANAGER_GRPC_ADDR`).
  3) Kafka (Zookeeper/Kafka) – `docker compose up -d zookeeper kafka`.
  4) Coinbase Connector (Rust) – produzirá trades para Kafka.
  5) Strategy Framework (Python) – consumirá `market-data.trades.normalized` (se usar normalizador) ou `market-data.trades.coinbase` diretamente.
- Segurança operacional:
  - Comece com tamanhos mínimos (ex.: `quantity` muito pequena no Risk Engine).
  - Monitore logs e métricas; mantenha alertas para falhas de rede/Kafka.
  - Proteja `.env` e use secret managers em produção.
  - Defina `ORDER_MANAGER_MODE=real` apenas quando estiver pronto para enviar ordens reais.
  - O Order Manager registra `request_id`, `rate_limit_remaining` e `retry_after` quando disponíveis; ajuste `ORDER_MANAGER_HTTP_MAX_RETRIES`/`BACKOFF_MS` conforme a política de rate limit da Coinbase.
 - Atenção: O segredo de API é tratado como Base64 por padrão; o Order Manager tenta Base64 e Hex automaticamente.

Notas de compatibilidade Coinbase
- A API “Pro” foi descontinuada; para ambiente real atualize o endpoint e o esquema de autenticação conforme a documentação vigente da Coinbase Exchange/Advanced Trade.
- Verifique também a disponibilidade de “sandbox” oficial; se ausente, use o modo de teste descrito acima.

---

## 9. Verificações e testes
- **Kafka**: verifique lag com `kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group ots-strategy`.
- **Conector**:
  ```bash
  cd components/coinbase-connector
  cargo fmt --check
  cargo clippy -- -D warnings
  cargo test
  ```
  > O binário registra mensagens de reconexão e confirmações de assinatura; use `CONNECTOR_MAX_MESSAGES=10` para testes rápidos.
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

## 10. Próximos passos
- Consulte `docs/architecture-overview.md` para entender a topologia completa.
- Revise `docs/components.md` para detalhes específicos de cada serviço.
- Planeje deploys com `docs/operations/deployment.md`.
- Configure observabilidade seguindo `docs/operations/observability.md`.
- Em caso de incidentes, utilize o runbook `docs/runbooks/incident-response.md`.

Para contribuir ou customizar estratégias, leia `docs/development-environment.md`.
