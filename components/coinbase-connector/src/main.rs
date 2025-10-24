mod schemas;

use config::ConnectorConfig;
use connector::CoinbaseConnector;
use dotenv::dotenv;
use rdkafka::config::ClientConfig;
use rdkafka::producer::FutureProducer;
use tracing::info;

mod config {
    use super::{DEFAULT_COINBASE_WS_URL, KAFKA_TOPIC};
    use std::env;
    use std::time::Duration;

    #[derive(Debug, Clone)]
    pub struct ReconnectPolicy {
        pub initial_backoff: Duration,
        pub max_backoff: Duration,
    }

    impl Default for ReconnectPolicy {
        fn default() -> Self {
            Self {
                initial_backoff: Duration::from_secs(1),
                max_backoff: Duration::from_secs(60),
            }
        }
    }

    #[derive(Debug, Clone)]
    pub struct ConnectorConfig {
        pub ws_url: String,
        pub product_ids: Vec<String>,
        pub channels: Vec<String>,
        pub kafka_topic: String,
        pub kafka_brokers: String,
        pub max_messages: Option<usize>,
        pub reconnect: ReconnectPolicy,
    }

    impl ConnectorConfig {
        pub fn from_env() -> Self {
            let ws_url =
                env::var("COINBASE_WS_URL").unwrap_or_else(|_| DEFAULT_COINBASE_WS_URL.into());
            let kafka_topic =
                env::var("COINBASE_KAFKA_TOPIC").unwrap_or_else(|_| KAFKA_TOPIC.into());
            let kafka_brokers =
                env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());

            let product_ids = read_list_env("COINBASE_PRODUCT_IDS", &["BTC-USD", "ETH-USD"]);
            let channels = read_list_env("COINBASE_CHANNELS", &["matches"]);

            let max_messages = env::var("CONNECTOR_MAX_MESSAGES")
                .ok()
                .and_then(|v| v.parse().ok());

            let reconnect = ReconnectPolicy {
                initial_backoff: env::var("CONNECTOR_BACKOFF_INITIAL_MS")
                    .ok()
                    .and_then(|v| v.parse::<u64>().ok())
                    .map(Duration::from_millis)
                    .unwrap_or_else(|| Duration::from_secs(1)),
                max_backoff: env::var("CONNECTOR_BACKOFF_MAX_MS")
                    .ok()
                    .and_then(|v| v.parse::<u64>().ok())
                    .map(Duration::from_millis)
                    .unwrap_or_else(|| Duration::from_secs(60)),
            };

            Self {
                ws_url,
                product_ids,
                channels,
                kafka_topic,
                kafka_brokers,
                max_messages,
                reconnect,
            }
        }
    }

    fn read_list_env(key: &str, defaults: &[&str]) -> Vec<String> {
        env::var(key)
            .ok()
            .and_then(|value| {
                let items: Vec<String> = value
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if items.is_empty() {
                    None
                } else {
                    Some(items)
                }
            })
            .unwrap_or_else(|| defaults.iter().map(|s| s.to_string()).collect())
    }
}

mod connector {
    use super::config::{ConnectorConfig, ReconnectPolicy};
    use super::schemas::{
        proto::{market_data_event, Header, MarketDataEvent, TradeUpdate},
        CoinbaseMatch,
    };
    use super::CONNECTOR_USER_AGENT;
    use chrono::Utc;
    use futures_util::{SinkExt, StreamExt};
    use http::{header::USER_AGENT, HeaderValue};
    use prost::Message as _;
    use prost_types::Timestamp;
    use rdkafka::producer::{FutureProducer, FutureRecord};
    use serde::Deserialize;
    use std::time::{Duration, SystemTime};
    use thiserror::Error;
    use tokio::time::sleep;
    use tokio_tungstenite::{
        connect_async,
        tungstenite::{
            client::IntoClientRequest, error::UrlError, protocol::Message as WsMessage,
            Error as WsError,
        },
    };
    use tracing::{debug, info, trace, warn};

    const SUBSCRIBE_TYPE: &str = "subscribe";

    pub struct CoinbaseConnector {
        config: ConnectorConfig,
        producer: FutureProducer,
    }

    impl CoinbaseConnector {
        pub fn new(config: ConnectorConfig, producer: FutureProducer) -> Self {
            Self { config, producer }
        }

        pub async fn run(self) -> Result<(), ConnectorError> {
            info!(
                ws_url = %self.config.ws_url,
                product_ids = ?self.config.product_ids,
                channels = ?self.config.channels,
                "Inicializando ciclo principal do conector"
            );

            let mut backoff = self.config.reconnect.initial_backoff;
            loop {
                match self.stream_once().await {
                    Ok(LoopControl::Stop) => return Ok(()),
                    Ok(LoopControl::Continue) => {
                        backoff = self.config.reconnect.initial_backoff;
                        continue;
                    }
                    Err(err) => {
                        warn!(error = %err, "Falha ao processar ciclo do WebSocket");
                        backoff = next_backoff(backoff, &self.config.reconnect);
                        sleep(backoff).await;
                    }
                }
            }
        }

