.PHONY: help setup install clean test run build deploy

# Variables
POETRY := poetry
DOCKER_COMPOSE := docker-compose
PROJECT_NAME := oasis-trading-system

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

## Help
help: ## Show this help message
	@echo "$(GREEN)Oasis Trading System - Development Commands (Poetry)$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

## Setup & Installation
setup: ## Initial project setup with Poetry
	@echo "$(GREEN)Setting up Oasis Trading System with Poetry...$(NC)"
	@command -v poetry >/dev/null 2>&1 || { echo "$(RED)Poetry is not installed. Please install it first: https://python-poetry.org/docs/#installation$(NC)" >&2; exit 1; }
	@poetry --version
	@poetry config virtualenvs.create true
	@poetry config virtualenvs.in-project true
	@poetry install --with=dev,docs
	@poetry run pre-commit install
	@mkdir -p logs data backtest_results models checkpoints
	@echo "$(GREEN)Setup complete! Virtual environment is ready.$(NC)"

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies with Poetry...$(NC)"
	@$(POETRY) install

install-dev: ## Install with development dependencies
	@echo "$(GREEN)Installing with development dependencies...$(NC)"
	@$(POETRY) install --with=dev,docs

install-prod: ## Install production dependencies only
	@echo "$(GREEN)Installing production dependencies...$(NC)"
	@$(POETRY) install --only=main

update: ## Update dependencies
	@echo "$(GREEN)Updating dependencies...$(NC)"
	@$(POETRY) update
	@$(POETRY) show --outdated

lock: ## Update lock file
	@echo "$(GREEN)Updating poetry.lock...$(NC)"
	@$(POETRY) lock --no-update

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
	@$(POETRY) run alembic upgrade head

db-rollback: ## Rollback last migration
	@echo "$(YELLOW)Rolling back last migration...$(NC)"
	@$(POETRY) run alembic downgrade -1

db-reset: ## Reset database
	@echo "$(RED)Resetting database...$(NC)"
	@$(POETRY) run alembic downgrade base
	@$(POETRY) run alembic upgrade head

db-seed: ## Seed database with sample data
	@echo "$(GREEN)Seeding database...$(NC)"
	@$(POETRY) run python scripts/seed_database.py

## Testing
test: ## Run all tests
	@echo "$(GREEN)Running tests...$(NC)"
	@$(POETRY) run pytest

test-unit: ## Run unit tests
	@echo "$(GREEN)Running unit tests...$(NC)"
	@$(POETRY) run pytest tests/unit -v

test-integration: ## Run integration tests
	@echo "$(GREEN)Running integration tests...$(NC)"
	@$(POETRY) run pytest tests/integration -v

test-e2e: ## Run end-to-end tests
	@echo "$(GREEN)Running E2E tests...$(NC)"
	@$(POETRY) run pytest tests/e2e -v

test-cov: ## Run tests with coverage
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	@$(POETRY) run pytest --cov=src --cov-report=html --cov-report=term

test-watch: ## Run tests in watch mode
	@echo "$(GREEN)Running tests in watch mode...$(NC)"
	@$(POETRY) run pytest-watch

## Code Quality
lint: ## Run all linters
	@echo "$(GREEN)Running linters...$(NC)"
	@$(POETRY) run black src tests
	@$(POETRY) run isort src tests
	@$(POETRY) run flake8 src tests
	@$(POETRY) run mypy src

format: ## Format code
	@echo "$(GREEN)Formatting code...$(NC)"
	@$(POETRY) run black src tests
	@$(POETRY) run isort src tests

format-check: ## Check code formatting
	@echo "$(GREEN)Checking code formatting...$(NC)"
	@$(POETRY) run black --check src tests
	@$(POETRY) run isort --check-only src tests

type-check: ## Run type checking
	@echo "$(GREEN)Running type checks...$(NC)"
	@$(POETRY) run mypy src

security: ## Run security checks
	@echo "$(GREEN)Running security checks...$(NC)"
	@$(POETRY) run bandit -r src
	@$(POETRY) run safety check

pre-commit: ## Run pre-commit hooks
	@echo "$(GREEN)Running pre-commit hooks...$(NC)"
	@$(POETRY) run pre-commit run --all-files

## Development
shell: ## Open Poetry shell
	@$(POETRY) shell

run-api: ## Run API server locally
	@echo "$(GREEN)Starting API server...$(NC)"
	@$(POETRY) run uvicorn src.api.rest.main:app --reload --host 0.0.0.0 --port 8000

run-worker: ## Run Celery worker locally
	@echo "$(GREEN)Starting Celery worker...$(NC)"
	@$(POETRY) run celery -A src.workers.celery_app worker --loglevel=info

