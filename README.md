# 🌊 Oasis Trading System

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen.svg)](https://www.docker.com/)
[![gRPC](https://img.shields.io/badge/gRPC-Protocol-orange.svg)](https://grpc.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Sistema de trading algorítmico modular e de alta performance para criptomoedas, construído sobre arquitetura de microsserviços com comunicação gRPC.

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Uso](#-uso)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Serviços e Componentes](#-serviços-e-componentes)
- [API e Endpoints](#-api-e-endpoints)
- [Monitoramento](#-monitoramento)
- [Backtesting](#-backtesting)
- [Segurança](#-segurança)
- [Troubleshooting](#-troubleshooting)
- [Desenvolvimento](#-desenvolvimento)
- [Roadmap](#-roadmap)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

---

## 📜 Sobre o Projeto

O **Oasis Trading System** é um framework robusto para automação de estratégias de trading de criptomoedas. Desenvolvido com foco em:

- **Modularidade**: Componentes independentes com responsabilidades bem definidas
- **Resiliência**: Recuperação automática de falhas e persistência de estado
- **Escalabilidade**: Arquitetura de microsserviços pronta para crescimento
- **Segurança**: Gestão de risco integrada e validação em múltiplas camadas

### ✨ Funcionalidades Principais

- ✅ **Estratégia de Grid Trading** com níveis configuráveis
- ✅ **Integração com Coinbase Advanced Trade API**
- ✅ **Modo Paper Trading** para simulação sem risco
- ✅ **Gestão de Risco e Posição** em tempo real
- ✅ **Persistência de Dados** em PostgreSQL e MongoDB
- ✅ **Dashboard Web** para monitoramento
- ✅ **Bot do Telegram** para notificações e controle
- ✅ **Motor de Backtesting** para validação de estratégias
- ✅ **WebSocket** para dados de mercado em tempo real

---

## 🏗️ Arquitetura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    OASIS TRADING SYSTEM                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Coinbase WS     │─────▶│ Strategy Engine  │─────▶│   Risk Engine    │
│  (Market Data)   │      │  (Grid Logic)    │ gRPC │  (Validation)    │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                   │                          │
                                   │                          │ gRPC
                                   ▼                          ▼
                          ┌──────────────────┐      ┌──────────────────┐
                          │   PostgreSQL     │      │  Order Executor  │
                          │  (Estado/Ordens) │      │  (Coinbase API)  │
                          └──────────────────┘      └──────────────────┘
                                   ▲                          │
                                   │                          │
                                   │                          ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Frontend       │◀─────│   WebService     │      │   Telegram Bot   │
│   (React/Vite)   │ HTTP │   (FastAPI)      │      │  (Notificações)  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │     MongoDB      │
                          │  (Logs/Métricas) │
                          └──────────────────┘
```

### Fluxo de Execução

1. **Market Data**: WebSocket da Coinbase envia atualizações de preço
2. **Strategy Engine**: Processa preços e gera sinais de trading
3. **Risk Engine**: Valida sinais contra regras de risco (tamanho, exposição)
4. **Order Executor**: Executa ordens aprovadas na Coinbase
5. **Database**: Persiste estado, ordens e execuções
6. **Monitoring**: Dashboard e Telegram Bot fornecem visibilidade

---

## 🔧 Pré-requisitos

### Software Necessário

- **Docker Desktop** (≥20.10.0)
  - [Download para Windows/Mac](https://www.docker.com/products/docker-desktop)
  - Linux: `sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin`
- **Git** para clonar o repositório

### Contas e APIs

1. **Coinbase Advanced Trade Account**
   - Criar conta em [coinbase.com](https://www.coinbase.com)
   - Gerar API Keys em Settings → API
   - ⚠️ Use **Testnet keys** para desenvolvimento

2. **Telegram Bot** (Opcional)
   - Falar com [@BotFather](https://t.me/botfather)
   - Criar novo bot com `/newbot`
   - Obter seu User ID com [@userinfobot](https://t.me/userinfobot)

---

## 📥 Instalação

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/oasis-trading-system.git
cd oasis-trading-system
```

### 2. Configure as Variáveis de Ambiente

```bash
cp .env.template .env
```

Edite o arquivo `.env` com suas credenciais:

```bash
nano .env  # ou vim .env / code .env
```

### 3. Gere o Código gRPC

```bash
chmod +x generate_proto.sh
./generate_proto.sh
```

### 4. Inicie o Sistema

```bash
docker-compose up -d --build
```

### 5. Verifique o Status

```bash
docker-compose ps
docker-compose logs -f
```

---

## ⚙️ Configuração

### Arquivo `.env`

#### Banco de Dados PostgreSQL

```env
POSTGRES_HOST=postgres-db
POSTGRES_DB=oasis_db
POSTGRES_USER=user
POSTGRES_PASSWORD=SenhaSegura123!
DATABASE_URL=postgresql://user:SenhaSegura123!@postgres-db:5432/oasis_db
```

#### MongoDB

```env
MONGO_DB_URI=mongodb://mongodb:27017/
```

#### Coinbase API

```env
# ⚠️ USE TESTNET KEYS PARA DESENVOLVIMENTO
COINBASE_API_KEY=organizations/xxxx/apiKeys/xxxx
COINBASE_PRIVATE_KEY=-----BEGIN EC PRIVATE KEY-----\nXXXX\n-----END EC PRIVATE KEY-----
```

#### Telegram Bot

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ALLOWED_USER_ID=987654321
```

#### Parâmetros da Estratégia

```env
# Produto a ser negociado
STRATEGY_PRODUCT_ID=BTC-USD

# Níveis da grade (quanto maior, mais ordens)
STRATEGY_GRID_LEVELS=10

# Espaçamento entre níveis (em %)
STRATEGY_GRID_SPACING_PCT=0.5

# Tamanho de cada ordem (em BTC)
STRATEGY_ORDER_SIZE=0.0001
```

#### Gestão de Risco

```env
# Tamanho máximo de ordem em USD
RISK_MAX_ORDER_SIZE_USD=100.0

# Drawdown máximo diário (%)
RISK_MAX_DAILY_DRAWDOWN_PCT=5.0

# Alocação máxima de capital (%)
STRATEGY_CAPITAL_ALLOCATION=0.15
```

#### Modo de Execução

```env
# PAPER = Simulação | LIVE = Real
EXECUTION_MODE=PAPER

# URLs dos serviços gRPC
RISK_SERVICE_URL=risk-engine:50051
EXECUTION_SERVICE_URL=order-executor:50051
```

---

## 🚀 Uso

### Acessar o Dashboard

Abra seu navegador em: **http://localhost:3000**

O dashboard exibe:
- Posição atual e PnL
- Valor total do portfólio
- Trades recentes
- Status do sistema

### Comandos do Telegram Bot

```
/start  - Iniciar bot
/status - Ver posição e PnL atual
/trades - Últimas execuções
```

### Gerenciar Containers

```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f strategy-engine

# Parar o sistema
docker-compose down

# Reiniciar um serviço
docker-compose restart risk-engine

# Reconstruir após mudanças no código
docker-compose up -d --build
```

### Parar Emergencialmente

Para parar a estratégia sem derrubar containers:

```bash
touch shared/stop_signal
```

O Strategy Engine detectará o sinal e encerrará as operações.

---

## 📁 Estrutura do Projeto

```
oasis-trading-system/
│
├── contracts/                    # Definições Protocol Buffers
│   └── trading_system.proto
│
├── database/                     # Schemas de banco de dados
│   └── schema.sql
│
├── frontend/                     # Interface React
│   ├── src/
│   │   ├── App.tsx
│   │   └── App.css
│   ├── Dockerfile
│   └── package.json
│
├── src/                          # Código-fonte principal
│   ├── backtester/               # Motor de backtesting
│   │   ├── engine.py
│   │   └── data_provider.py
│   │
│   ├── common/                   # Módulos compartilhados
│   │   └── db_manager.py
│   │
│   ├── contracts_generated/      # Código gRPC gerado
│   │   ├── trading_system_pb2.py
│   │   └── trading_system_pb2_grpc.py
│   │
│   ├── order_executor/           # Serviço de execução
│   │   ├── service.py
│   │   ├── client.py
│   │   └── Dockerfile
│   │
│   ├── risk_engine/              # Serviço de gestão de risco
│   │   ├── service.py
│   │   ├── position_manager.py
│   │   └── Dockerfile
│   │
│   ├── strategy_engine/          # Serviço de estratégia
│   │   ├── service.py
│   │   ├── grid_logic.py
│   │   └── Dockerfile
│   │
│   ├── telegram_bot/             # Bot do Telegram
│   │   ├── service.py
│   │   └── Dockerfile
│   │
│   └── webservice/               # API REST e Dashboard
│       ├── service.py
│       ├── templates/
│       └── Dockerfile
│
├── .env.template                 # Template de variáveis
├── .gitignore
├── docker-compose.yml            # Orquestração de containers
├── generate_proto.sh             # Script para gerar código gRPC
├── pyproject.toml                # Dependências Poetry
├── poetry.lock
├── run_backtest.py               # Script de backtesting
└── README.md
```

---

## 🔨 Serviços e Componentes

### Strategy Engine (Porta: N/A - Internal)

**Responsabilidade**: Implementa a lógica de trading (Grid Strategy)

**Tecnologias**: Python, WebSocket Client, gRPC Client

**Funcionalidades**:
- Conexão WebSocket com Coinbase para dados de mercado
- Gerenciamento de grade de preços
- Geração de sinais de compra/venda
- Persistência de estado no PostgreSQL

**Variáveis de ambiente chave**:
```env
STRATEGY_PRODUCT_ID=BTC-USD
STRATEGY_GRID_LEVELS=10
STRATEGY_GRID_SPACING_PCT=0.5
STRATEGY_ORDER_SIZE=0.0001
```

---

### Risk Engine (Porta: 50051)

**Responsabilidade**: Validação de sinais e gestão de risco

**Tecnologias**: Python, gRPC Server

**Funcionalidades**:
- Validação de tamanho máximo de ordem
- Controle de exposição total
- Cálculo de PnL realizado e não realizado
- Comunicação com Order Executor

**Regras de Risco**:
- **Regra X**: Máxima alocação de capital
- **Regra Y**: Tamanho máximo de ordem
- **Regra Z**: Drawdown máximo diário

---

### Order Executor (Porta: 50052)

**Responsabilidade**: Execução de ordens na exchange

**Tecnologias**: Python, Coinbase Advanced Trade SDK, gRPC Server

**Funcionalidades**:
- Criação de ordens limit buy/sell
- Modo PAPER para simulação
- Persistência de ordens no PostgreSQL
- Gerenciamento de client_order_id único

**Modos de Execução**:
- `PAPER`: Simula ordens sem enviar para exchange
- `LIVE`: Executa ordens reais na Coinbase

---

### WebService (Porta: 8000)

**Responsabilidade**: API REST e servidor do dashboard

**Tecnologias**: FastAPI, Uvicorn, Jinja2

**Endpoints**:
```
GET  /                 - Dashboard HTML
GET  /api/status       - Status da posição
GET  /api/trades       - Trades recentes (em desenvolvimento)
```

---

### Frontend (Porta: 3000)

**Responsabilidade**: Interface de usuário

**Tecnologias**: React, TypeScript, Vite

**Funcionalidades**:
- Visualização de posição e PnL
- Atualização automática a cada 5 segundos
- Design responsivo

---

### Telegram Bot (Porta: N/A - Internal)

**Responsabilidade**: Notificações e controle via Telegram

**Tecnologias**: python-telegram-bot, httpx

**Comandos**:
- `/start` - Ativa o bot
- `/status` - Exibe status da posição
- `/trades` - Lista trades recentes

---

### PostgreSQL (Porta: 5432)

**Responsabilidade**: Persistência de dados transacionais

**Tabelas**:
- `orders`: Registro de todas as ordens
- `fills`: Execuções de ordens
- `strategy_state`: Estado da estratégia

---

### MongoDB (Porta: 27017)

**Responsabilidade**: Armazenamento de logs e métricas

**Coleções**:
- `logs`: Logs do sistema
- `metrics`: Métricas de performance

---

## 🌐 API e Endpoints

### GET /api/status

Retorna o status atual da posição.

**Response**:
```json
{
  "product_id": "BTC-USD",
  "position_size": 0.0025,
  "average_price": 42350.50,
  "realized_pnl": 125.75
}
```

**Exemplo**:
```bash
curl http://localhost:8000/api/status
```

---

## 📊 Monitoramento

### Dashboard Web

Acesse: **http://localhost:3000**

**Métricas Disponíveis**:
- Valor total do portfólio
- PnL realizado e não realizado
- Tamanho da posição
- Preço médio de entrada
- Número de trades

### Logs em Tempo Real

```bash
# Todos os serviços
docker-compose logs -f

# Serviço específico
docker-compose logs -f strategy-engine

# Últimas 100 linhas
docker-compose logs --tail=100 risk-engine
```

### Healthchecks

Todos os serviços possuem healthchecks configurados:

```bash
docker-compose ps
```

---

## 🔄 Backtesting

### Executar Backtesting

```bash
python run_backtest.py
```

### Usar Dados Customizados

1. Crie um arquivo `data.csv` na raiz:

```csv
timestamp,open,high,low,close,volume
2023-01-01 00:00:00,30000,30100,29900,30050,100
2023-01-01 01:00:00,30050,30200,30000,30150,120
...
```

2. Execute o backtest:

```bash
python run_backtest.py
```

### Interpretar Resultados

```
--- Relatório de Performance do Backtest ---
Período Analisado    2023-01-01 a 2023-12-31
Capital Inicial      $1,000.00
Capital Final        $1,350.00
Retorno Total        35.00%
Drawdown Máximo      -8.50%
Total de Trades      142
-------------------------------------------
```

---

## 🔒 Segurança

### Boas Práticas

1. **Nunca commite o arquivo `.env`**
   - Já está no `.gitignore`
   - Contém credenciais sensíveis

2. **Use Testnet para desenvolvimento**
   - Evite usar fundos reais durante testes
   - API Keys da Testnet são gratuitas

3. **Limite exposição de capital**
   - Configure `STRATEGY_CAPITAL_ALLOCATION` conservadoramente
   - Comece com valores baixos em modo LIVE

4. **Monitore constantemente**
   - Use o dashboard e Telegram Bot
   - Configure alertas para eventos críticos

5. **Backup do banco de dados**
   ```bash
   docker-compose exec postgres-db pg_dump -U user oasis_db > backup.sql
   ```

### Rotação de Credenciais

Se suas chaves foram expostas:

1. Revogue as chaves antigas na Coinbase
2. Gere novas chaves
3. Atualize o `.env`
4. Reinicie os containers:
   ```bash
   docker-compose restart
   ```

---

## 🐛 Troubleshooting

### Problema: Containers não iniciam

**Sintomas**: `docker-compose up` falha

**Soluções**:
```bash
# Verificar logs
docker-compose logs

# Limpar e reconstruir
docker-compose down -v
docker-compose up -d --build
```

---

### Problema: Erro de conexão com PostgreSQL

**Sintomas**: `could not connect to server`

**Soluções**:
```bash
# Verificar se o container está rodando
docker-compose ps postgres-db

# Ver logs do PostgreSQL
docker-compose logs postgres-db

# Reiniciar o serviço
docker-compose restart postgres-db
```

---

### Problema: WebSocket desconecta constantemente

**Sintomas**: Logs mostram reconexões frequentes

**Soluções**:
- Verificar conexão de internet
- Confirmar que a API Key está válida
- Verificar limites de rate da Coinbase API

---

### Problema: Ordens não são executadas em modo LIVE

**Soluções**:
1. Confirme que `EXECUTION_MODE=LIVE`
2. Verifique se as API Keys estão corretas
3. Confirme que tem saldo suficiente na conta
4. Verifique logs do Order Executor:
   ```bash
   docker-compose logs order-executor
   ```

---

### Problema: Dashboard não carrega

**Sintomas**: Erro 404 ou página em branco

**Soluções**:
```bash
# Verificar se o frontend está rodando
docker-compose ps frontend

# Reconstruir o frontend
docker-compose up -d --build frontend

# Ver logs
docker-compose logs frontend
```

---

### Problema: Telegram Bot não responde

**Soluções**:
1. Verificar token no `.env`
2. Confirmar User ID correto
3. Ver logs do bot:
   ```bash
   docker-compose logs telegram-bot
   ```

---

## 💻 Desenvolvimento

### Setup Local

```bash
# Instalar Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Instalar dependências
poetry install

# Ativar ambiente virtual
poetry shell
```

### Modificar Contratos gRPC

1. Edite `contracts/trading_system.proto`
2. Regenere o código:
   ```bash
   ./generate_proto.sh
   ```
3. Reinicie os serviços afetados

### Adicionar Nova Estratégia

1. Crie arquivo em `src/strategy_engine/`
2. Implemente interface similar a `grid_logic.py`
3. Atualize `service.py` para usar nova estratégia
4. Teste com backtesting primeiro

### Testes

```bash
# Executar testes (quando implementados)
poetry run pytest

# Com cobertura
poetry run pytest --cov=src
```

### Lint e Formatação

```bash
# Formatar código
poetry run black src/

# Verificar types
poetry run mypy src/
```

---

## 🗺️ Roadmap

### Versão 0.2.0 (Próxima Release)

- [ ] Implementar estratégia de Mean Reversion
- [ ] Adicionar suporte a múltiplos produtos
- [ ] Gráficos de performance no dashboard
- [ ] Exportação de relatórios em PDF
- [ ] Alertas configuráveis via Telegram

### Versão 0.3.0

- [ ] Machine Learning para otimização de parâmetros
- [ ] Suporte a outras exchanges (Binance, Kraken)
- [ ] API pública para integração externa
- [ ] Sistema de plugins para estratégias

### Versão 1.0.0

- [ ] Interface gráfica para configuração
- [ ] Backtesting com otimização genética
- [ ] Modo de alta frequência (HFT)
- [ ] Documentação completa da API

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

### Como Contribuir

1. Fork o repositório
2. Crie uma branch para sua feature:
   ```bash
   git checkout -b feature/MinhaNovaFeature
   ```
3. Commit suas mudanças:
   ```bash
   git commit -m 'Adiciona MinhaNovaFeature'
   ```
4. Push para a branch:
   ```bash
   git push origin feature/MinhaNovaFeature
   ```
5. Abra um Pull Request

### Guidelines

- Siga o estilo de código existente
- Adicione testes para novas funcionalidades
- Atualize a documentação conforme necessário
- Mantenha commits atômicos e descritivos

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License**.

```
MIT License

Copyright (c) 2025 Oasis Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## ⚠️ Disclaimer

**AVISO IMPORTANTE**:

Este software é fornecido **"como está"**, para fins **educacionais e de uso pessoal**.

- O trading de criptomoedas envolve **riscos financeiros significativos**
- Você pode **perder todo o capital investido**
- O autor e contribuidores **NÃO se responsabilizam** por quaisquer perdas financeiras
- **Não somos consultores financeiros** - faça sua própria pesquisa (DYOR)
- **Use por sua conta e risco**

**Recomendações**:
- Comece sempre com **modo PAPER**
- Use **fundos que você pode perder**
- Teste extensivamente antes de usar capital real
- Nunca invista mais do que pode perder

---

## 📞 Contato e Suporte

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/oasis-trading-system/issues)
- **Discussões**: [GitHub Discussions](https://github.com/seu-usuario/oasis-trading-system/discussions)
- **Email**: seu-email@example.com

---

## 🙏 Agradecimentos

- [Coinbase](https://www.coinbase.com) - API de trading
- [gRPC](https://grpc.io) - Framework de comunicação
- [FastAPI](https://fastapi.tiangolo.com) - Framework web
- [React](https://react.dev) - Biblioteca frontend
- Comunidade open-source

---

<div align="center">

**Desenvolvido com ❤️ para a comunidade de trading algorítmico**

⭐ Se este projeto foi útil, considere dar uma estrela no GitHub!

</div>