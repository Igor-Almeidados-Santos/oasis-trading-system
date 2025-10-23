mod schemas;

use futures_util::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use schemas::{
    proto::{market_data_event, Header, MarketDataEvent, TradeUpdate},
    CoinbaseMatch,
};
use serde_json::json;
use std::time::Duration;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{error, info, warn};
use prost_types::Timestamp;
use dotenv::dotenv;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Adicionar esta linha no início da função main
    dotenv::from_path("../../.env").ok(); // Tenta carregar o .env da raiz do projeto

    tracing_subscriber::fmt::init();
    info!("Iniciando Coinbase Connector...");

// Constantes para configuração
const DEFAULT_COINBASE_WS_URL: &str = "wss://ws-feed.exchange.coinbase.com";
const KAFKA_TOPIC: &str = "market-data.trades.coinbase";

// Função helper para converter do formato da exchange para o nosso formato interno.
fn to_internal_format(msg: &CoinbaseMatch) -> MarketDataEvent {
    let now = std::time::SystemTime::now();
    MarketDataEvent {
        header: Some(Header {
            exchange: "coinbase".to_string(),
            symbol: msg.product_id.clone(),
            exchange_timestamp: Some(Timestamp::from(now)), // Simplificado
            received_timestamp: Some(Timestamp::from(now)),
        }),
        payload: Some(market_data_event::Payload::TradeUpdate(
            TradeUpdate {
                trade_id: msg.trade_id.to_string(),
                price: msg.price.clone(),
                quantity: msg.size.clone(),
                side: msg.side.to_uppercase(),
            },
        )),
    }
}

// Função principal do conector: conecta, assina e processa mensagens.
pub async fn run_connector(
    ws_url: &str,
    product_ids: &[&str],
    channels: &[&str],
    kafka_producer: &FutureProducer, // Passamos o producer como referência
    max_messages: Option<usize>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (ws_stream, response) = connect_async(ws_url).await?;
    info!(status = %response.status(), "Conexão WebSocket estabelecida");

    let (mut writer, mut reader) = ws_stream.split();

    let subscribe_msg = json!({
        "type": "subscribe",
        "product_ids": product_ids,
        "channels": channels,
    });
    let subscribe_str = subscribe_msg.to_string();
    info!(message = %subscribe_str, "Enviando mensagem de subscrição");
    writer.send(Message::Text(subscribe_str)).await?;

    info!("Aguardando mensagens...");
    let mut processed_count: usize = 0;
    loop {
        tokio::select! {
            Some(msg) = reader.next() => {
                match msg {
                    Ok(Message::Text(text)) => {
                        // ETAPA DE PROCESSAMENTO INTEGRADA AQUI
                        match serde_json::from_str::<CoinbaseMatch>(&text) {
                            Ok(coinbase_match) => {
                                let internal_msg = to_internal_format(&coinbase_match);
                                let mut buf = Vec::new();
                                internal_msg.encode(&mut buf)?;

                                let record = FutureRecord::to(KAFKA_TOPIC)
                                    .payload(&buf)
                                    .key(&internal_msg.header.as_ref().unwrap().symbol);

                                // Aguarda a entrega para garantir a vida útil do buffer e reportar erros.
                                let _ = kafka_producer
                                    .send(record, Duration::from_secs(0))
                                    .await
                                    .unwrap_or_else(|(e, _)| {
                                        warn!(error = ?e, "Falha ao enviar mensagem para o Kafka");
                                        (-1, -1)
                                    });
                            }
                            Err(_) => {
                                // Ignora mensagens que não são do tipo 'match' (ex: 'subscriptions')
                            }
                        }

                        processed_count += 1;
                        if let Some(limit) = max_messages {
                            if processed_count >= limit {
                                info!("Limite de mensagens atingido. Encerrando.");
                                break;
                            }
                        }
                    },
                    Ok(other_msg) => {
                        info!(message_type = ?other_msg, "Recebido outro tipo de mensagem");
                    },
                    Err(e) => {
                        error!(error = ?e, "Erro ao receber mensagem");
                        break;
                    }
                }
            },
            else => break,
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    info!("Iniciando Coinbase Connector...");

    // Configura o producer do Kafka
    let kafka_brokers = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", &kafka_brokers)
        .set("message.timeout.ms", "5000")
        .create()?;

    let ws_url = std::env::var("COINBASE_WS_URL")
        .unwrap_or_else(|_| DEFAULT_COINBASE_WS_URL.to_string());

    let product_ids = ["BTC-USD", "ETH-USD"];
    let channels = ["matches"];

    run_connector(&ws_url, &product_ids, &channels, &producer, None).await
}

#[cfg(test)]
mod tests {
    use super::run_connector;
    use futures_util::{SinkExt, StreamExt};
    use rdkafka::config::ClientConfig;
    use rdkafka::producer::FutureProducer;
    use tokio::net::TcpListener;
    use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_run_connector_local_ws() {
        let _ = tracing_subscriber::fmt::try_init();

        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind falhou");
        let addr = listener.local_addr().unwrap();

        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.expect("accept falhou");
            let mut ws = accept_async(stream).await.expect("handshake falhou");

            if let Some(Ok(Message::Text(text))) = ws.next().await {
                tracing::info!(subscribe = %text, "Subscribe recebido do cliente");
            }

            let fake_msg = r#"{\"type\":\"match\",\"trade_id\":1,\"sequence\":1,\"maker_order_id\":\"m\",\"taker_order_id\":\"t\",\"time\":\"2020-01-01T00:00:00Z\",\"product_id\":\"BTC-USD\",\"size\":\"0.01\",\"price\":\"10000\",\"side\":\"buy\"}"#;
            ws.send(Message::Text(fake_msg.into())).await.expect("envio falhou");
            let _ = ws.close(None).await;
        });

        let ws_url = format!("ws://{}:{}", addr.ip(), addr.port());
        let product_ids = ["BTC-USD"];
        let channels = ["matches"];

        // Cria um produtor Kafka com timeout curto para os testes (não requer broker ativo).
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", "localhost:9092")
            .set("message.timeout.ms", "50")
            .create()
            .expect("falha ao criar FutureProducer para teste");

        let res = run_connector(&ws_url, &product_ids, &channels, &producer, Some(1)).await;

        let _ = server.await;
        assert!(res.is_ok());
    }
}