        async fn stream_once(&self) -> Result<LoopControl, ConnectorError> {
            let mut request = self.config.ws_url.as_str().into_client_request()?;
            request
                .headers_mut()
                .insert(USER_AGENT, HeaderValue::from_static(CONNECTOR_USER_AGENT));

            let (ws_stream, response) = connect_async(request).await?;
            info!(status = %response.status(), "Conexão WebSocket estabelecida");

            let (mut writer, mut reader) = ws_stream.split();

            let subscribe_msg =
                build_subscribe_message(&self.config.product_ids, &self.config.channels);
            writer.send(WsMessage::Text(subscribe_msg)).await?;

            let mut processed = 0usize;
            while let Some(message) = reader.next().await {
                match message {
                    Ok(WsMessage::Text(text)) => match classify_message(&text)? {
                        MessageKind::Trade(trade) => {
                            self.publish_trade(&trade).await?;
                            processed += 1;
                            if let Some(limit) = self.config.max_messages {
                                if processed >= limit {
                                    info!(
                                        limit,
                                        "Limite de mensagens atingido, encerrando execução"
                                    );
                                    return Ok(LoopControl::Stop);
                                }
                            }
                        }
                        MessageKind::Error(reason) => {
                            warn!(%reason, "Feed retornou erro");
                            return Err(ConnectorError::Coinbase(reason));
                        }
                        MessageKind::Subscriptions => {
                            info!("Inscrição confirmada pelo feed da Coinbase");
                        }
                        MessageKind::Heartbeat => {
                            trace!("Heartbeat recebido");
                        }
                        MessageKind::Status => {
                            debug!("Mensagem de status recebida");
                        }
                        MessageKind::Unknown(kind) => {
                            trace!(kind = %kind, "Mensagem ignorada");
                        }
                    },
                    Ok(WsMessage::Ping(payload)) => {
                        writer.send(WsMessage::Pong(payload)).await?;
                    }
                    Ok(WsMessage::Pong(_)) => trace!("Pong recebido"),
                    Ok(WsMessage::Close(frame)) => {
                        info!(frame=?frame, "Socket fechado pelo servidor");
                        return Ok(LoopControl::Continue);
                    }
                    Ok(WsMessage::Binary(_)) => {
                        trace!("Mensagem binária ignorada");
                    }
                    Ok(WsMessage::Frame(_)) => {
                        trace!("Frame interno ignorado");
                    }
                    Err(err) => {
                        return Err(ConnectorError::Websocket(err));
                    }
                }
            }

            warn!("Stream encerrado sem Close explícito, tentando reconectar");
            Ok(LoopControl::Continue)
        }

        async fn publish_trade(&self, trade: &CoinbaseMatch) -> Result<(), ConnectorError> {
            let event = to_internal_format(trade);
            let mut buf = Vec::with_capacity(256);
            event.encode(&mut buf)?;

            let key = event
                .header
                .as_ref()
                .map(|h| h.symbol.as_str())
                .unwrap_or_default();

            let record = FutureRecord::to(&self.config.kafka_topic)
                .payload(&buf)
                .key(key);

            match self.producer.send(record, Duration::from_secs(0)).await {
                Ok(_) => Ok(()),
                Err((err, _)) => {
                    warn!(error = %err, "Falha ao enviar mensagem para o Kafka");
                    Ok(())
                }
            }
        }
    }

    fn build_subscribe_message(product_ids: &[String], channels: &[String]) -> String {
        let product_ids: Vec<&str> = product_ids.iter().map(String::as_str).collect();
        let channels: Vec<&str> = channels.iter().map(String::as_str).collect();
        serde_json::json!({
            "type": SUBSCRIBE_TYPE,
            "product_ids": product_ids,
            "channels": channels,
        })
        .to_string()
    }

    fn next_backoff(current: Duration, policy: &ReconnectPolicy) -> Duration {
        let doubled = current.mul_f64(2_f64);
        if doubled > policy.max_backoff {
            policy.max_backoff
        } else {
            doubled
        }
    }

    fn to_internal_format(msg: &CoinbaseMatch) -> MarketDataEvent {
        let received_at = SystemTime::now();
        let exchange_time = parse_exchange_timestamp(&msg.time).unwrap_or(received_at);
        MarketDataEvent {
            header: Some(Header {
                exchange: "coinbase".to_string(),
                symbol: msg.product_id.clone(),
                exchange_timestamp: Some(Timestamp::from(exchange_time)),
                received_timestamp: Some(Timestamp::from(received_at)),
            }),
            payload: Some(market_data_event::Payload::TradeUpdate(TradeUpdate {
                trade_id: msg.trade_id.to_string(),
                price: msg.price.clone(),
                quantity: msg.size.clone(),
                side: msg.side.to_uppercase(),
            })),
        }
    }

    fn parse_exchange_timestamp(raw: &str) -> Option<SystemTime> {
        match chrono::DateTime::parse_from_rfc3339(raw) {
            Ok(dt) => Some(dt.with_timezone(&Utc).into()),
            Err(err) => {
                warn!(error = ?err, raw_time = %raw, "Falha ao interpretar timestamp da Coinbase");
                None
            }
        }
    }

