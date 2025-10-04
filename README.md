# 🌊 Oasis Trading System

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen.svg)](https://www.docker.com/)
[![gRPC](https://img.shields.io/badge/gRPC-Protocol-orange.svg)](https://grpc.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Framework modular e de alta performance para automação de estratégias de trading de criptomoedas, construído sobre uma arquitetura de microsserviços.

---

## 📜 Sobre o Projeto

O **Oasis Trading System** é um sistema de trading algorítmico robusto, resiliente e extensível, desenvolvido para uso pessoal. Ele separa responsabilidades em componentes independentes que se comunicam via **gRPC**, garantindo baixo acoplamento e alta coesão. 

A versão atual implementa uma estratégia de **Grid Trading** para a exchange **Coinbase**, com persistência de dados, gestão de risco e um painel de controle para monitoramento em tempo real.

---

## ✨ Funcionalidades Principais

- **🏗️ Arquitetura de Microsserviços**: Sistema dividido em componentes independentes (Strategy, Risk, Execution, UI), cada um rodando em seu próprio contêiner Docker

- **📊 Estratégia de Grid Trading**: Implementa uma estratégia de grade ideal para mercados voláteis, com estado persistente para recuperação após reinicializações

- **🔗 Integração com Coinbase**: Conexão com Coinbase Advanced Trade API para execução de ordens reais ou em modo de simulação (Paper Trading)

- **💾 Persistência de Dados**: Banco de dados PostgreSQL para armazenar ordens, execuções e estado da estratégia, garantindo zero perda de dados

- **⚖️ Gestão de Risco e Posição**: PositionManager calcula posição atual e PnL em tempo real, permitindo que o RiskEngine aplique regras sobre tamanho de ordem e exposição total

- **🖥️ Painel de Controle Web**: Interface acessível via navegador para monitorar posição, PnL e acionar "Kill Switch" de emergência

- **🔄 Motor de Backtesting**: Ferramenta offline para simular performance da estratégia contra dados históricos, validando e otimizando parâmetros

---

## 🏗️ Arquitetura do Sistema

O sistema é composto por cinco serviços principais orquestrados pelo Docker Compose:

```
[Dados de Mercado (Coinbase WS)]
      |
      v
+-------------------+      +----------------+      +------------------+      +----------------+
|  StrategyEngine   |----->|   RiskEngine   |----->|  OrderExecutor   |----->|  Coinbase API  |
| (Lógica do Grid)  | gRPC | (Regras X,Y,Z) | gRPC | (Execução Real)  | REST |                |
+-------------------+      +----------------+      +------------------+      +----------------+
      ^ |                        ^ |                       ^ |
      | |                        | |                       | |
      v +------------------------v +-----------------------v +-------> [PostgreSQL DB]
                                   ^                                (Estado, Ordens, Fills)
                                   |
                       +-------------------+
                       |   ControlPanel    |
                       |  (Web UI & API)   |
                       +-------------------+
```

---

## 🛠️ Tech Stack

| Componente | Tecnologia |
|-----------|-----------|
| **Linguagem** | Python 3.11+ |
| **Containerização** | Docker & Docker Compose |
| **Comunicação** | gRPC (Protocol Buffers) |
| **Banco de Dados** | PostgreSQL 15 |
| **Web Service** | Flask |
| **WebSocket** | websocket-client |
| **Análise de Dados** | Pandas |
| **Dependências** | Poetry |

---

## 🚀 Começando

### Pré-requisitos

- **Git**: Para clonar o repositório
- **Docker e Docker Compose**: Recomendado instalar via [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 📥 Instalação

#### 1. Clone o repositório

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd oasis-trading-system
```

#### 2. Configure suas credenciais

Crie uma cópia do arquivo template e configure suas variáveis de ambiente:

```bash
cp .env.template .env
```

⚠️ **ALERTA DE SEGURANÇA**: 
- Edite o arquivo `.env` e preencha com suas próprias chaves de API da Coinbase e credenciais do banco de dados
- **NUNCA** compartilhe ou faça commit deste arquivo
- O arquivo já está incluído no `.gitignore` por segurança

#### 3. Gere o código gRPC

Compile o arquivo `.proto` e crie o código Python para comunicação entre serviços:

```bash
chmod +x generate_proto.sh
./generate_proto.sh
```

#### 4. Construa e inicie os contêineres

```bash
docker-compose up -d --build
```

Este comando irá construir as imagens de todos os serviços e iniciá-los em background.

---

## ⚙️ Uso do Sistema

### 🖥️ Painel de Controle

Após a inicialização bem-sucedida:

1. Abra seu navegador e acesse: **http://localhost:5000**
2. O painel exibirá status da posição e PnL em tempo real (atualização a cada 5 segundos)
3. Use o botão **EMERGENCY STOP** para parar a estratégia de forma segura

### 🔄 Executando o Backtester

Para testar a estratégia contra dados históricos:

```bash
python run_backtest.py
```

> **Opcional**: Crie um arquivo `data.csv` na raiz do projeto com dados de preço para simulação mais precisa

### 📊 Monitorando os Logs

Ver logs de todos os serviços:
```bash
docker-compose logs -f
```

Ver logs de um serviço específico:
```bash
docker-compose logs -f strategy-engine
```

### 🛑 Parando o Sistema

```bash
docker-compose down
```

---

## 📁 Estrutura do Projeto

```
.
├── contracts/              # Definições do Protocol Buffers (*.proto)
├── database/               # Scripts SQL para schema do banco de dados
├── src/                    # Código-fonte principal dos microsserviços
│   ├── backtester/         # Motor de backtesting
│   ├── common/             # Módulos compartilhados (ex: db_manager)
│   ├── control_panel/      # Serviço web Flask (UI)
│   ├── contracts_generated/# Código Python gerado pelo gRPC
│   ├── order_executor/     # Execução de ordens (integração com exchange)
│   ├── risk_engine/        # Gestão de risco e posição
│   └── strategy_engine/    # Estratégia de trading e conexão de dados
├── .env.template           # Template para variáveis de ambiente
├── docker-compose.yml      # Orquestração de todos os serviços
├── generate_proto.sh       # Script para compilar contratos gRPC
├── pyproject.toml          # Definição do projeto e dependências
└── run_backtest.py         # Ponto de entrada para backtesting
```

---

## ⚖️ Disclaimer

⚠️ **AVISO IMPORTANTE**:

Este software é fornecido **"como está"**, para fins **educacionais e de uso pessoal**.

- O trading de criptomoedas envolve **riscos financeiros significativos**
- O autor e contribuidores **NÃO se responsabilizam** por quaisquer perdas financeiras resultantes do uso deste software
- **Use por sua conta e risco**

---

## 📝 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

**Desenvolvido com ❤️ para a comunidade de trading algorítmico**