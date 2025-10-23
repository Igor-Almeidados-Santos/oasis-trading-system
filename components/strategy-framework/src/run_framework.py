import asyncio
import logging
import os
from confluent_kafka import Consumer, KafkaError, KafkaException

from generated import market_data_pb2
from strategies.momentum import SimpleMomentum


logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092")
KAFKA_TOPIC = os.environ.get("KAFKA_TOPIC", "market-data.trades.normalized")
GROUP_ID = os.environ.get("GROUP_ID", "strategy-framework-group")
SYMBOL = os.environ.get("STRATEGY_SYMBOL", "BTC-USD")


async def main() -> None:
    strategy = SimpleMomentum("simple-momentum", SYMBOL)

    conf = {
        "bootstrap.servers": KAFKA_BROKERS,
        "group.id": GROUP_ID,
        "auto.offset.reset": "latest",
    }
    consumer = Consumer(conf)
    log.info("Framework iniciado. Aguardando mensagens de %s...", KAFKA_TOPIC)

    try:
        consumer.subscribe([KAFKA_TOPIC])

        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                await asyncio.sleep(0.5)
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    log.info("EOF %s[%s]", msg.topic(), msg.partition())
                else:
                    raise KafkaException(msg.error())
                continue

            mde = market_data_pb2.MarketDataEvent()
            mde.ParseFromString(msg.value())

            if mde.WhichOneof("payload") == "trade_update":
                signals = await strategy.on_trade(mde.trade_update, mde.header)
                for s in signals:
                    log.warning(
                        "Sinal: strategy=%s symbol=%s side=%s conf=%.2f",
                        s.strategy_id,
                        s.symbol,
                        s.side,
                        s.confidence,
                    )
    finally:
        consumer.close()
        log.info("Framework encerrado.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Encerrado pelo usuário.")
