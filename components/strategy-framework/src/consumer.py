# File: components/strategy-framework/src/consumer.py

import asyncio
import logging
from confluent_kafka import Consumer, KafkaError, KafkaException

# Importa as classes geradas a partir dos nossos arquivos .proto
from generated import market_data_pb2

# --- Configuração ---
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

KAFKA_BROKERS = "localhost:9092"
KAFKA_TOPIC = "market-data.trades.coinbase"
GROUP_ID = "strategy-framework-group"


async def run_consumer():
    """
    Conecta-se ao Kafka, consome mensagens de trade e as processa.
    """
    conf = {
        "bootstrap.servers": KAFKA_BROKERS,
        "group.id": GROUP_ID,
        "auto.offset.reset": "latest",  # Começa a ler as mensagens mais recentes
    }

    consumer = Consumer(conf)
    log.info(
        f"Consumidor Kafka criado. Aguardando mensagens do tópico '{KAFKA_TOPIC}'..."
    )

    try:
        consumer.subscribe([KAFKA_TOPIC])

        while True:
            # O 'poll' de 1 segundo aguarda por novas mensagens.
            msg = consumer.poll(1.0)

            if msg is None:
                await asyncio.sleep(1)  # Aguarda um pouco se não houver mensagens
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    # Fim da partição, não é um erro real.
                    log.info(
                        f"Fim da partição {msg.topic()} [{msg.partition()}]"
                    )
                elif msg.error():
                    raise KafkaException(msg.error())
            else:
                # Mensagem recebida com sucesso!
                # 1. Deserializa a mensagem de bytes usando Protobuf
                market_data_event = market_data_pb2.MarketDataEvent()
                market_data_event.ParseFromString(msg.value())

                # 2. Acessa os dados de forma estruturada e segura
                # Verifica se o payload é do tipo TradeUpdate (oneof)
                if market_data_event.WhichOneof("payload") == "trade_update":
                    trade = market_data_event.trade_update
                    header = market_data_event.header
                    log.info(
                        f"Trade Recebido: Symbol={header.symbol} | "
                        f"Side={trade.side} | "
                        f"Price={trade.price} | "
                        f"Qty={trade.quantity}"
                    )
                # O próximo passo é enviar este 'market_data_event' para o módulo de estratégia.
    finally:
        # Garante que o consumidor seja fechado corretamente.
        consumer.close()
        log.info("Consumidor Kafka encerrado.")


if __name__ == "__main__":
    try:
        asyncio.run(run_consumer())
    except KeyboardInterrupt:
        log.info("Desligamento solicitado pelo usuário.")

