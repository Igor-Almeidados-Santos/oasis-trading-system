# 🌟 Oasis Trading System (OTS)

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
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
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Setup com Docker

```bash
# Clone o repositório
git clone https://github.com/yourusername/oasis-trading-system.git
cd oasis-trading-system

# Configure as variáveis de ambiente
cp .env.example .env
# Edit .env com suas configurações

# Build e inicie os containers
docker-compose up -d

# Execute as migrações
docker-compose exec api python scripts/migration/migrate_up.py

# Acesse o dashboard
open http://localhost:3000
```

### Setup Manual

```bash
# Crie o ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Instale as dependências
pip install -r requirements.txt

# Configure o banco de dados
python scripts/setup_database.py

# Inicie o servidor API
uvicorn src.api.rest.main:app --reload --host 0.0.0.0 --port 8000

# Em outro terminal, inicie o frontend
cd frontend
npm install
npm run dev
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
results = strategy.backtest(
    start_date="2023-01-01",
    end_date="2023-12-31",
    initial_capital=10000
)

print(f"ROI: {results.roi}%")
print(f"Sharpe Ratio: {results.sharpe_ratio}")
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
pytest

# Testes com coverage
pytest --cov=src tests/

# Testes específicos
pytest tests/unit/core/
pytest tests/integration/
pytest tests/e2e/

# Testes de performance
python tests/performance/latency_test.py
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

## 🤝 Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes sobre nosso código de conduta e processo de submissão de pull requests.

## 📝 Licença

Este projeto está licenciado sob a MIT License - veja [LICENSE](./LICENSE) para detalhes.

## 🙏 Agradecimentos

- CCXT pela excelente biblioteca de integração
- TradingView pelos charts
- Comunidade open-source de trading algorítmico

## 📞 Suporte

- 📧 Email: support@oasis-trading.com
- 💬 Discord: [Join our server](https://discord.gg/oasis)
- 📚 Docs: [documentation.oasis-trading.com](https://documentation.oasis-trading.com)

---

<div align="center">
Built with ❤️ by the Oasis Team
</div>