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
FRAMEWORK_KAFKA_CHECK_ATTEMPTS = int(os.environ.get("FRAMEWORK_KAFKA_CHECK_ATTEMPTS", "12"))
FRAMEWORK_KAFKA_CHECK_BACKOFF_MS = int(os.environ.get("FRAMEWORK_KAFKA_CHECK_BACKOFF_MS", "5000"))


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
        # Aguarda Kafka e disponibilidade do tópico antes de subscrever
        if not await wait_for_kafka_topic(consumer, KAFKA_TOPIC, FRAMEWORK_KAFKA_CHECK_ATTEMPTS, FRAMEWORK_KAFKA_CHECK_BACKOFF_MS):
            log.error("Kafka/tópico indisponível após tentativas. Encerrando.")
            return
        consumer.subscribe([KAFKA_TOPIC])

        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                await asyncio.sleep(0.5)
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    log.info("EOF %s[%s]", msg.topic(), msg.partition())
                elif msg.error().code() == KafkaError.UNKNOWN_TOPIC_OR_PART:
                    log.warning("Tópico ainda não disponível. Aguardando...")
                    await asyncio.sleep(1.0)
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


async def wait_for_kafka_topic(consumer: Consumer, topic: str, attempts: int, backoff_ms: int) -> bool:
    for i in range(1, attempts + 1):
        try:
            md = consumer.list_topics(topic, timeout=3.0)
            tmd = md.topics.get(topic)
            if tmd is not None and tmd.error is None:
                log.info("Conectividade Kafka OK e tópico '%s' disponível (tentativa %d)", topic, i)
                return True
            else:
                log.warning("Kafka OK, mas tópico '%s' ainda indisponível (tentativa %d)", topic, i)
        except Exception as e:
            log.warning("Falha ao obter metadata do Kafka (tentativa %d): %s", i, e)
        await asyncio.sleep(backoff_ms / 1000.0)
    return False


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Encerrado pelo usuário.")
