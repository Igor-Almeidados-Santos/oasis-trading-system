import os
import asyncio
import logging
import json
from typing import Dict
import grpc
from confluent_kafka import Consumer, KafkaError
from dotenv import load_dotenv

# Imports gerados (com fallback para imports absolutos)
try:
    from generated import market_data_pb2, actions_pb2, actions_pb2_grpc
except ImportError:  # fallback quando os módulos gerados usam caminhos absolutos
    import sys
    from pathlib import Path

    gen_dir = Path(__file__).resolve().parent / "generated"
    sys.path.insert(0, str(gen_dir))
    import market_data_pb2  # type: ignore
    import actions_pb2  # type: ignore
    import actions_pb2_grpc  # type: ignore

from strategy import Strategy
from strategies.momentum import SimpleMomentum
from strategies.advanced_profit import AdvancedProfitStrategy

# Métricas Prometheus (mantém fallback quando o pacote não está disponível)
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


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger(__name__)

load_dotenv()

# --- Configuração ---
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
MARKET_DATA_TOPIC = os.getenv("MARKET_DATA_TOPIC", "market-data.trades.coinbase")
CONTROL_COMMAND_TOPIC = os.getenv("CONTROL_COMMAND_TOPIC", "control.commands")
GROUP_ID = os.getenv("STRATEGY_CONSUMER_GROUP", "strategy-framework-group")
RISK_ENGINE_ADDRESS = os.getenv("RISK_ENGINE_GRPC_ADDR", "localhost:50051")
METRICS_PORT = int(os.getenv("STRATEGY_METRICS_PORT", 9092))
FRAMEWORK_KAFKA_CHECK_ATTEMPTS = int(os.getenv("FRAMEWORK_KAFKA_CHECK_ATTEMPTS", "12"))
FRAMEWORK_KAFKA_CHECK_BACKOFF_MS = int(os.getenv("FRAMEWORK_KAFKA_CHECK_BACKOFF_MS", "5000"))

# --- Métricas ---
TRADES_PROCESSED = Counter("strategy_trades_processed_total", "Total de trades processados", ["symbol"])
SIGNALS_GENERATED = Counter(
    "strategy_signals_generated_total", "Total de sinais gerados", ["strategy_id", "symbol", "side"]
)
SIGNAL_VALIDATION_RESULT = Counter(
    "strategy_signal_validation_result_total", "Resultado da validação", ["strategy_id", "status"]
)

# --- Estado Global do Bot ---
bot_status = "RUNNING"
active_strategies: Dict[str, Strategy] = {}


