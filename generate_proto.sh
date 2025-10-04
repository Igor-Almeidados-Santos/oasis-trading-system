#!/bin/bash

OUT_DIR="./src/contracts_generated"

mkdir -p $OUT_DIR

echo "Gerando código gRPC a partir de ./contracts/trading_system.proto..."
python3 -m grpc_tools.protoc \
    -I./contracts \
    --python_out=$OUT_DIR \
    --grpc_python_out=$OUT_DIR \
    --pyi_out=$OUT_DIR \
    ./contracts/trading_system.proto

# Corrige os imports no arquivo gerado
echo "Corrigindo imports relativos..."
sed -i 's/^import trading_system_pb2/from . import trading_system_pb2/' $OUT_DIR/trading_system_pb2_grpc.py

touch $OUT_DIR/__init__.py

echo "Código gRPC gerado com sucesso em '$OUT_DIR'"