#!/bin/bash

# --- gen-proto.sh ---
# Este script gera o código Python a partir dos arquivos .proto.

# Sair imediatamente se um comando falhar
set -e

# Diretório raiz do projeto (o diretório pai do diretório 'scripts')
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Diretório dos arquivos .proto de origem
PROTO_SRC_DIR="$BASE_DIR/api/proto"

# Diretório de destino para o código Python gerado
PYTHON_DEST_DIR="$BASE_DIR/components/strategy-framework/src/generated"

# Criar o diretório de destino se ele não existir
mkdir -p "$PYTHON_DEST_DIR"

# Adicionar um arquivo __init__.py para que o Python o reconheça como um módulo
touch "$PYTHON_DEST_DIR/__init__.py"

echo "Gerando código Python a partir dos arquivos .proto..."

if [ -x "$BASE_DIR/.venv/bin/python" ]; then
    PYTHON_BIN="$BASE_DIR/.venv/bin/python"
else
    PYTHON_BIN="python"
fi
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_BIN="python3"
    else
        echo "Python não encontrado. Instale Python ou ajuste o PATH." >&2
        exit 1
    fi
fi

run_protoc() {
    "$1" -m grpc_tools.protoc \
        --proto_path="$PROTO_SRC_DIR" \
        --python_out="$PYTHON_DEST_DIR" \
        --grpc_python_out="$PYTHON_DEST_DIR" \
        "$PROTO_SRC_DIR"/*.proto
}

if ! run_protoc "$PYTHON_BIN"; then
    if command -v poetry >/dev/null 2>&1; then
        echo "Tentando executar via Poetry..."
        POETRY_PROJECT_DIR="$BASE_DIR/components/strategy-framework"
        POETRY_CACHE_DIR="$BASE_DIR/.cache/pypoetry"
        POETRY_VENV_DIR="$BASE_DIR/.poetry-venvs"
        mkdir -p "$POETRY_CACHE_DIR" "$POETRY_VENV_DIR"
        if ! (cd "$POETRY_PROJECT_DIR" && \
            POETRY_CACHE_DIR="$POETRY_CACHE_DIR" \
            POETRY_VIRTUALENVS_PATH="$POETRY_VENV_DIR" \
            poetry run python -c "import grpc_tools" >/dev/null 2>&1); then
            echo "Instalando dependências Python via Poetry..."
            (cd "$POETRY_PROJECT_DIR" && \
                POETRY_CACHE_DIR="$POETRY_CACHE_DIR" \
                POETRY_VIRTUALENVS_PATH="$POETRY_VENV_DIR" \
                poetry install --with dev)
        fi
        (cd "$POETRY_PROJECT_DIR" && \
            POETRY_CACHE_DIR="$POETRY_CACHE_DIR" \
            POETRY_VIRTUALENVS_PATH="$POETRY_VENV_DIR" \
            poetry run python -m grpc_tools.protoc \
                --proto_path="$PROTO_SRC_DIR" \
                --python_out="$PYTHON_DEST_DIR" \
                --grpc_python_out="$PYTHON_DEST_DIR" \
                "$PROTO_SRC_DIR"/*.proto)
    else
        echo "Falha ao executar grpc_tools.protoc e Poetry não está disponível." >&2
        exit 1
    fi
fi

echo "Código gerado com sucesso em: $PYTHON_DEST_DIR"
