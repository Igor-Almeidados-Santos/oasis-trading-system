.PHONY: help setup install clean test run build deploy

# Variables
PYTHON := python3.11
PIP := $(PYTHON) -m pip
DOCKER_COMPOSE := docker-compose
PROJECT_NAME := oasis-trading-system
VENV := venv

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

## Help
help: ## Show this help message
	@echo "$(GREEN)Oasis Trading System - Development Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

## Setup
setup: ## Initial project setup
	@echo "$(GREEN)Setting up Oasis Trading System...$(NC)"
	@cp .env.example .env
	@$(PYTHON) -m venv $(VENV)
	@. $(VENV)/bin/activate && $(PIP) install --upgrade pip setuptools wheel
	@. $(VENV)/bin/activate && $(PIP) install -r requirements.txt
	@. $(VENV)/bin/activate && $(PIP) install -r requirements-dev.txt
	@. $(VENV)/bin/activate && pre-commit install
	@mkdir -p logs data backtest_results models checkpoints
	@echo "$(GREEN)Setup complete! Activate venv with: source venv/bin/activate$(NC)"

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	@. $(VENV)/bin/activate && $(PIP) install -r requirements.txt
	@. $(VENV)/bin/activate && $(PIP) install -r requirements-dev.txt

install-dev: ## Install development dependencies
	@echo "$(GREEN)Installing development dependencies...$(NC)"
	@. $(VENV)/bin/activate && $(PIP) install -e .

## Docker Commands
build: ## Build Docker images
	@echo "$(GREEN)Building Docker images...$(NC)"
	@$(DOCKER_COMPOSE) build

up: ## Start all services with Docker Compose
	@echo "$(GREEN)Starting services...$(NC)"
	@$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "API: http://localhost:8000"
	@echo "Grafana: http://localhost:3001"
	@echo "Kafka UI: http://localhost:8080"

down: ## Stop all services
	@echo "$(YELLOW)Stopping services...$(NC)"
	@$(DOCKER_COMPOSE) down

restart: ## Restart all services
	@echo "$(YELLOW)Restarting services...$(NC)"
	@$(DOCKER_COMPOSE) restart

logs: ## Show logs from all services
	@$(DOCKER_COMPOSE) logs -f

logs-api: ## Show API logs
	@$(DOCKER_COMPOSE) logs -f api

logs-worker: ## Show worker logs
	@$(DOCKER_COMPOSE) logs -f worker

ps: ## Show running containers
	@$(DOCKER_COMPOSE) ps

## Database
db-migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	@. $(VENV)/bin/activate && alembic upgrade head

db-rollback: ## Rollback last migration
	@echo "$(YELLOW)Rolling back last migration...$(NC)"
	@. $(VENV)/bin/activate && alembic downgrade -1

db-reset: ## Reset database
	@echo "$(RED)Resetting database...$(NC)"
	@. $(VENV)/bin/activate && alembic downgrade base
	@. $(VENV)/bin/activate && alembic upgrade head

db-seed: ## Seed database with sample data
	@echo "$(GREEN)Seeding database...$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) scripts/seed_database.py

## Testing
test: ## Run all tests
	@echo "$(GREEN)Running tests...$(NC)"
	@. $(VENV)/bin/activate && pytest

test-unit: ## Run unit tests
	@echo "$(GREEN)Running unit tests...$(NC)"
	@. $(VENV)/bin/activate && pytest tests/unit -v

test-integration: ## Run integration tests
	@echo "$(GREEN)Running integration tests...$(NC)"
	@. $(VENV)/bin/activate && pytest tests/integration -v

test-e2e: ## Run end-to-end tests
	@echo "$(GREEN)Running E2E tests...$(NC)"
	@. $(VENV)/bin/activate && pytest tests/e2e -v

test-cov: ## Run tests with coverage
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	@. $(VENV)/bin/activate && pytest --cov=src --cov-report=html --cov-report=term

## Code Quality
lint: ## Run linters
	@echo "$(GREEN)Running linters...$(NC)"
	@. $(VENV)/bin/activate && black src tests
	@. $(VENV)/bin/activate && isort src tests
	@. $(VENV)/bin/activate && flake8 src tests
	@. $(VENV)/bin/activate && mypy src

