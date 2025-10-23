#!/usr/bin/env bash

# Build all executable components for local validation.
# Usage: ./scripts/build.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building Rust crates"
cargo build --manifest-path "$ROOT_DIR/components/coinbase-connector/Cargo.toml"
cargo build --manifest-path "$ROOT_DIR/components/risk-engine/Cargo.toml"

echo "==> Building Go order manager"
pushd "$ROOT_DIR/components/order-manager" >/dev/null
go build ./...
popd >/dev/null

echo "==> Installing Python dependencies"
pushd "$ROOT_DIR/components/strategy-framework" >/dev/null
poetry install --no-root
poetry run gen-proto
popd >/dev/null

echo "Build pipeline finished."
