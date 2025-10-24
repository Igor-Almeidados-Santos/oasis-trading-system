# Observabilidade e Manutenção

Este guia cobre métricas, logs e rotinas que suportam a operação saudável do Oasis Trading System.

## Stack de Observabilidade
- **Prometheus**: Coleta métricas dos serviços.
- **Grafana**: Dashboards e alertas.
- **Logs**:
  - Rust: `tracing` com formato estruturado.
  - Python: `logging` com handlers configuráveis.
  - Go: `log` padrão, com suporte a JSON (configurável).

## Métricas Principais
- **Coinbase Connector**
  - `connector_ws_messages_total`
  - `connector_kafka_publish_errors_total`
- **Data Normalizer**
  - `normalizer_messages_processed_total`
  - `normalizer_processing_latency_seconds`
- **Strategy Framework**
  - `strategy_trades_processed_total`
  - `strategy_signal_validation_result_total{status="accepted|rejected"}`
- **Risk Engine**
  - `risk_validation_duration_seconds`
  - `risk_position_limit_breaches_total`
- **Order Manager**
  - `order_execution_latency_seconds`
  - `order_submit_errors_total`

## Configuração Local
```bash
docker compose up -d prometheus grafana
```
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (`admin/admin` por padrão)
- Adicione Prometheus como data source (`http://prometheus:9090`).

## Dashboards Recomendados
1. **Fluxo de Mercado**: Mensagens por componente, latência de processamento.
2. **Sinais e Ordens**: Contagem de sinais aprovados/rejeitados, sucesso nas execuções.
3. **Saúde de Componentes**: Status de readiness, uso de CPU/memória (via Node Exporter se disponível).

## Alertas Sugeridos
- Taxa de erro > 1% em qualquer serviço (`*_errors_total`).
- Latência de validação > 500ms (p95) no Risk Engine.
- Ausência de mensagens no tópico normalized em janelas > 1 minuto.
- Falha de liveness/readiness por mais de 3 verificações consecutivas.

## Logs
- Centralize logs em solução tipo ELK ou Loki.
- Aplique correlação de requisições via IDs nos eventos gRPC.
- Configure níveis (`INFO`, `DEBUG`, `ERROR`) conforme ambiente.

## Rotinas de Manutenção
- Revisar dashboards e alertas semanalmente.
- Testar procedimentos de incidente (`docs/runbooks/incident-response.md`).
- Auditar acessos a secrets e credenciais trimestralmente.
- Validar renovação de certificados TLS e credenciais de API antes do vencimento.
