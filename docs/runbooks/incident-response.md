# Runbook – Incident Response

## Objetivo
Guiar a equipa na identificação, mitigação e comunicação de incidentes que impactem o Oasis Trading System.

## Detectar
1. Monitorar alertas do Grafana (painel `Trading Platform`) e logs centralizados.
2. Validar impacto consultando:
   - Métricas Prometheus dos serviços (`/metrics`).
   - Tópicos Kafka através de `kafka-topics.sh --describe`.
   - Logs nos pods/serviços (`journalctl`, `kubectl logs`, etc.).

## Responder
1. **Estabilizar**:
   - Se Kafka indisponível: reiniciar broker ou desviar tráfego para réplica.
   - Se Risk Engine negativo: ative modo degradado (`RISK_USE_REDIS=0`) e envie sinais para fila de quarentena.
   - Se Order Manager falhar: desativar roteamento automático e notificar clientes sobre atraso nas execuções.
2. **Mitigar**:
   - Reprocessar dados perdidos usando `strategy-framework/src/tools/send_sample.py`.
   - Re-iniciar serviços com `systemctl`/`docker compose` ou `kubectl rollout restart`.
3. **Comunicar**:
   - Atualizar canal `#incident-response` com resumo (linha temporal, impacto, ações).
   - Abrir Issue no GitHub com etiqueta `incident` para rastreio posterior.

## Recuperar
1. Validar que filas Kafka estão a consumir normalmente (lag dentro do esperado).
2. Confirmar métricas de risco e execução estabilizadas.
3. Reverter configurações temporárias (modos degradados, reroteamentos).

## Pós-Incidente
1. Realizar post-mortem em até 48h documentando causa raiz, ações corretivas e lições aprendidas.
2. Atualizar ADRs / documentação se decisões arquiteturais foram afetadas.
3. Criar tickets para automatizar os passos mais manuais observados.