async def consume_control_commands(command_consumer: Consumer) -> None:
    """Processa comandos de controlo recebidos via Kafka."""
    global bot_status

    log.info("Consumidor de comandos iniciado no tópico '%s'...", CONTROL_COMMAND_TOPIC)
    try:
        command_consumer.subscribe([CONTROL_COMMAND_TOPIC])
        while True:
            msg = command_consumer.poll(1.0)
            if msg is None:
                await asyncio.sleep(0.5)
                continue

            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    log.error("[Comandos] Erro Kafka: %s", msg.error())
                continue

            try:
                command_data = json.loads(msg.value().decode("utf-8"))
                command = command_data.get("command")
                payload = command_data.get("payload", {})
                log.info("[Comandos] Recebido comando '%s' com payload %s", command, payload)

                if command == "SET_BOT_STATUS":
                    new_status = payload.get("status", "").upper()
                    if new_status in {"RUNNING", "STOPPED"}:
                        if bot_status != new_status:
                            bot_status = new_status
                            log.warning("Estado global do bot alterado para: %s", bot_status)
                    else:
                        log.error("[Comandos] Estado inválido recebido: %s", new_status)

                elif command == "SET_STRATEGY_CONFIG":
                    strategy_id = payload.get("strategy_id")
                    enabled = payload.get("enabled")
                    mode = payload.get("mode")
                    symbols = payload.get("symbols")
                    usd_balance = payload.get("usd_balance")
                    take_profit_bps = payload.get("take_profit_bps")
                    stop_loss_bps = payload.get("stop_loss_bps")
                    fast_window = payload.get("fast_window")
                    slow_window = payload.get("slow_window")
                    min_signal_bps = payload.get("min_signal_bps")
                    position_size_pct = payload.get("position_size_pct")

                    strategy = active_strategies.get(strategy_id)
                    if strategy is None:
                        log.error("[Comandos] Estratégia desconhecida: %s", strategy_id)
                        continue

                    if enabled is not None:
                        strategy.set_enabled(bool(enabled))

                    if mode is not None:
                        try:
                            strategy.set_mode(mode)
                        except ValueError:
                            log.error("[Comandos] Modo inválido recebido para '%s': %s", strategy_id, mode)

                    if symbols is not None and hasattr(strategy, "set_symbols"):
                        try:
                            if isinstance(symbols, str):
                                parsed_symbols = [
                                    item.strip()
                                    for item in symbols.split(",")
                                    if item.strip()
                                ]
                            elif isinstance(symbols, list):
                                parsed_symbols = symbols
                            else:
                                raise TypeError(f"tipo inválido para symbols: {type(symbols)}")
                            strategy.set_symbols(parsed_symbols)
                        except Exception as err:  # noqa: BLE001
                            log.error(
                                "[Comandos] Falha ao atualizar símbolos de %s: %s",
                                strategy_id,
                                err,
                            )

                    if usd_balance is not None and hasattr(strategy, "set_cash_balance"):
                        try:
                            strategy.set_cash_balance(float(usd_balance))
                        except (TypeError, ValueError):
                            log.error(
                                "[Comandos] Valor de saldo USD inválido para '%s': %s",
                                strategy_id,
                                usd_balance,
                            )

                    parameter_kwargs = {}
                    if take_profit_bps is not None:
                        try:
                            parameter_kwargs["take_profit"] = float(take_profit_bps) / 10_000.0
                        except (TypeError, ValueError):
                            log.error(
                                "[Comandos] take_profit_bps inválido para '%s': %s",
                                strategy_id,
                                take_profit_bps,
                            )
                    if stop_loss_bps is not None:
                        try:
                            parameter_kwargs["stop_loss"] = float(stop_loss_bps) / 10_000.0
                        except (TypeError, ValueError):
                            log.error(
                                "[Comandos] stop_loss_bps inválido para '%s': %s",
                                strategy_id,
                                stop_loss_bps,
                            )
                    if fast_window is not None:
                        try:
                            parameter_kwargs["fast_window"] = int(fast_window)
                        except (TypeError, ValueError):
                            log.error(
                                "[Comandos] fast_window inválido para '%s': %s",
                                strategy_id,
                                fast_window,
                            )
                    if slow_window is not None:
                        try:
                            parameter_kwargs["slow_window"] = int(slow_window)
                        except (TypeError, ValueError):
                            log.error(
                                "[Comandos] slow_window inválido para '%s': %s",
                                strategy_id,
                                slow_window,
                            )
                    if min_signal_bps is not None:
                        try:
                            parameter_kwargs["min_signal_strength"] = float(min_signal_bps) / 10_000.0
                        except (TypeError, ValueError):
                            log.error(
                                "[Comandos] min_signal_bps inválido para '%s': %s",
                                strategy_id,
                                min_signal_bps,
                            )
                    if position_size_pct is not None:
                        try:
                            parameter_kwargs["position_size_pct"] = float(position_size_pct)
                        except (TypeError, ValueError):
                            log.error(
                                "[Comandos] position_size_pct inválido para '%s': %s",
                                strategy_id,
                                position_size_pct,
                            )

                    if parameter_kwargs and hasattr(strategy, "update_parameters"):
                        try:
                            strategy.update_parameters(**parameter_kwargs)
                        except Exception as err:  # noqa: BLE001
                            log.error(
                                "[Comandos] Falha ao atualizar parâmetros de %s: %s",
                                strategy_id,
                                err,
                            )

                else:
                    log.error("[Comandos] Tipo de comando desconhecido: %s", command)

            except json.JSONDecodeError:
                log.error("[Comandos] Mensagem inválida (não JSON) recebida.")
            except Exception as err:  # noqa: BLE001
                log.exception("[Comandos] Erro inesperado ao processar comando: %s", err)
    finally:
        command_consumer.close()
        log.info("Consumidor de comandos encerrado.")