    #[derive(Debug)]
    enum LoopControl {
        Continue,
        Stop,
    }

    #[derive(Debug)]
    enum MessageKind {
        Trade(CoinbaseMatch),
        Error(String),
        Subscriptions,
        Heartbeat,
        Status,
        Unknown(String),
    }

    #[derive(Debug, Deserialize)]
    struct MessageHeader {
        #[serde(rename = "type")]
        msg_type: String,
        #[serde(default)]
        message: Option<String>,
        #[serde(default)]
        reason: Option<String>,
    }

    fn classify_message(text: &str) -> Result<MessageKind, ConnectorError> {
        let header: MessageHeader = serde_json::from_str(text)?;
        match header.msg_type.as_str() {
            "match" => {
                let trade: CoinbaseMatch = serde_json::from_str(text)?;
                Ok(MessageKind::Trade(trade))
            }
            "error" => {
                let reason = header
                    .message
                    .or(header.reason)
                    .unwrap_or_else(|| "unknown error".to_string());
                Ok(MessageKind::Error(reason))
            }
            "subscriptions" => Ok(MessageKind::Subscriptions),
            "heartbeat" => Ok(MessageKind::Heartbeat),
            "status" => Ok(MessageKind::Status),
            other => Ok(MessageKind::Unknown(other.to_string())),
        }
    }

    #[derive(Error, Debug)]
    pub enum ConnectorError {
        #[error("URL inválida para WebSocket: {0}")]
        Url(#[from] UrlError),
        #[error("Cabeçalho inválido: {0}")]
        Header(#[from] http::header::InvalidHeaderValue),
        #[error("Erro de WebSocket: {0}")]
        Websocket(#[from] WsError),
        #[error("Erro de serialização JSON: {0}")]
        Json(#[from] serde_json::Error),
        #[error("Erro ao codificar protobuf: {0}")]
        Encode(#[from] prost::EncodeError),
        #[error("Erro no Kafka: {0}")]
        Kafka(#[from] rdkafka::error::KafkaError),
        #[error("Feed da Coinbase retornou erro: {0}")]
        Coinbase(String),
    }
}

const DEFAULT_COINBASE_WS_URL: &str = "wss://ws-feed.pro.coinbase.com";
const CONNECTOR_USER_AGENT: &str = "oasis-coinbase-connector/1.0";
const KAFKA_TOPIC: &str = "market-data.trades.coinbase";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    if dotenv::from_path("../../.env").is_err() {
        dotenv().ok();
    }

    tracing_subscriber::fmt::init();
    info!("Iniciando Coinbase Connector...");

    let config = ConnectorConfig::from_env();
    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", &config.kafka_brokers)
        .set("message.timeout.ms", "5000")
        .create()?;

    let connector = CoinbaseConnector::new(config, producer);
    connector.run().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::config::{ConnectorConfig, ReconnectPolicy};
    use super::connector::CoinbaseConnector;
    use super::*;
    use futures_util::{SinkExt, StreamExt};
    use std::io::ErrorKind;
    use tokio::net::TcpListener;
    use tokio_tungstenite::{accept_async, tungstenite::protocol::Message as WsMessage};

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_run_connector_local_ws() {
        let _ = tracing_subscriber::fmt::try_init();

        let listener = match TcpListener::bind("127.0.0.1:0").await {
            Ok(listener) => listener,
            Err(err) if err.kind() == ErrorKind::PermissionDenied => {
                eprintln!("teste ignorado: {err}");
                return;
            }
            Err(err) => panic!("bind falhou: {err}"),
        };
        let addr = listener.local_addr().unwrap();

        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.expect("accept falhou");
            let mut ws = accept_async(stream).await.expect("handshake falhou");

            if let Some(Ok(WsMessage::Text(text))) = ws.next().await {
                tracing::info!(subscribe = %text, "Subscribe recebido do cliente");
            }

            let fake_msg = r#"{"type":"match","trade_id":1,"sequence":1,"maker_order_id":"m","taker_order_id":"t","time":"2020-01-01T00:00:00Z","product_id":"BTC-USD","size":"0.01","price":"10000","side":"buy"}"#;
            ws.send(WsMessage::Text(fake_msg.into()))
                .await
                .expect("envio falhou");
            let _ = ws.close(None).await;
        });

        let config = ConnectorConfig {
            ws_url: format!("ws://{}:{}", addr.ip(), addr.port()),
            product_ids: vec!["BTC-USD".to_string()],
            channels: vec!["matches".to_string()],
            kafka_topic: "test-topic".to_string(),
            kafka_brokers: "localhost:9092".to_string(),
            max_messages: Some(1),
            reconnect: ReconnectPolicy::default(),
        };

        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", &config.kafka_brokers)
            .set("message.timeout.ms", "50")
            .create()
            .expect("falha ao criar FutureProducer");

        let connector = CoinbaseConnector::new(config, producer);
        let res = connector.run().await;

        let _ = server.await;
        assert!(res.is_ok());
    }
}
