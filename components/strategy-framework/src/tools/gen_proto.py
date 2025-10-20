from __future__ import annotations

import sys
from pathlib import Path

try:
    import pkg_resources  # type: ignore
except Exception as _:
    pkg_resources = None  # fallback handled below


def main() -> int:
    try:
        from grpc_tools import protoc  # type: ignore
        import grpc_tools  # type: ignore
    except ImportError:
        print("grpcio-tools não instalado. Instale com: pip install grpcio-tools", file=sys.stderr)
        return 1

    # Executado de qualquer diretório: resolve paths relativos ao repo root
    here = Path(__file__).resolve()
    package_root = here.parents[2]  # components/strategy-framework
    # Repo root é o diretório pai de 'components'
    repo_root = package_root.parents[1]
    proto_src = repo_root / "api" / "proto"
    py_out = package_root / "src" / "generated"

    py_out.mkdir(parents=True, exist_ok=True)
    (py_out / "__init__.py").touch(exist_ok=True)

    proto_file = proto_src / "market_data.proto"
    if not proto_file.exists():
        print(f"Arquivo de proto não encontrado: {proto_file}", file=sys.stderr)
        return 2

    # Inclui o path dos well-known types do protobuf (timestamp.proto, etc.)
    include_paths = []
    try:
        if pkg_resources is not None:
            include_paths.append(pkg_resources.resource_filename('grpc_tools', '_proto'))
    except Exception:
        # Fallback: tenta inferir via localização do pacote
        include_paths.append(str(Path(grpc_tools.__file__).resolve().parent / '_proto'))

    args = [
        "protoc",
        f"--proto_path={proto_src}",
        *[f"--proto_path={p}" for p in include_paths],
        f"--python_out={py_out}",
        f"--grpc_python_out={py_out}",
        str(proto_file),
    ]

    return protoc.main(args)


if __name__ == "__main__":
    raise SystemExit(main())