async def run_market_data_consumer(
    market_consumer: Consumer, risk_stub: actions_pb2_grpc.RiskValidatorStub
) -> None:
    """Processa eventos de mercado e gera sinais para validação."""
    global bot_status, active_strategies

    log.info("Consumidor de dados de mercado iniciado no tópico '%s'...", MARKET_DATA_TOPIC)
    try:
        market_consumer.subscribe([MARKET_DATA_TOPIC])
        while True:
            if bot_status == "STOPPED":
                await asyncio.sleep(1.0)
                continue

            msg = market_consumer.poll(1.0)
            if msg is None:
                await asyncio.sleep(0.1)
                continue

            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    log.error("[Mercado] Erro Kafka: %s", msg.error())
                continue

            market_data_event = market_data_pb2.MarketDataEvent()
            market_data_event.ParseFromString(msg.value())

            if market_data_event.WhichOneof("payload") != "trade_update":
                continue

            trade = market_data_event.trade_update
            header = market_data_event.header
            TRADES_PROCESSED.labels(symbol=header.symbol).inc()

            for strategy_id, strategy in active_strategies.items():
                signals = await strategy.on_trade(trade, header)
                if not signals:
                    continue

                for signal in signals:
                    SIGNALS_GENERATED.labels(
                        strategy_id=signal.strategy_id,
                        symbol=signal.symbol,
                        side=signal.side,
                    ).inc()
                    log.info(
                        "Sinal gerado (%s) por '%s', enviando para validação...",
                        actions_pb2.TradingMode.Name(signal.mode),
                        strategy_id,
                    )
                    try:
                        validation_response = await risk_stub.ValidateSignal(signal)
                    except grpc.aio.AioRpcError as err:
                        SIGNAL_VALIDATION_RESULT.labels(strategy_id=strategy_id, status="error").inc()
                        log.error("Erro ao validar sinal com RiskEngine: %s", err)
                        continue

                    if validation_response.approved:
                        SIGNAL_VALIDATION_RESULT.labels(strategy_id=strategy_id, status="approved").inc()
                        client_order_id = validation_response.order_request.client_order_id
                        log.warning("SINAL APROVADO (%s): %s", strategy_id, client_order_id)
                    else:
                        SIGNAL_VALIDATION_RESULT.labels(strategy_id=strategy_id, status="rejected").inc()
                        log.warning("SINAL REJEITADO (%s): %s", strategy_id, validation_response.reason)
    finally:
        market_consumer.close()
        log.info("Consumidor de dados de mercado encerrado.")


