Param(
    [string]$ProtoSrc = "api/proto",
    [string]$PyOut = "components/strategy-framework/src/generated"
)

Write-Host "Gerando código Python a partir dos .proto..."

if (-not (Test-Path $ProtoSrc)) {
    throw "Diretório de protos não encontrado: $ProtoSrc"
}

if (-not (Test-Path $PyOut)) {
    New-Item -ItemType Directory -Force -Path $PyOut | Out-Null
}

$init = Join-Path $PyOut "__init__.py"
if (-not (Test-Path $init)) { New-Item -ItemType File -Path $init | Out-Null }

python -m grpc_tools.protoc `
    --proto_path=$ProtoSrc `
    --proto_path=$(python - << 'PY'
import pkg_resources
print(pkg_resources.resource_filename('grpc_tools', '_proto'))
PY
) `
    --python_out=$PyOut `
    --grpc_python_out=$PyOut `
    $ProtoSrc\market_data.proto

Write-Host "Código gerado em: $PyOut"
