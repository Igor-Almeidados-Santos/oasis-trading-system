#!/bin/bash

# --- gen-proto.sh ---
# Este script gera o código Python a partir dos arquivos .proto.

# Sair imediatamente se um comando falhar
set -e

# Diretório raiz do projeto (o diretório pai do diretório 'scripts')
BASE_DIR=$(dirname "$0")/..

# Diretório dos arquivos .proto de origem
PROTO_SRC_DIR="$BASE_DIR/api/proto"

# Diretório de destino para o código Python gerado
PYTHON_DEST_DIR="$BASE_DIR/components/strategy-framework/src/generated"

# Criar o diretório de destino se ele não existir
mkdir -p "$PYTHON_DEST_DIR"

# Adicionar um arquivo __init__.py para que o Python o reconheça como um módulo
touch "$PYTHON_DEST_DIR/__init__.py"

echo "Gerando código Python a partir dos arquivos .proto..."

# Executar o compilador protoc
python -m grpc_tools.protoc \
    --proto_path="$PROTO_SRC_DIR" \
    --python_out="$PYTHON_DEST_DIR" \
    --grpc_python_out="$PYTHON_DEST_DIR" \
    "$PROTO_SRC_DIR"/*.proto

echo "Código gerado com sucesso em: $PYTHON_DEST_DIR"