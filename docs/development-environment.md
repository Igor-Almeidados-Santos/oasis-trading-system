# Ambiente de Desenvolvimento

Este guia descreve como preparar o ambiente local, gerar código e contribuir com segurança para o Oasis Trading System.

## Pré-requisitos Gerais
- Git, Docker e Docker Compose.
- Protobuf (`protoc` 3.20+).
- `cmake` e `pkg-config` (build `librdkafka`).
- Redis (opcional para testes do Risk Engine).
- Linguagens:
  - Rust (via `rustup`, versão estável 1.75+).
  - Python 3.11 com Poetry 1.6+.
  - Go 1.21+.

Consulte o `README.md` para comandos de instalação por sistema operacional.

## Configuração Inicial
```bash
git clone git@github.com:seu-org/oasis-trading-system.git
cd oasis-trading-system
cp .env.example .env
```
> No Windows, utilize `Copy-Item .env.example .env`.

Edite `.env` com variáveis reais (principalmente credenciais Coinbase) antes de executar em produção.

## Geração de Código Protobuf
- **Linux/macOS**:
  ```bash
  ./scripts/gen-proto.sh
  ```
- **Windows PowerShell**:
  ```powershell
  ./scripts/gen-proto.ps1
  ```
- **Via Poetry** (na pasta `components/strategy-framework`):
  ```bash
  poetry run gen-proto
  ```

## Fluxo de Desenvolvimento
1. **Instale dependências de cada serviço**:
   - Rust: `cargo check` nos crates desejados.
   - Python: `poetry install`.
   - Go: módulo já vendorizado; use `go mod tidy` se adicionar dependências.
2. **Execute linters/testes localmente**:
   - Rust: `cargo fmt --check`, `cargo clippy`, `cargo test`.
   - Python: `poetry run black --check`, `poetry run isort --check`, `poetry run pytest`.
   - Go: `go test ./...`, `golangci-lint run` (se disponível).
3. **Documente mudanças relevantes**:
   - Atualize ADRs quando decisões arquiteturais mudarem.
   - Registre runbooks para novos fluxos operacionais.

## Convenções
- **Commits**: Use mensagens claras indicando componente afetado (`connector: ...`, `risk-engine: ...`).
- **Branches**: `feature/<descrição>`, `bugfix/<descrição>`.
- **Revisão de Código**: Garanta testes automatizados quando possível e anexe evidências (logs, screenshots).

## Solução de Problemas Comuns
- **Falta de `librdkafka`**: Instale via gerenciador de pacotes (consulte README) antes de compilar componentes Rust.
- **Erro de TLS no Kafka**: Verifique configuração de SASL/SSL e certificados. Para ambiente local, utilize `PLAINTEXT`.
- **gRPC incompatível**: Regere Protobuf sempre que editar `api/proto/*.proto`.

## Recursos Adicionais
- [Documentação dos componentes](components.md)
- [Guia de deployment](operations/deployment.md)
- [Observabilidade](operations/observability.md)
