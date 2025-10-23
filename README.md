# Oasis Trading System

Oasis Trading System é uma plataforma modular para ingestão de dados de mercado, geração de sinais, validação de risco e execução de ordens em corretoras cripto. A stack usa Rust, Python e Go, mensageria via Kafka e gRPC para comunicação síncrona entre serviços.

```
Coinbase WS  -->  coinbase-connector (Rust)  --Kafka-->  data-normalizer (Rust)  --Kafka-->  strategy-framework (Python)
                                                                                                 |
                                                                                                 v
                                                                                           risk-engine (Rust)  --gRPC-->  order-manager (Go)  --> Coinbase REST
```

## Estrutura do repositório
- `api/proto/` contratos Protobuf usados por todos os serviços.
- `components/coinbase-connector/` conector WebSocket -> Kafka (Rust).
- `components/strategy-framework/` consumo de market data, geração de sinais e envio ao risk engine (Python 3.11 + Poetry).
- `components/risk-engine/` serviço gRPC que valida risco e encaminha ordens (Rust + Redis opcional).
- `components/order-manager/` ponte gRPC -> Coinbase REST API (Go).
- `components/data-normalizer/` normaliza eventos de mercado e publica em tópico dedicado (Rust).
- `infra/monitoring/` Prometheus configuration.
- `docker-compose.yml` infraestrutura local (Kafka, Prometheus, Grafana).
- `scripts/` utilitários multiplataforma para geração de código.
- `.env.example` variáveis de ambiente esperadas pelos serviços.

## Pré-requisitos
Ferramentas essenciais:
- Git, Docker e Docker Compose.
- Protocolo Protobuf (`protoc` 3.20+).
- `cmake` e `pkg-config` (necessários para compilar `rdkafka` no connector).
- Redis (local ou remoto) se quiser persistir posições no risk engine.

Stacks por linguagem:
- Rust toolchain estável (via `rustup`). Testado com 1.75+.
- Go 1.21 ou superior (o módulo declara 1.24).
- Python 3.11 com Poetry 1.6+.

Sugestões de instalação:
- Linux (Ubuntu/Debian): `sudo apt-get install build-essential pkg-config cmake protobuf-compiler librdkafka-dev redis-server`.
- macOS: `brew install rustup-init go python@3.11 cmake pkg-config protobuf librdkafka redis`.
- Windows:
  - Use PowerShell ou WSL. Em Windows nativo instale `choco install git go python protobuf cmake` e configure o caminho do `protoc`.
  - Instale Rust via `winget install Rustlang.Rustup` e execute `rustup default stable`.
  - Para `rdkafka`, instale o Visual Studio Build Tools (C++ workload) e `choco install lz4 zstd`.
  - Redis pode ser executado em WSL ou via `docker run -p 6379:6379 redis:7`.

## Configuração de ambiente
1. Clone o repositório e entre no diretório.
2. Copie o template de variáveis: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`).
3. Preencha credenciais reais da Coinbase (`COINBASE_API_*`) antes de enviar ordens em produção. **Nunca** comite `.env`.
4. Ajuste endpoints caso os serviços sejam executados em hosts diferentes (Kafka, Redis, gRPC).

### Dependências Python
```bash
cd components/strategy-framework
poetry install
```

### Geração de código Protobuf
- Linux/macOS:
  ```bash
  ./scripts/gen-proto.sh
  ```
- Windows PowerShell:
  ```powershell
  ./scripts/gen-proto.ps1
  ```
- Alternativa: a partir de `components/strategy-framework`, `poetry run gen-proto`.
- O risk engine compila os protos automaticamente via `build.rs`. O order manager já inclui código Go gerado; para regenerar, execute `protoc --go_out --go-grpc_out` apontando para `api/proto`.

## Infraestrutura local
- Kafka + Zookeeper: `docker-compose up -d zookeeper kafka`.
- Redis (opcional para risco persistente): `docker run -d --name redis -p 6379:6379 redis:7`.
- Observabilidade:
  ```bash
  docker-compose up -d prometheus grafana
  ```
  - Prometheus: http://localhost:9090
  - Grafana: http://localhost:3000 (admin/admin). Configure Prometheus como data source apontando para `http://prometheus:9090`.
  - Os serviços expõem métricas nas portas definidas em `.env` (`9091-9094`).

## Execução dos serviços
Recomenda-se iniciar na ordem abaixo, cada um em um terminal separado:

1. **Order Manager (Go)**
   ```bash
   cd components/order-manager
   go run .
   ```
   - Usa variáveis `ORDER_MANAGER_GRPC_ADDR` e credenciais Coinbase.

