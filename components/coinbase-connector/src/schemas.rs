// File: components/coinbase-connector/src/schemas.rs

use serde::Deserialize;

// Estrutura que mapeia a mensagem 'match' da API da Coinbase.
#[derive(Deserialize, Debug)]
pub struct CoinbaseMatch {
    #[serde(rename = "type")]
    pub _msg_type: String,
    pub trade_id: i64,
    #[serde(rename = "sequence")]
    pub _sequence: i64,
    #[serde(rename = "maker_order_id")]
    pub _maker_order_id: String,
    #[serde(rename = "taker_order_id")]
    pub _taker_order_id: String,
    pub time: String,
    pub product_id: String,
    pub size: String,
    pub price: String,
    pub side: String, // "buy" ou "sell"
}

// O código abaixo simula o que seria gerado pelo compilador prost a partir dos .proto
// que definimos na Fase 2. Em um projeto real, usaríamos um build script.

pub mod proto {
    use prost_types::Timestamp;

    // Equivalente a: message MarketDataEvent
    #[derive(Clone, prost::Message)]
    pub struct MarketDataEvent {
        #[prost(message, optional, tag = "1")]
        pub header: Option<Header>,
        #[prost(oneof = "market_data_event::Payload", tags = "2, 3")]
        pub payload: Option<market_data_event::Payload>,
    }

    // Equivalente a: message Header
    #[derive(Clone, prost::Message)]
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

    // Equivalente a: message TradeUpdate
    #[derive(Clone, prost::Message)]
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
        #[derive(Clone, prost::Oneof)]
        pub enum Payload {
            // Não implementado ainda, mas definido no contrato
            // #[prost(message, tag="2")]
            // OrderBookUpdate(super::OrderBookUpdate),
            #[prost(message, tag = "3")]
            TradeUpdate(super::TradeUpdate),
        }
    }
}
