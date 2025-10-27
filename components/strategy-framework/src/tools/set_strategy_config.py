import argparse
import json
import logging
import os

from confluent_kafka import Producer


logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def str_to_bool(value: str) -> bool:
    lowered = value.lower()
    if lowered in {"true", "t", "1", "yes", "y"}:
        return True
    if lowered in {"false", "f", "0", "no", "n"}:
        return False
    raise argparse.ArgumentTypeError(f"Valor booleano inválido: {value}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Envia um comando SET_STRATEGY_CONFIG para o Strategy Framework via Kafka."
    )
    parser.add_argument(
        "--brokers",
        default=os.getenv("KAFKA_BROKERS", "localhost:9092"),
        help="Bootstrap servers do Kafka (default: %(default)s)",
    )
    parser.add_argument(
        "--topic",
        default=os.getenv("CONTROL_COMMAND_TOPIC", "control.commands"),
        help="Tópico de comandos (default: %(default)s)",
    )
    parser.add_argument(
        "--strategy-id",
        default=os.getenv("STRATEGY_ID", "momentum-001"),
        help="Identifier da estratégia alvo (default: %(default)s)",
    )
    parser.add_argument(
        "--mode",
        default="PAPER",
        choices=["REAL", "PAPER"],
        type=lambda value: value.upper(),
        help="Modo desejado (REAL ou PAPER) (default: %(default)s)",
    )
    parser.add_argument(
        "--enabled",
        type=str_to_bool,
        default=None,
        help="Define se a estratégia deve ficar ativa (true/false). Se omitido, mantém o estado atual.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    producer = Producer({"bootstrap.servers": args.brokers})

    payload: dict[str, object] = {
        "strategy_id": args.strategy_id,
        "mode": args.mode,
    }
    if args.enabled is not None:
        payload["enabled"] = args.enabled

    command = {"command": "SET_STRATEGY_CONFIG", "payload": payload}
    message = json.dumps(command).encode("utf-8")

    log.info(
        "Enviando comando SET_STRATEGY_CONFIG (strategy_id=%s, mode=%s, enabled=%s) para %s",
        args.strategy_id,
        args.mode,
        payload.get("enabled"),
        args.topic,
    )
    producer.produce(args.topic, key=args.strategy_id.encode("utf-8"), value=message)
    producer.flush(5.0)
    log.info("Comando enviado.")


if __name__ == "__main__":
    main()