format: ## Format code
	@echo "$(GREEN)Formatting code...$(NC)"
	@. $(VENV)/bin/activate && black src tests
	@. $(VENV)/bin/activate && isort src tests

security: ## Run security checks
	@echo "$(GREEN)Running security checks...$(NC)"
	@. $(VENV)/bin/activate && bandit -r src
	@. $(VENV)/bin/activate && safety check

## Development
run-api: ## Run API server locally
	@echo "$(GREEN)Starting API server...$(NC)"
	@. $(VENV)/bin/activate && uvicorn src.api.rest.main:app --reload --host 0.0.0.0 --port 8000

run-worker: ## Run Celery worker locally
	@echo "$(GREEN)Starting Celery worker...$(NC)"
	@. $(VENV)/bin/activate && celery -A src.workers.celery_app worker --loglevel=info

run-scheduler: ## Run Celery beat scheduler
	@echo "$(GREEN)Starting Celery scheduler...$(NC)"
	@. $(VENV)/bin/activate && celery -A src.workers.celery_app beat --loglevel=info

run-flower: ## Run Flower (Celery monitoring)
	@echo "$(GREEN)Starting Flower...$(NC)"
	@. $(VENV)/bin/activate && celery -A src.workers.celery_app flower

jupyter: ## Start Jupyter notebook
	@echo "$(GREEN)Starting Jupyter notebook...$(NC)"
	@. $(VENV)/bin/activate && jupyter notebook

## Monitoring
monitor: ## Open monitoring dashboards
	@echo "$(GREEN)Opening monitoring dashboards...$(NC)"
	@open http://localhost:3001  # Grafana
	@open http://localhost:9090  # Prometheus
	@open http://localhost:5555  # Flower

## Backtest
backtest: ## Run backtesting for all strategies
	@echo "$(GREEN)Running backtests...$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) -m src.backtest.main

## Documentation
docs: ## Build documentation
	@echo "$(GREEN)Building documentation...$(NC)"
	@. $(VENV)/bin/activate && mkdocs build

docs-serve: ## Serve documentation locally
	@echo "$(GREEN)Serving documentation...$(NC)"
	@. $(VENV)/bin/activate && mkdocs serve

## Deployment
deploy-staging: ## Deploy to staging
	@echo "$(YELLOW)Deploying to staging...$(NC)"
	@./scripts/deployment/deploy.sh staging

deploy-prod: ## Deploy to production
	@echo "$(RED)Deploying to production...$(NC)"
	@echo "$(RED)Are you sure? [y/N]$(NC)"
	@read -r REPLY; \
	if [ "$$REPLY" = "y" ]; then \
		./scripts/deployment/deploy.sh production; \
	fi

## Cleanup
clean: ## Clean up generated files
	@echo "$(YELLOW)Cleaning up...$(NC)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete
	@find . -type f -name "*.pyo" -delete
	@find . -type f -name ".coverage" -delete
	@rm -rf htmlcov .pytest_cache .mypy_cache
	@rm -rf dist build *.egg-info
	@echo "$(GREEN)Cleanup complete!$(NC)"

clean-docker: ## Clean Docker resources
	@echo "$(YELLOW)Cleaning Docker resources...$(NC)"
	@$(DOCKER_COMPOSE) down -v
	@docker system prune -f
	@echo "$(GREEN)Docker cleanup complete!$(NC)"

reset: clean clean-docker ## Full reset (clean everything)
	@echo "$(RED)Full reset complete!$(NC)"

## Utilities
shell: ## Open Python shell with project context
	@. $(VENV)/bin/activate && $(PYTHON) -c "from src import *; import IPython; IPython.embed()"

db-shell: ## Open database shell
	@docker exec -it ots-postgres psql -U oasis -d oasis_trading

redis-cli: ## Open Redis CLI
	@docker exec -it ots-redis redis-cli

version: ## Show version
	@echo "$(GREEN)Oasis Trading System v1.0.0$(NC)"