# Visão de Arquitetura

## Objetivo do Sistema
O Oasis Trading System (OTS) é uma plataforma modular para ingestão de dados de mercado, geração de sinais de trading, validação de risco e execução de ordens em corretoras de criptoativos. Os serviços são desacoplados por mensageria, permitindo evolução independente e escalabilidade horizontal.

## Topologia Geral
```
Coinbase WS --> Coinbase Connector (Rust) --Kafka--> Data Normalizer (Rust) --Kafka--> Strategy Framework (Python)
                                                                                         |
                                                                                         v
                                                                                   Risk Engine (Rust) --gRPC--> Order Manager (Go) --> Coinbase REST
```

- **Mensageria**: Kafka interliga os serviços assíncronos (ingestão e normalização).
- **Comunicação síncrona**: gRPC conecta Strategy Framework ao Risk Engine e este ao Order Manager.
- **Persistência opcional**: Redis para gerenciamento de posições/riscos.

## Componentes e Papéis
- **Coinbase Connector**: Consome trades via WebSocket e publica em Kafka (`market-data.trades.coinbase`). Escrita em Rust, depende de `librdkafka`.
- **Data Normalizer**: Ajusta formatos/precisão dos eventos de mercado e publica no tópico `market-data.trades.normalized`.
- **Strategy Framework**: Aplica estratégias (ex.: `SimpleMomentum`), gera sinais e invoca o Risk Engine via gRPC.
- **Risk Engine**: Aplica limites de risco, pode persistir estado no Redis e encaminha ordens para o Order Manager.
- **Order Manager**: Converte sinais aprovados em chamadas REST autenticadas na Coinbase.

## Fluxo de Dados
1. **Aquisição**: Coinbase Connector ingere eventos brutos e produz em Kafka.
2. **Normalização**: Data Normalizer garante consistência de campos e republica em tópico dedicado.
3. **Geração de Sinais**: Strategy Framework consome o tópico normalizado, calcula indicadores e envia sinais.
4. **Validação de Risco**: Risk Engine avalia limites (ordem, posição, exposure) e persiste estado opcionalmente.
5. **Execução**: Order Manager assina e envia ordens para a API REST da Coinbase, retornando confirmações.

## Tecnologias Principais
- **Linguagens**: Rust (alto desempenho e segurança), Python (estratégias flexíveis), Go (serviço gRPC -> REST).
- **Mensageria**: Apache Kafka (tópicos para market data e eventos internalizados).
- **Serialização**: Protobuf para contratos estáveis entre serviços.
- **Infraestrutura complementar**: Docker Compose para ambiente local, Prometheus e Grafana para observabilidade.

## Decisões Arquiteturais
- As decisões formais estão catalogadas em `docs/adrs/`. A ADR-001 detalha a escolha por Kafka e gRPC.
- O alinhamento entre processos é mantido via contratos Protobuf versionados em `api/proto`.
- O design modular permite substituir corretoras, ajustar estratégias e adicionar novas fontes de dados sem refatorar o núcleo.

## Roadmap de Evolução
- **Suporte multi-corretora**: Generalizar o Order Manager para múltiplos destinos.
- **Persistência histórica**: Integrar data lake (ex.: S3) para backtesting.
- **Escalabilidade**: Containerizar serviços com helm charts e incorporar auto scaling baseado em métricas.
