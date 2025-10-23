use futures_util::StreamExt;
use prost::Message as ProstMessage;
use prost_types::Timestamp;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::BorrowedMessage;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::time::Duration;
use tracing::{info, warn};

use crate::proto::{market_data_event, MarketDataEvent};

const DEFAULT_SOURCE_TOPIC: &str = "market-data.trades.coinbase";
const DEFAULT_TARGET_TOPIC: &str = "market-data.trades.normalized";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::from_path("../../.env").ok();
    tracing_subscriber::fmt::init();

    let brokers = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".into());
    let source_topic =
        std::env::var("RAW_MARKET_TOPIC").unwrap_or_else(|_| DEFAULT_SOURCE_TOPIC.to_string());
    let target_topic = std::env::var("NORMALIZED_MARKET_TOPIC")
        .unwrap_or_else(|_| DEFAULT_TARGET_TOPIC.to_string());

    let consumer: StreamConsumer = ClientConfig::new()
        .set("bootstrap.servers", &brokers)
        .set("group.id", "data-normalizer")
        .set("enable.auto.commit", "true")
        .set("auto.offset.reset", "latest")
        .create()?;

    consumer.subscribe(&[&source_topic])?;

    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", &brokers)
        .set("message.timeout.ms", "5000")
        .create()?;

    info!(
        "Data normalizer online. Consuming '{}' -> Producing '{}'",
        source_topic, target_topic
    );

    let mut stream = consumer.stream();
    while let Some(result) = stream.next().await {
        match result {
            Ok(msg) => {
                if let Err(e) = process_message(&producer, msg, &target_topic).await {
                    warn!(error = %e, "Failed to process message");
                }
            }
            Err(e) => {
                warn!(error = %e, "Kafka error");
            }
        }
    }

    Ok(())
}

async fn process_message(
    producer: &FutureProducer,
    msg: BorrowedMessage<'_>,
    target_topic: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let payload = match msg.payload() {
        Some(p) => p,
        None => {
            warn!("Empty payload skipped");
            return Ok(());
        }
    };

    let mut event = MarketDataEvent::decode(payload)?;

    if let Some(header) = event.header.as_mut() {
        header.exchange = header.exchange.to_lowercase();
        header.symbol = header.symbol.to_uppercase();
        header.received_timestamp = Some(now_ts());
    }

    if let Some(market_data_event::Payload::TradeUpdate(ref mut trade)) = event.payload {
        trade.price = normalize_decimal(&trade.price);
        trade.quantity = normalize_decimal(&trade.quantity);
        trade.side = trade.side.to_uppercase();
    }

    let mut buf = Vec::with_capacity(payload.len());
    event.encode(&mut buf)?;

    producer
        .send(
            FutureRecord::to(target_topic)
                .payload(&buf)
                .key(msg.key().unwrap_or_default()),
            Duration::from_secs(0),
        )
        .await
        .map_err(|(e, _)| e)?;

    Ok(())
}

fn normalize_decimal(input: &str) -> String {
    match input.parse::<f64>() {
        Ok(value) => format!("{:.8}", value),
        Err(_) => input.to_string(),
    }
}

fn now_ts() -> Timestamp {
    let now = std::time::SystemTime::now();
    now.into()
}

mod proto {
    use prost_types::Timestamp;

    #[derive(Clone, PartialEq, Message)]
    pub struct MarketDataEvent {
        #[prost(message, optional, tag = "1")]
        pub header: Option<Header>,
        #[prost(oneof = "market_data_event::Payload", tags = "3")]
        pub payload: Option<market_data_event::Payload>,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct Header {
        #[prost(string, tag = "1")]
        pub exchange: String,
        #[prost(string, tag = "2")]
        pub symbol: String,
        #[prost(message, optional, tag = "3")]
        pub exchange_timestamp: Option<Timestamp>,
        #[prost(message, optional, tag = "4")]
        pub received_timestamp: Option<Timestamp>,
    }

    #[derive(Clone, PartialEq, Message)]
    pub struct TradeUpdate {
        #[prost(string, tag = "1")]
        pub trade_id: String,
        #[prost(string, tag = "2")]
        pub price: String,
        #[prost(string, tag = "3")]
        pub quantity: String,
        #[prost(string, tag = "4")]
        pub side: String,
    }

    pub mod market_data_event {
        use super::TradeUpdate;
        use prost::Oneof;

        #[derive(Clone, PartialEq, Oneof)]
        pub enum Payload {
            #[prost(message, tag = "3")]
            TradeUpdate(TradeUpdate),
        }
    }
}
