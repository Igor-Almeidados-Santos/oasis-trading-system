#!/bin/bash

# Define o diretório de saída para o código gerado. É uma boa prática
# isolar o código gerado automaticamente do código escrito manualmente.
OUT_DIR="./src/contracts_generated"

# 1. Cria o diretório de saída, se ele não existir.
# O '-p' garante que não haverá erro se o diretório já existir e
# cria diretórios pais se necessário (ex: se 'src' não existir).
mkdir -p $OUT_DIR

# 2. Executa o compilador do Protobuf para gRPC
echo "Gerando código gRPC a partir de ./contracts/trading_system.proto..."
python3 -m grpc_tools.protoc \
    -I./contracts \
    --python_out=$OUT_DIR \
    --grpc_python_out=$OUT_DIR \
    ./contracts/trading_system.proto

# 3. Cria um arquivo __init__.py no diretório de saída
# para que ele seja tratado como um pacote Python.
# Isso permitirá importações como: from contracts_generated import ...
touch $OUT_DIR/__init__.py

echo "Código gRPC gerado com sucesso em '$OUT_DIR'"