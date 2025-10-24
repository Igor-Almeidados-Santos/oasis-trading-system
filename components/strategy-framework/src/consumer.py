import os
import asyncio
import logging
import grpc
from confluent_kafka import Consumer, KafkaError, KafkaException
from dotenv import load_dotenv

# Imports gerados (com fallback para imports absolutos)
try:
    from generated import market_data_pb2, actions_pb2_grpc
except ImportError:  # fallback quando actions_pb2_grpc usa imports absolutos
    import sys
    from pathlib import Path
    gen_dir = Path(__file__).resolve().parent / "generated"
    sys.path.insert(0, str(gen_dir))
    import market_data_pb2  # type: ignore
    import actions_pb2_grpc  # type: ignore

from strategies.momentum import SimpleMomentum

# Métricas Prometheus (opcional)
try:
    from prometheus_client import start_http_server, Counter
except Exception:
    def start_http_server(_port: int):
        pass
    class Counter:
        def __init__(self, *args, **kwargs):
            pass
        def labels(self, **kwargs):
            return self
        def inc(self, *args, **kwargs):
            pass


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

load_dotenv()

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "market-data.trades.normalized")
GROUP_ID = "strategy-framework-group"
RISK_ENGINE_ADDRESS = os.getenv("RISK_ENGINE_GRPC_ADDR", "localhost:50051")
METRICS_PORT = int(os.getenv("STRATEGY_METRICS_PORT", 9092))
FRAMEWORK_KAFKA_CHECK_ATTEMPTS = int(os.getenv("FRAMEWORK_KAFKA_CHECK_ATTEMPTS", "12"))
FRAMEWORK_KAFKA_CHECK_BACKOFF_MS = int(os.getenv("FRAMEWORK_KAFKA_CHECK_BACKOFF_MS", "5000"))

# Métricas
TRADES_PROCESSED = Counter('strategy_trades_processed_total', 'Total de trades processados', ['symbol'])
SIGNALS_GENERATED = Counter('strategy_signals_generated_total', 'Total de sinais gerados', ['strategy_id', 'symbol', 'side'])
SIGNAL_VALIDATION_RESULT = Counter('strategy_signal_validation_result_total', 'Resultado da validação', ['strategy_id', 'status'])


async def run_consumer() -> None:
    # Exposição de métricas (se disponível)
    try:
        start_http_server(METRICS_PORT)
        log.info(f"Métricas Prometheus em :{METRICS_PORT}")
    except Exception as e:
        log.warning(f"Métricas desativadas: {e}")

    # Configura Kafka Consumer
    conf = {
        'bootstrap.servers': KAFKA_BROKERS,
        'group.id': GROUP_ID,
        'auto.offset.reset': 'latest',
    }
    consumer = Consumer(conf)

    # Cliente gRPC (aio)
    channel = grpc.aio.insecure_channel(RISK_ENGINE_ADDRESS)
    risk_stub = actions_pb2_grpc.RiskValidatorStub(channel)

    # Estratégia
    strategy = SimpleMomentum('simple-momentum', os.environ.get('SYMBOL', 'BTC-USD'))
    log.info(f"Estratégia '{strategy.strategy_id}' inicializada.")
    log.info(f"Consumidor Kafka pronto. Tópico='{KAFKA_TOPIC}'")

    # Aguarda Kafka e disponibilidade do tópico antes de subscrever
    if not await wait_for_kafka_topic(consumer, KAFKA_TOPIC, FRAMEWORK_KAFKA_CHECK_ATTEMPTS, FRAMEWORK_KAFKA_CHECK_BACKOFF_MS):
        log.error("Kafka/tópico indisponível após tentativas. Encerrando.")
        consumer.close()
        return

    try:
        consumer.subscribe([KAFKA_TOPIC])
        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                await asyncio.sleep(0.2)
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                if msg.error().code() == KafkaError.UNKNOWN_TOPIC_OR_PART:
                    log.warning("Tópico ainda não disponível. Aguardando...")
                    await asyncio.sleep(1.0)
                    continue
                raise KafkaException(msg.error())

            # Deserialize Protobuf
            mde = market_data_pb2.MarketDataEvent()
            mde.ParseFromString(msg.value())

            if mde.WhichOneof('payload') == 'trade_update':
                trade = mde.trade_update
                header = mde.header
                TRADES_PROCESSED.labels(symbol=header.symbol).inc()

                signals = await strategy.on_trade(trade, header)
                for s in signals:
                    SIGNALS_GENERATED.labels(strategy_id=s.strategy_id, symbol=s.symbol, side=s.side).inc()
                    try:
                        resp = await risk_stub.ValidateSignal(s)
                        if resp.approved:
                            SIGNAL_VALIDATION_RESULT.labels(strategy_id=s.strategy_id, status='approved').inc()
                            log.warning(f"SINAL APROVADO: {resp.order_request.client_order_id}")
                        else:
                            SIGNAL_VALIDATION_RESULT.labels(strategy_id=s.strategy_id, status='rejected').inc()
                            log.warning(f"SINAL REJEITADO: {resp.reason}")
                    except grpc.aio.AioRpcError as e:
                        SIGNAL_VALIDATION_RESULT.labels(strategy_id=s.strategy_id, status='error').inc()
                        log.error(f"Erro gRPC RiskEngine: {e}")
    finally:
        consumer.close()
        log.info("Consumidor Kafka encerrado.")


if __name__ == '__main__':
    asyncio.run(run_consumer())


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
