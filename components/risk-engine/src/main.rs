use tonic::{transport::{Channel, Server}, Request, Response, Status};
use tracing::{info, warn};
use contracts::{
    risk_validator_server::{RiskValidator, RiskValidatorServer},
    order_executor_client::OrderExecutorClient,
    OrderRequest, SignalValidationResponse, TradingSignal,
};
use redis::AsyncCommands; // <-- NOVO
use std::sync::Arc;
use tokio::sync::Mutex;
use bigdecimal::BigDecimal;
use std::str::FromStr;
use std::collections::HashMap;

// Importa o código gRPC gerado
pub mod contracts {
    tonic::include_proto!("trading.contracts");
}

const ORDER_MANAGER_ADDR: &str = "http://127.0.0.1:50052";
const REDIS_ADDR: &str = "redis://127.0.0.1/";

// --- Definição dos Nossos Limites de Risco ---
lazy_static::lazy_static! {
    // Limite máximo por ordem (definido na Fase 1: $10)
    static ref MAX_ORDER_NOTIONAL: BigDecimal = BigDecimal::from(10);
    // Limite máximo de exposição por ativo (definido na Fase 1: $50)
    static ref MAX_POSITION_NOTIONAL: BigDecimal = BigDecimal::from(50);
}

// Estrutura para armazenar a nossa posição
#[derive(serde::Serialize, serde::Deserialize, Debug, Default, Clone)]
struct Position {
    symbol: String,
    quantity: BigDecimal,
    average_price: BigDecimal,
}

// A struct do nosso serviço agora pode usar Redis (opcional) ou memória
pub struct RiskValidatorService {
    order_manager_client: OrderExecutorClient<Channel>,
    redis_client: Option<Arc<Mutex<redis::aio::MultiplexedConnection>>>,
    positions: Arc<Mutex<HashMap<String, Position>>>,
}

#[tonic::async_trait]
impl RiskValidator for RiskValidatorService {
    async fn validate_signal(
        &self,
        request: Request<TradingSignal>,
    ) -> Result<Response<SignalValidationResponse>, Status> {
        let signal = request.into_inner();
        info!(strategy_id = %signal.strategy_id, symbol = %signal.symbol, "Sinal recebido para validação");

        // --- LÓGICA DE RISCO REAL ---

        // 1. Criar a Ordem Proposta (ainda com valores placeholder)
        let order_request = OrderRequest {
            client_order_id: uuid::Uuid::new_v4().to_string(),
            symbol: signal.symbol.clone(),
            side: signal.side.clone(),
            order_type: "LIMIT".to_string(),
            quantity: "0.0001".to_string(), // Exemplo: 0.0001 BTC
            price: "60000.0".to_string(),   // Exemplo: $60,000
            strategy_id: signal.strategy_id.clone(),
        };

        // 2. Validar Limite da Ordem
        let price = BigDecimal::from_str(&order_request.price).unwrap_or_default();
        let qty = BigDecimal::from_str(&order_request.quantity).unwrap_or_default();
        let order_notional = &price * &qty; // Valor financeiro da ordem

        if order_notional > *MAX_ORDER_NOTIONAL {
            warn!(order_notional = %order_notional, "REJEITADO: Valor da ordem excede o limite");
            return Ok(Response::new(SignalValidationResponse {
                approved: false,
                reason: "MAX_ORDER_SIZE_EXCEEDED".to_string(),
                order_request: None,
            }));
        }

        // 3. Validar Limite de Posição (a lógica mais complexa)
        let position_key = format!("position:{}", signal.symbol);
        // Carrega a posição de Redis (se disponível) ou do armazenamento em memória
        let mut position: Position = if let Some(ref rc) = self.redis_client {
            let mut conn = rc.lock().await;
            let pos_json: String = conn.get(&position_key).await.unwrap_or_else(|_| "null".to_string());
            serde_json::from_str(&pos_json).unwrap_or_default()
        } else {
            let map = self.positions.lock().await;
            map.get(&signal.symbol).cloned().unwrap_or_default()
        };

        // Calcula a nova posição *hipotética*
        let new_qty = if signal.side == "BUY" { &position.quantity + &qty } else { &position.quantity - &qty };
        let new_notional = &new_qty * &price; // Valor financeiro da nova posição

        if new_notional.abs() > *MAX_POSITION_NOTIONAL {
             warn!(new_notional = %new_notional, "REJEITADO: Posição excede o limite");
            return Ok(Response::new(SignalValidationResponse {
                approved: false,
                reason: "MAX_POSITION_EXPOSURE_EXCEEDED".to_string(),
                order_request: None,
            }));
        }

        // --- FIM DA LÓGICA DE RISCO ---

        // Se chegou aqui, a ordem foi APROVADA
        info!(client_order_id = %order_request.client_order_id, "Sinal APROVADO. A enviar para OrderManager...");
        
        let mut client = self.order_manager_client.clone();
        match client.execute_order(Request::new(order_request.clone())).await {
            Ok(_) => {
                // SUCESSO! Atualiza a posição (Redis ou memória)
                position.quantity = new_qty;
                if let Some(ref rc) = self.redis_client {
                    let mut conn = rc.lock().await;
                    let new_pos_json = serde_json::to_string(&position).unwrap();
                    let _: () = conn.set(&position_key, new_pos_json).await.unwrap();
                } else {
                    let mut map = self.positions.lock().await;
                    map.insert(signal.symbol.clone(), position.clone());
                }

                Ok(Response::new(SignalValidationResponse {
                    approved: true,
                    reason: "OK".to_string(),
                    order_request: Some(order_request),
                }))
            }
            Err(e) => {
                warn!(error = %e.message(), "Falha ao enviar ordem para OrderManager");
                Ok(Response::new(SignalValidationResponse {
                    approved: false,
                    reason: format!("Falha na execução: {}", e.message()),
                    order_request: None,
                }))
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    let addr = "[::1]:50051".parse()?;
    
    // Conexão com o OrderManager
    let order_manager_addr = std::env::var("ORDER_MANAGER_ADDR").unwrap_or_else(|_| ORDER_MANAGER_ADDR.to_string());
    info!("A ligar-se ao OrderManager em {}...", order_manager_addr);
    let order_manager_client = OrderExecutorClient::connect(order_manager_addr).await?;

    // Conexão com o Redis (opcional para DEV)
    let use_redis = std::env::var("RISK_USE_REDIS").unwrap_or_else(|_| "1".into()) != "0";
    let redis_opt = if use_redis {
        info!("A ligar-se ao Redis em {}...", REDIS_ADDR);
        match redis::Client::open(REDIS_ADDR) {
            Ok(c) => match c.get_multiplexed_async_connection().await {
                Ok(conn) => Some(Arc::new(Mutex::new(conn))),
                Err(e) => { warn!(error = %e, "Não foi possível conectar ao Redis. Usando memória."); None }
            },
            Err(e) => { warn!(error = %e, "Falha ao criar cliente Redis. Usando memória."); None }
        }
    } else { info!("RISK_USE_REDIS=0 - armazenamento em memória"); None };
    let positions: Arc<Mutex<HashMap<String, Position>>> = Default::default();

    // Injeta dependências no nosso serviço
    let validator_service = RiskValidatorService {
        order_manager_client,
        redis_client: redis_opt,
        positions,
    };

    info!("Servidor RiskEngine a ouvir em {}", addr);
    Server::builder()
        .add_service(RiskValidatorServer::new(validator_service))
        .serve(addr)
        .await?;

    Ok(())
}