async def main() -> None:
    global active_strategies

    # Configura consumidores
    common_conf = {"bootstrap.servers": KAFKA_BROKERS, "group.id": GROUP_ID}
    market_consumer_conf = {**common_conf, "auto.offset.reset": "latest"}
    command_consumer_conf = {**common_conf, "auto.offset.reset": "earliest"}

    market_consumer = Consumer(market_consumer_conf)
    command_consumer = Consumer(command_consumer_conf)

    # Aguarda disponibilidade dos tópicos (se configurado)
    if not await wait_for_kafka_topic(
        market_consumer, MARKET_DATA_TOPIC, FRAMEWORK_KAFKA_CHECK_ATTEMPTS, FRAMEWORK_KAFKA_CHECK_BACKOFF_MS
    ):
        log.error("Tópico de mercado indisponível. Encerrando inicialização.")
        market_consumer.close()
        command_consumer.close()
        return

    if CONTROL_COMMAND_TOPIC:
        await wait_for_kafka_topic(
            command_consumer, CONTROL_COMMAND_TOPIC, FRAMEWORK_KAFKA_CHECK_ATTEMPTS, FRAMEWORK_KAFKA_CHECK_BACKOFF_MS
        )

    # Cliente gRPC
    channel = grpc.aio.insecure_channel(RISK_ENGINE_ADDRESS)
    risk_stub = actions_pb2_grpc.RiskValidatorStub(channel)

    # Servidor de métricas
    try:
        start_http_server(METRICS_PORT)
        log.info("Servidor Prometheus na porta %d", METRICS_PORT)
    except OSError as err:
        log.error("Falha ao iniciar servidor Prometheus: %s", err)

    # Carrega estratégias iniciais
    strategy = SimpleMomentum(strategy_id="momentum-001", symbol_to_watch=os.getenv("SYMBOL", "BTC-USD"))
    active_strategies[strategy.strategy_id] = strategy
    log.info("Estratégia '%s' carregada.", strategy.strategy_id)

    advanced_symbols = [
        symbol.strip().upper()
        for symbol in os.getenv("ADVANCED_STRATEGY_SYMBOLS", "BTC-USD,ETH-USD,SOL-USD").split(",")
        if symbol.strip()
    ]
    advanced_cash = float(os.getenv("ADVANCED_STRATEGY_CASH", "25000"))
    advanced_strategy = AdvancedProfitStrategy(
        strategy_id="advanced-alpha-001",
        symbols=advanced_symbols,
        initial_cash=advanced_cash,
    )
    try:
        take_profit = float(os.getenv("ADVANCED_STRATEGY_TAKE_PROFIT_BPS", "120")) / 10_000.0
        stop_loss = float(os.getenv("ADVANCED_STRATEGY_STOP_LOSS_BPS", "60")) / 10_000.0
        fast_window = int(os.getenv("ADVANCED_STRATEGY_FAST_WINDOW", "5"))
        slow_window = int(os.getenv("ADVANCED_STRATEGY_SLOW_WINDOW", "21"))
        min_signal = float(os.getenv("ADVANCED_STRATEGY_MIN_SIGNAL_BPS", "20")) / 10_000.0
        position_pct = float(os.getenv("ADVANCED_STRATEGY_POSITION_SIZE_PCT", "0.15"))
        advanced_strategy.update_parameters(
            fast_window=fast_window,
            slow_window=slow_window,
            min_signal_strength=min_signal,
            take_profit=take_profit,
            stop_loss=stop_loss,
            position_size_pct=position_pct,
        )
    except Exception as err:  # noqa: BLE001
        log.warning("Não foi possível aplicar parâmetros iniciais da estratégia avançada: %s", err)
    active_strategies[advanced_strategy.strategy_id] = advanced_strategy
    log.info(
        "Estratégia '%s' carregada com símbolos %s.",
        advanced_strategy.strategy_id,
        ", ".join(advanced_symbols) or "(nenhum)",
    )

    # Inicia tarefas
    market_task = asyncio.create_task(run_market_data_consumer(market_consumer, risk_stub))
    command_task = asyncio.create_task(consume_control_commands(command_consumer))

    try:
        await asyncio.gather(market_task, command_task)
    except KeyboardInterrupt:
        log.info("Desligamento solicitado pelo utilizador.")
    finally:
        await channel.close()
        log.info("Canal gRPC encerrado.")


async def wait_for_kafka_topic(consumer: Consumer, topic: str, attempts: int, backoff_ms: int) -> bool:
    """Verifica se um tópico Kafka existe e está disponível antes de subscrever."""
    for attempt in range(1, attempts + 1):
        try:
            metadata = consumer.list_topics(topic, timeout=3.0)
            topic_md = metadata.topics.get(topic)
            if topic_md is not None and topic_md.error is None:
                log.info("Tópico '%s' disponível (tentativa %d).", topic, attempt)
                return True
            log.warning("Tópico '%s' indisponível (tentativa %d).", topic, attempt)
        except Exception as err:  # noqa: BLE001
            log.warning("Falha ao obter metadata do Kafka (tentativa %d): %s", attempt, err)
        await asyncio.sleep(backoff_ms / 1000.0)
    return False


if __name__ == "__main__":
    asyncio.run(main())