run-scheduler: ## Run Celery beat scheduler
	@echo "$(GREEN)Starting Celery scheduler...$(NC)"
	@$(POETRY) run celery -A src.workers.celery_app beat --loglevel=info

run-flower: ## Run Flower (Celery monitoring)
	@echo "$(GREEN)Starting Flower...$(NC)"
	@$(POETRY) run celery -A src.workers.celery_app flower

jupyter: ## Start Jupyter notebook
	@echo "$(GREEN)Starting Jupyter notebook...$(NC)"
	@$(POETRY) run jupyter notebook

lab: ## Start JupyterLab
	@echo "$(GREEN)Starting JupyterLab...$(NC)"
	@$(POETRY) run jupyter lab

## Dependency Management
add: ## Add a new dependency (usage: make add PACKAGE=package-name)
	@$(POETRY) add $(PACKAGE)

add-dev: ## Add a new dev dependency (usage: make add-dev PACKAGE=package-name)
	@$(POETRY) add --group=dev $(PACKAGE)

remove: ## Remove a dependency (usage: make remove PACKAGE=package-name)
	@$(POETRY) remove $(PACKAGE)

show: ## Show current dependencies
	@$(POETRY) show

show-tree: ## Show dependency tree
	@$(POETRY) show --tree

show-outdated: ## Show outdated dependencies
	@$(POETRY) show --outdated

export-requirements: ## Export requirements.txt for Docker
	@echo "$(GREEN)Exporting requirements.txt...$(NC)"
	@$(POETRY) export -f requirements.txt --output requirements.txt --without-hashes
	@$(POETRY) export -f requirements.txt --output requirements-dev.txt --with=dev --without-hashes

## Monitoring
monitor: ## Open monitoring dashboards
	@echo "$(GREEN)Opening monitoring dashboards...$(NC)"
	@open http://localhost:3001  # Grafana
	@open http://localhost:9090  # Prometheus
	@open http://localhost:5555  # Flower

## Backtest
backtest: ## Run backtesting for all strategies
	@echo "$(GREEN)Running backtests...$(NC)"
	@$(POETRY) run python -m src.backtest.main

backtest-strategy: ## Run backtest for specific strategy (usage: make backtest-strategy STRATEGY=strategy_name)
	@echo "$(GREEN)Running backtest for $(STRATEGY)...$(NC)"
	@$(POETRY) run python -m src.backtest.main --strategy=$(STRATEGY)

## Documentation
docs: ## Build documentation
	@echo "$(GREEN)Building documentation...$(NC)"
	@$(POETRY) run mkdocs build

docs-serve: ## Serve documentation locally
	@echo "$(GREEN)Serving documentation...$(NC)"
	@$(POETRY) run mkdocs serve

docs-deploy: ## Deploy documentation to GitHub Pages
	@echo "$(GREEN)Deploying documentation...$(NC)"
	@$(POETRY) run mkdocs gh-deploy

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

clean-venv: ## Remove virtual environment
	@echo "$(YELLOW)Removing virtual environment...$(NC)"
	@$(POETRY) env remove --all
	@echo "$(GREEN)Virtual environment removed!$(NC)"

reset: clean clean-docker clean-venv ## Full reset (clean everything)
	@echo "$(RED)Full reset complete!$(NC)"

## Utilities
env: ## Show environment information
	@echo "$(GREEN)Environment Information:$(NC)"
	@$(POETRY) --version
	@$(POETRY) env info
	@$(POETRY) config --list

check: ## Check Poetry configuration
	@echo "$(GREEN)Checking Poetry configuration...$(NC)"
	@$(POETRY) check

version: ## Show version
	@echo "$(GREEN)Oasis Trading System v$(shell $(POETRY) version -s)$(NC)"

## Virtual Environment Management
venv-create: ## Create virtual environment
	@echo "$(GREEN)Creating virtual environment...$(NC)"
	@$(POETRY) install

venv-activate: ## Show activation command
	@echo "$(GREEN)To activate virtual environment run:$(NC)"
	@echo "poetry shell"

venv-info: ## Show virtual environment info
	@$(POETRY) env info

venv-list: ## List virtual environments
	@$(POETRY) env list

venv-remove: ## Remove virtual environment
	@$(POETRY) env remove python

## Export & Build
build-package: ## Build package
	@echo "$(GREEN)Building package...$(NC)"
	@$(POETRY) build

publish: ## Publish package (dry run)
	@echo "$(GREEN)Publishing package (dry run)...$(NC)"
	@$(POETRY) publish --dry-run

publish-real: ## Publish package to PyPI
	@echo "$(GREEN)Publishing package to PyPI...$(NC)"
	@$(POETRY) publish