# 🌟 Oasis Trading System (OTS)

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Poetry](https://img.shields.io/badge/poetry-1.6+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-85%25-yellowgreen.svg)

**Bot de Trading Algorítmico de Criptomoedas de Alta Performance**

[Documentação](./docs) | [API Docs](./docs/api) | [Guia de Instalação](./docs/deployment/installation.md) | [Contribuindo](./CONTRIBUTING.md)

</div>

## 📊 Visão Geral

O Oasis Trading System é uma plataforma de trading algorítmico de criptomoedas de próxima geração, construída com arquitetura de microserviços e tecnologias de ponta para entregar:

- **⚡ Ultra-baixa latência**: < 50ms para execução de ordens
- **📈 Alta performance**: ROI target de 40%+ anual
- **🔄 Multi-exchange**: Suporte para 10+ exchanges principais
- **🤖 ML-Powered**: Estratégias baseadas em Machine Learning
- **🛡️ Gestão de risco**: Sistema multi-camadas de proteção de capital

## 🚀 Features Principais

### Core Trading
- ✅ 15+ estratégias de trading pré-configuradas
- ✅ Backtesting engine com simulação realista
- ✅ Smart Order Routing (SOR)
- ✅ Portfolio management multi-asset
- ✅ Risk management em tempo real

### Machine Learning
- 🧠 LSTM para previsão de preços
- 🔄 Reinforcement Learning para execução ótima
- 📊 Feature engineering automatizado
- 🎯 AutoML para otimização de estratégias

### Integrações
- 🔗 Binance, Coinbase, Kraken, OKX, Bybit
- 📡 WebSocket feeds em tempo real
- 📊 REST APIs para dados históricos
- 🔐 Gestão segura de API keys

### Observabilidade
- 📈 Dashboard em tempo real
- 📊 Métricas de performance detalhadas
- 🔔 Sistema de alertas configurável
- 📝 Logging estruturado com rastreabilidade

## 🛠️ Stack Tecnológico

### Backend
- **Core**: Python 3.11+ com AsyncIO
- **Gerenciador**: Poetry para dependências
- **API**: FastAPI, GraphQL
- **Database**: PostgreSQL + TimescaleDB
- **Cache**: Redis Cluster
- **Messaging**: Apache Kafka
- **ML**: PyTorch, scikit-learn

### Frontend
- **Framework**: React 18 + TypeScript
- **State**: Redux Toolkit
- **Charts**: TradingView + D3.js
- **Real-time**: WebSockets

### Infrastructure
- **Containers**: Docker + Kubernetes
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## 📦 Instalação Rápida

### Pré-requisitos
- Python 3.11+
- [Poetry](https://python-poetry.org/docs/#installation) 1.6+
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Instalação do Poetry

```bash
# Linux/macOS/Windows (WSL)
curl -sSL https://install.python-poetry.org | python3 -

# Ou via pip
pip install poetry

# Verifique a instalação
poetry --version
```

### Setup com Poetry

```bash
# Clone o repositório
git clone https://github.com/yourusername/oasis-trading-system.git
cd oasis-trading-system

# Configure as variáveis de ambiente
cp .env.example .env
# Edit .env com suas configurações

# Setup completo com Poetry
make setup

# Ou manualmente:
poetry install --with=dev,docs
poetry run pre-commit install

# Ative o ambiente virtual
poetry shell

# Inicie os serviços
make up

# Acesse o dashboard
open http://localhost:3000
```

### Setup com Docker

```bash
# Build e inicie os containers
docker-compose up -d

# Execute as migrações
docker-compose exec api poetry run python scripts/migration/migrate_up.py

# Acesse o dashboard
open http://localhost:3000
```

## 🎯 Uso Básico

### Configurando uma Estratégia

```python
from src.strategies.technical import MomentumStrategy
from src.core.trading.domain.entities import TradingPair

# Configure a estratégia
strategy = MomentumStrategy(
    pair=TradingPair("BTC", "USDT"),
    timeframe="1h",
    lookback_period=20,
    threshold=0.02
)

# Execute backtesting
results = await strategy.backtest(
    start_date="2023-01-01",
    end_date="2023-12-31",
    initial_capital=10000
)

print(f"ROI: {results.roi}%")
print(f"Sharpe Ratio: {results.sharpe_ratio}")
```

### Comandos Poetry Essenciais

```bash
# Gerenciamento de dependências
poetry add fastapi                    # Adicionar dependência
poetry add --group=dev pytest        # Adicionar dependência de desenvolvimento
poetry remove package-name           # Remover dependência
poetry update                        # Atualizar todas as dependências
poetry show                          # Mostrar dependências instaladas
poetry show --tree                   # Mostrar árvore de dependências

# Ambiente virtual
poetry shell                         # Ativar shell do ambiente virtual
poetry run python script.py         # Executar comando no ambiente virtual
poetry env info                      # Informações do ambiente virtual

# Build e publicação
poetry build                         # Construir pacote
poetry publish --dry-run            # Testar publicação

# Exportar requirements (para Docker)
poetry export -f requirements.txt --output requirements.txt --without-hashes
```

### API REST Example

```bash
# Obter status do sistema
curl http://localhost:8000/api/v1/status

# Listar estratégias ativas
curl http://localhost:8000/api/v1/strategies

# Executar uma ordem
curl -X POST http://localhost:8000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "side": "buy",
    "type": "limit",
    "quantity": 0.001,
    "price": 50000
  }'
```

## 📊 Performance Metrics

| Métrica | Target | Atual |
|---------|--------|-------|
| Latência P99 | < 50ms | 45ms |
| Throughput | 10k orders/s | 12k orders/s |
| Uptime | 99.99% | 99.95% |
| Test Coverage | > 80% | 85% |

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│              API Gateway (FastAPI)                   │
└─────────────────┬───────────────────────────────────┘
                  │
        ┌─────────┴─────────┬──────────┬─────────┐
        │                   │          │         │
┌───────▼──────┐ ┌─────────▼──────┐ ┌─▼─────────▼──┐
│   Trading    │ │  Market Data   │ │  Execution   │
│   Service    │ │    Service     │ │   Service    │
└───────┬──────┘ └─────────┬──────┘ └──────┬───────┘
        │                   │                │
┌───────▼───────────────────▼────────────────▼───────┐
│           Message Bus (Kafka/Redis)                 │
└─────────────────────────────────────────────────────┘
        │                   │                │
┌───────▼──────┐ ┌─────────▼──────┐ ┌──────▼───────┐
│  PostgreSQL  │ │   TimescaleDB  │ │    Redis     │
└──────────────┘ └────────────────┘ └──────────────┘
```

## 🧪 Testing

```bash
# Executar todos os testes
make test

# Testes com coverage
make test-cov

# Testes específicos
make test-unit
make test-integration
make test-e2e

# Testes em modo watch
make test-watch

# Usando Poetry diretamente
poetry run pytest
poetry run pytest --cov=src
poetry run pytest tests/unit/
```

## 📈 Monitoring

### Prometheus Metrics
- `ots_orders_total` - Total de ordens executadas
- `ots_latency_seconds` - Latência de execução
- `ots_profit_total` - Lucro acumulado
- `ots_active_positions` - Posições ativas

### Grafana Dashboards
- System Overview
- Trading Performance
- Risk Metrics
- Infrastructure Health

## 🔐 Segurança

- 🔒 Criptografia de API keys com Vault
- 🛡️ Rate limiting e DDoS protection
- 🔐 2FA para acesso ao dashboard
- 📝 Audit logs completos
- 🚫 Princípio do menor privilégio

## 📚 Comandos Make Disponíveis

```bash
# Setup & Installation
make setup              # Setup inicial completo
make install            # Instalar dependências
make install-dev        # Instalar com dependências de desenvolvimento
make update             # Atualizar dependências

# Development
make run-api            # Executar API server
make run-worker         # Executar Celery worker
make jupyter            # Executar Jupyter notebook
make shell              # Ativar Poetry shell

# Code Quality
make lint               # Executar linters
make format             # Formatar código
make type-check         # Verificação de tipos
make security           # Verificações de segurança
make pre-commit         # Executar hooks pre-commit

# Testing
make test               # Executar todos os testes
make test-unit          # Testes unitários
make test-integration   # Testes de integração
make test-cov           # Testes com coverage

# Docker
make build              # Build das imagens Docker
make up                 # Subir todos os serviços
make down               # Parar todos os serviços
make logs               # Ver logs dos serviços

# Database
make db-migrate         # Executar migrações
make db-seed            # Popular banco com dados de exemplo
make db-reset           # Reset completo do banco

# Documentation
make docs               # Build documentação
make docs-serve         # Servir documentação localmente

# Utilities
make clean              # Limpar arquivos gerados
make version            # Mostrar versão
make env                # Mostrar informações do ambiente
```

## 🤝 Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes sobre nosso código de conduta e processo de submissão de pull requests.

### Configuração de Desenvolvimento

```bash
# Clone e setup
git clone <repo-url>
cd oasis-trading-system
make setup

# Instalar hooks de pre-commit
poetry run pre-commit install

# Executar testes antes de commits
make test-cov

# Verificar qualidade do código
make lint
```

## 📝 Licença

Este projeto está licenciado sob a MIT License - veja [LICENSE](./LICENSE) para detalhes.

## 🙏 Agradecimentos

- Poetry pela excelente gestão de dependências
- CCXT pela excelente biblioteca de integração
- TradingView pelos charts
- Comunidade open-source de trading algorítmico

## 📞 Suporte

- 📧 Email: support@oasis-trading.com
- 💬 Discord: [Join our server](https://discord.gg/oasis)
- 📚 Docs: [documentation.oasis-trading.com](https://documentation.oasis-trading.com)

## ⚡ Quick Start

```bash
# One-liner setup
curl -sSL https://raw.githubusercontent.com/oasis-trading/oasis-trading-system/main/scripts/quick-setup.sh | bash

# Ou setup manual
git clone <repo> && cd oasis-trading-system && make setup && make up
```

---

<div align="center">
Built with ❤️ by the Oasis Team using Poetry
</div>