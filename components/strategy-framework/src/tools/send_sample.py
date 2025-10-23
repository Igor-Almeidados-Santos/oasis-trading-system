import os
import time
import logging
import argparse
from typing import Optional

from confluent_kafka import Producer
from generated import market_data_pb2
from google.protobuf.timestamp_pb2 import Timestamp


logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def build_trade(symbol: str, price: str, qty: str, side: str, trade_id: Optional[str] = None) -> bytes:
    now = Timestamp()
    now.GetCurrentTime()

    mde = market_data_pb2.MarketDataEvent()
    mde.header.exchange = "coinbase"
    mde.header.symbol = symbol
    mde.header.exchange_timestamp.CopyFrom(now)
    mde.header.received_timestamp.CopyFrom(now)

    mde.trade_update.trade_id = trade_id or str(int(time.time() * 1000))
    mde.trade_update.price = price
    mde.trade_update.quantity = qty
    mde.trade_update.side = side

    return mde.SerializeToString()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Envia uma mensagem MarketDataEvent (trade_update) para o Kafka")
    parser.add_argument("--brokers", default=os.environ.get("KAFKA_BROKERS", "localhost:9092"), help="Bootstrap servers do Kafka")
    parser.add_argument("--topic", default=os.environ.get("KAFKA_TOPIC", "market-data.trades.coinbase"), help="Tópico de destino")
    parser.add_argument("--symbol", default=os.environ.get("SYMBOL", "BTC-USD"), help="Símbolo do ativo")
    parser.add_argument("--price", default=os.environ.get("PRICE", "10000"), help="Preço (string)")
    parser.add_argument("--qty", "--quantity", dest="quantity", default=os.environ.get("QTY", "0.01"), help="Quantidade (string)")
    parser.add_argument("--side", choices=["BUY", "SELL"], default=os.environ.get("SIDE", "BUY"), help="Lado da operação")
    parser.add_argument("--count", type=int, default=1, help="Quantas mensagens enviar")
    parser.add_argument("--interval", type=float, default=0.0, help="Intervalo entre mensagens (segundos)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    p = Producer({"bootstrap.servers": args.brokers})

    for i in range(args.count):
        payload = build_trade(
            symbol=args.symbol,
            price=args.price,
            qty=args.quantity,
            side=args.side,
            trade_id=None,
        )
        log.info("Enviando mensagem %d/%d para %s", i + 1, args.count, args.topic)
        p.produce(args.topic, value=payload)
        p.flush(5)
        if i + 1 < args.count and args.interval > 0:
            time.sleep(args.interval)
    log.info("Envio concluído.")


if __name__ == "__main__":
    main()
