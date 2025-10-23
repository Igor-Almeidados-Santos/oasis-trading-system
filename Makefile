# Top-level helpers for Oasis Trading System

.PHONY: help proto rust risk-engine coinbase-connector order-manager strategy-framework data-normalizer kafka-up kafka-down test

help:
	@echo "Targets:"
	@echo "  proto                Gera código protobuf para Python"
	@echo "  rust                 Compila todos os componentes Rust"
	@echo "  coinbase-connector   Executa o conector da Coinbase"
	@echo "  risk-engine          Executa o serviço de risco"
	@echo "  order-manager        Executa o order manager (Go)"
	@echo "  data-normalizer      Executa o normalizador de market data (Rust)"
	@echo "  strategy-framework   Inicia o consumidor/estratégia em Python"
	@echo "  kafka-up             Sobe Kafka + Zookeeper (docker-compose)"
	@echo "  kafka-down           Para Kafka + Zookeeper"
	@echo "  test                 Roda testes dos componentes principais"

proto:
	./scripts/gen-proto.sh

rust:
	cargo build --manifest-path components/coinbase-connector/Cargo.toml
	cargo build --manifest-path components/risk-engine/Cargo.toml

coinbase-connector:
	cd components/coinbase-connector && cargo run

risk-engine:
	cd components/risk-engine && cargo run

order-manager:
	cd components/order-manager && go run .

data-normalizer:
	cd components/data-normalizer && cargo run

strategy-framework:
	cd components/strategy-framework && poetry run python src/consumer.py

kafka-up:
	docker compose up -d zookeeper kafka

kafka-down:
	docker compose down zookeeper kafka

test:
	cargo test --manifest-path components/coinbase-connector/Cargo.toml
	cargo test --manifest-path components/risk-engine/Cargo.toml
	cd components/order-manager && go test ./...
	cd components/strategy-framework && poetry run pytest
