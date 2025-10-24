# Deploy e Gestão de Releases

Este guia descreve estratégias de implantação e boas práticas para operar o Oasis Trading System em ambientes de staging e produção.

## Estratégia Recomendada
1. **Integração Contínua**: Automatize build, testes e geração de imagens/container para cada componente.
2. **Ambiente de Staging**: Replicar infraestrutura (Kafka, Redis, observabilidade) e validar fluxos ponta a ponta.
3. **Deploy Gradual**: Utilize blue/green ou canary quando possível para minimizar risco.
4. **Rollback**: Mantenha tags/artefatos versionados e scripts de rollback documentados.

## Preparação de Infraestrutura
- **Kafka/Zookeeper**: Gerenciado (Confluent Cloud) ou auto-hospedado. Configure replicação ≥ 3, monitore latência.
- **Redis**: Opcional, mas recomendado para persistência. Configure replicação ou use serviço gerenciado.
- **Observabilidade**: Prometheus + Grafana ou alternativa equivalente.
- **Segurança**:
  - Habilite TLS/SASL no Kafka em produção.
  - Armazene segredos em gerenciadores (Vault, AWS Secrets Manager).
  - Restringir regras de firewall e políticas outbound.

## Pipeline de Build
- **Rust**: Use `cargo build --release` para serviços de alto desempenho.
- **Python**: Empacote dependências via Poetry export (`poetry export`) ou construa imagem Docker.
- **Go**: `go build ./...` com flags `-ldflags "-s -w"` para binário enxuto.
- **Contêineres**: Defina `Dockerfile` para cada serviço ou compose multi-stage build.

## Deploy com Docker Compose
Exemplo genérico (ajuste variáveis antes de subir):
```bash
docker compose pull
docker compose up -d kafka zookeeper
docker compose up -d redis
docker compose up -d order-manager risk-engine data-normalizer coinbase-connector strategy-framework
```
> Em produção considere usar orquestradores (Kubernetes, Nomad) em vez de Docker Compose.

## Deploy em Kubernetes (alto nível)
1. Construa e publique imagens em um registry.
2. Crie manifests Helm/Kustomize para cada serviço com:
   - Deployments com `readiness`/`liveness`.
   - ConfigMaps/Secrets para `.env`.
   - Horizontal Pod Autoscaler baseado em métricas.
3. Configure Kafka via operadores (Strimzi) ou use serviço gerenciado.
4. Configure ingress e TLS para endpoints HTTP/gRPC.

## Checklist Pré-Deploy
- [ ] Protobuf e SDKs gerados estão atualizados.
- [ ] Migrações de configuração (`.env`, secrets) revisadas.
- [ ] Observabilidade (dashboards e alertas) validada.
- [ ] Plano de rollback documentado.
- [ ] Equipe de operações informada sobre janela de deploy.

## Pós-Deploy
- Monitore métricas chave (latência, throughput, erros gRPC).
- Verifique logs dos serviços nas primeiras execuções.
- Execute testes end-to-end básicos para confirmar fluxo completo.

## Gestão de Versões
- Utilize versionamento semântico para releases (`vMAJOR.MINOR.PATCH`).
- Tag no Git e promoção do mesmo commit entre ambientes.
- Documente notas de release com mudanças, impactos e passos de upgrade necessários.