2. **Risk Engine (Rust)**
   ```bash
   cd components/risk-engine
   cargo run
   ```
   - Usa `ORDER_MANAGER_ADDR`, `RISK_USE_REDIS`, `RISK_ENGINE_GRPC_ADDR`.
   - Persistência em Redis se disponível; defina `RISK_USE_REDIS=0` para memória.

3. **Data Normalizer (Rust)**
   ```bash
   cd components/data-normalizer
   cargo run
   ```
   - Consome `market-data.trades.coinbase`, normaliza campos e republica em `market-data.trades.normalized`.
   - Utilize variáveis `KAFKA_BROKERS` e `GROUP_ID` específicas se desejar isolamento.

4. **Strategy Framework (Python)**
   ```bash
   cd components/strategy-framework
   poetry run python src/run_framework.py
   ```
   - Ajuste `KAFKA_TOPIC=market-data.trades.normalized` para consumir o tópico normalizado.
   - Consome Kafka (`KAFKA_BROKERS`), gera sinais e invoca o risk engine.
   - Para enviar sinais manualmente: `poetry run send-sample --count 5`.
   - Consumidor completo com risco integrado: `poetry run python src/consumer.py`.

5. **Coinbase Connector (Rust)**
   ```bash
   cd components/coinbase-connector
   cargo run
   ```
   - Conecta no WebSocket (`COINBASE_WS_URL`) e publica em Kafka (`KAFKA_BROKERS`).
   - Requer `librdkafka` disponível. O teste `cargo test` usa um WebSocket fake para validação local.

### Fluxo ponta-a-ponta
1. O conector recebe trades via WebSocket e os publica no tópico `market-data.trades.coinbase`.
2. O data normalizer consome o tópico bruto, ajusta casing/precisão e republica em `market-data.trades.normalized`.
3. O strategy framework consome o tópico normalizado, roda `SimpleMomentum` e envia sinais ao risk engine.
4. O risk engine valida limites (ordem e posição), opcionalmente consulta Redis, e chama o order manager.
5. O order manager assina a ordem via REST autenticado na Coinbase e devolve o resultado.

## Variáveis de ambiente chave
- `KAFKA_BROKERS`, `KAFKA_TOPIC`, `GROUP_ID`: configuração de mensageria (defina `KAFKA_TOPIC=market-data.trades.normalized` para consumidores).
- `COINBASE_WS_URL`: endpoint WebSocket do conector.
- `STRATEGY_SYMBOL`, `STRATEGY_METRICS_PORT`.
- `RISK_ENGINE_GRPC_ADDR`, `RISK_USE_REDIS`, `RISK_METRICS_PORT`.
- `ORDER_MANAGER_GRPC_ADDR`, `COINBASE_API_KEY`, `COINBASE_API_SECRET`, `COINBASE_API_PASSPHRASE`.
- `CONNECTOR_METRICS_PORT`, `ORDER_MANAGER_METRICS_PORT` para scrapes Prometheus.

## Testes e verificações
- Conector: `cd components/coinbase-connector && cargo test`.
- Risk engine: `cargo fmt && cargo clippy && cargo test` (requer mocks adicionais para novas funcionalidades).
- Estratégia: `cd components/strategy-framework && poetry run pytest` (adicionar testes em `tests/`).
- Pode-se simular market data com `poetry run send-sample --topic market-data.trades.coinbase`.
- Para validar o normalizador isoladamente: `cargo run --manifest-path components/data-normalizer/Cargo.toml`.

## Observabilidade e alertas
- Métricas prometheus:
  - `strategy_trades_processed_total`, `strategy_signal_validation_result_total` no strategy framework.
  - Adicione novos contadores/gauges para risco e execução conforme necessário.
- Crie dashboards no Grafana apontando para as métricas expostas nas portas 9091-9094.
- Para logs estruturados, todas as aplicações usam `tracing` (Rust), `logging` (Python) e `log` (Go).

## Dicas de produção
- Separe configurações por ambiente (`.env.production`, `config/`) e injete via secrets manager.
- Configure autenticação TLS e `sasl_scram` no Kafka antes de ir para produção.
- Armazene chaves Coinbase fora do repositório (ex: HashiCorp Vault, AWS Secrets Manager).
- Restrinja acesso outbound dos serviços ao conjunto mínimo de hosts (Coinbase, Kafka, Redis).

## Próximos passos sugeridos
- Adicionar testes de carga (veja `tests/load/trading_system_load.js`) via k6/Artillery.
- Automatizar builds com CI (lint/test dos três ecossistemas).
- Documentar ADRs adicionais em `docs/adrs/` e runbooks operacionais em `docs/runbooks/`.

Boa negociação!
