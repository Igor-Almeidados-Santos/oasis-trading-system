# ADR 001 – Comunicação entre componentes

## Contexto
O Oasis Trading System é composto por múltiplos serviços escritos em linguagens diferentes (Rust, Python e Go) e que executam funções distintas: ingestão de dados, geração de sinais, validação de risco e execução de ordens. Precisamos garantir comunicação confiável, observável e com acoplamento reduzido entre esses serviços que funcionam tanto em tempo real quanto em batch.

## Decisão
- Utilizamos **Apache Kafka** como barramento principal de eventos para fluxos assíncronos de alto volume (market data, eventos normalizados, sinais gerados).
- Para requisições síncronas que exigem resposta imediata (validação de risco e submissão de ordens), adotamos **gRPC** com contratos definidos em Protobuf compartilhados em `api/proto`.
- Cada componente expõe métricas via **Prometheus** e logs estruturados para observabilidade.

## Consequências
- Serviços podem ser escalados de forma independente, desde que publiquem/consumam nos tópicos acordados e respeitem os contratos gRPC.
- A dependência de Kafka e gRPC impõe requisitos de infraestrutura (rede, schemas, autenticação) que precisam ser tratados em ambientes de produção.
- O versionamento dos contratos Protobuf torna-se crítico: alterações compatíveis exigem rev de versão e documentação no repositório.
