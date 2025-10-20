use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{error, info};

// URL padrão do WebSocket da Coinbase
const DEFAULT_COINBASE_WS_URL: &str = "wss://ws-feed.pro.coinbase.com";

// Função principal do conector: conecta, assina e processa mensagens.
pub async fn run_connector(
    ws_url: &str,
    product_ids: &[&str],
    channels: &[&str],
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
    let mut processed: usize = 0;
    loop {
        tokio::select! {
            Some(msg) = reader.next() => {
                match msg {
                    Ok(Message::Text(text)) => {
                        info!(raw_message = %text, "Mensagem recebida");
                        processed += 1;
                        if let Some(limit) = max_messages {
                            if processed >= limit { break; }
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

    // Permite sobrescrever a URL via variável de ambiente (útil para testes)
    let ws_url = std::env::var("COINBASE_WS_URL")
        .unwrap_or_else(|_| DEFAULT_COINBASE_WS_URL.to_string());

    let product_ids = ["BTC-USD"]; // padrão
    let channels = ["matches"]; // padrão

    run_connector(&ws_url, &product_ids, &channels, None).await
}

#[cfg(test)]
mod tests {
    use super::run_connector;
    use futures_util::{SinkExt, StreamExt};
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
        let res = run_connector(&ws_url, &product_ids, &channels, Some(1)).await;

        let _ = server.await;
        assert!(res.is_ok());
    }
}
