// File: components/order-manager/coinbase.go
// (Novo Ficheiro)

package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	pb "oasis-trading-system/components/order-manager/generated/contracts"
)

const defaultCoinbaseAPIURL = "https://api.exchange.coinbase.com"
const defaultAdvancedTradeBaseURL = "https://api.coinbase.com"
const sandboxExchangeBaseURL = "https://api-public.sandbox.exchange.coinbase.com"
const advancedTradeOrdersPath = "/api/v3/brokerage/orders"
const userAgent = "oasis-order-manager/1.0"
const defaultHTTPMaxRetries = 3
const defaultHTTPBackoffMS = 500

func isPaperMode() bool {
    mode := os.Getenv("ORDER_MANAGER_MODE")
    if mode == "paper" || mode == "simulated" || mode == "dryrun" || mode == "dry-run" {
        return true
    }
    // Backward-compat flags
    if os.Getenv("COINBASE_PAPER_MODE") == "1" || os.Getenv("DRY_RUN") == "1" {
        return true
    }
    return false
}

func getCoinbaseBaseURL() string {
    if v := os.Getenv("COINBASE_API_BASE_URL"); v != "" {
        return v
    }
    variant := os.Getenv("ORDER_MANAGER_COINBASE_VARIANT")
    if variant == "" {
        variant = "advanced_trade"
    }
    env := os.Getenv("ORDER_MANAGER_COINBASE_ENV") // "sandbox" ou "prod"
    if variant == "exchange" {
        if env == "sandbox" {
            return sandboxExchangeBaseURL
        }
        return defaultCoinbaseAPIURL
    }
    // advanced_trade
    // Sandbox pode exigir base URL diferente; se não definido, mantemos o default atual.
    return defaultAdvancedTradeBaseURL
}

// decodeAPISecret tenta Base64 e depois Hex para obter os bytes do segredo
func decodeAPISecret(secret string) ([]byte, error) {
    if secret == "" {
        return nil, fmt.Errorf("API secret vazio")
    }
    if b64, err := base64.StdEncoding.DecodeString(secret); err == nil {
        return b64, nil
    }
    if hx, err := hex.DecodeString(secret); err == nil {
        return hx, nil
    }
    return nil, fmt.Errorf("não foi possível decodificar o segredo (nem base64, nem hex)")
}

// signMessage gera assinatura HMAC-SHA256 e retorna Base64
func signMessage(secret []byte, prehash string) string {
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(prehash))
    sig := mac.Sum(nil)
    return base64.StdEncoding.EncodeToString(sig)
}

// Estrutura para o corpo da requisição de nova ordem da Coinbase
type CoinbaseOrderRequest struct {
	ProductID   string `json:"product_id"`
	Side        string `json:"side"`
	Type        string `json:"type"`
	Price       string `json:"price,omitempty"`
	Size        string `json:"size"`
	ClientOid   string `json:"client_oid"`
}

// Estrutura para a resposta da Coinbase
type CoinbaseOrderResponse struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	Message   string `json:"message"`
}

// createSignature gera a assinatura HMAC-SHA256 necessária para a API da Coinbase
func createSignature(secret, timestamp, method, requestPath, body string) string {
	key, _ := hex.DecodeString(secret) // O secret da API
	message := timestamp + method + requestPath + body
	
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(message))
	
	return hex.EncodeToString(mac.Sum(nil))
}

// submitCoinbaseOrder é a função principal que envia a ordem
func submitCoinbaseOrder(req *pb.OrderRequest) (*CoinbaseOrderResponse, error) {
    modeLabel := "paper"
    if !isPaperMode() { modeLabel = "real" }
    if isPaperMode() {
        log.Printf("[PAPER] Simulando submissão de ordem: %s %s @ %s (%s)", req.Side, req.Symbol, req.Price, req.OrderType)
        omOrderSubmissions.WithLabelValues("paper", modeLabel, "simulated").Inc()
        return &CoinbaseOrderResponse{
            ID:      fmt.Sprintf("SIM-%s", req.ClientOrderId),
            Status:  "ACCEPTED",
            Message: "Ordem simulada (paper mode)",
        }, nil
    }

    // Configuração de autenticação
    apiKey := os.Getenv("COINBASE_API_KEY")
    apiSecret := os.Getenv("COINBASE_API_SECRET")
    apiPassphrase := os.Getenv("COINBASE_API_PASSPHRASE")
    variant := os.Getenv("ORDER_MANAGER_COINBASE_VARIANT") // "advanced_trade" (padrão) ou "exchange"
    if variant == "" {
        variant = "advanced_trade"
    }
    if apiKey == "" || apiSecret == "" {
        log.Fatal("Erro: Variáveis de ambiente COINBASE_API_KEY/COINBASE_API_SECRET não definidas.")
    }
    if variant == "exchange" && apiPassphrase == "" {
        log.Fatal("Erro: COINBASE_API_PASSPHRASE obrigatório para 'exchange'.")
    }

	// 1. Monta o corpo da requisição
	coinbaseReq := CoinbaseOrderRequest{
		ProductID: req.Symbol,
		Side:      req.Side,
		Type:      req.OrderType,
		Price:     req.Price,
		Size:      req.Quantity,
		ClientOid: req.ClientOrderId,
	}
	bodyBytes, _ := json.Marshal(coinbaseReq)
	bodyString := string(bodyBytes)

	// 2. Prepara para a assinatura
    method := "POST"
    requestPath := "/orders"
    if variant == "advanced_trade" {
        requestPath = advancedTradeOrdersPath
    }
    timestamp := strconv.FormatInt(time.Now().Unix(), 10)

    // 3. Cria a assinatura (pré-hash: timestamp + method + requestPath + body)
    secretBytes, err := decodeAPISecret(apiSecret)
    if err != nil {
        return nil, err
    }
    prehash := timestamp + method + requestPath + bodyString
    signature := signMessage(secretBytes, prehash)

	// 4. Monta a requisição HTTP
    client := &http.Client{Timeout: 15 * time.Second}
    baseURL := getCoinbaseBaseURL()
    url := baseURL + requestPath

    // Preparação de retries
    maxRetries := getEnvInt("ORDER_MANAGER_HTTP_MAX_RETRIES", defaultHTTPMaxRetries)
    backoffMS := getEnvInt("ORDER_MANAGER_HTTP_BACKOFF_MS", defaultHTTPBackoffMS)
    startAll := time.Now()

    for attempt := 1; attempt <= maxRetries; attempt++ {
        httpReq, _ := http.NewRequest(method, url, bytes.NewBuffer(bodyBytes))

        // 5. Adiciona os cabeçalhos de autenticação
        httpReq.Header.Set("Content-Type", "application/json")
        httpReq.Header.Set("User-Agent", userAgent)
        httpReq.Header.Set("CB-ACCESS-KEY", apiKey)
        httpReq.Header.Set("CB-ACCESS-TIMESTAMP", timestamp)
        if variant == "advanced_trade" {
            httpReq.Header.Set("CB-ACCESS-SIGNATURE", signature)
        } else {
            httpReq.Header.Set("CB-ACCESS-SIGN", signature)
            httpReq.Header.Set("CB-ACCESS-PASSPHRASE", apiPassphrase)
        }

        // 6. Envia a requisição
        log.Printf("Submetendo ordem para %s (tentativa %d/%d): %s", url, attempt, maxRetries, bodyString)
        resp, err := client.Do(httpReq)
        if err != nil {
            if attempt < maxRetries {
                log.Printf("Falha de transporte HTTP: %v (retry em %dms)", err, backoffMS*attempt)
                omRetries.WithLabelValues("transport").Inc()
                time.Sleep(time.Duration(backoffMS*attempt) * time.Millisecond)
                continue
            }
            omOrderSubmissions.WithLabelValues(variant, modeLabel, "error").Inc()
            return nil, err
        }
        defer resp.Body.Close()

        // 7. Processa a resposta
        respBody, _ := ioutil.ReadAll(resp.Body)
        var coinbaseResp CoinbaseOrderResponse
        _ = json.Unmarshal(respBody, &coinbaseResp)

        // Extrai headers de diagnóstico
        reqID := headerFirst(resp.Header, []string{"CB-REQUEST-ID", "X-Request-Id"})
        rlRemain := headerFirst(resp.Header, []string{"RateLimit-Remaining", "CB-RateLimit-Remaining"})
        retryAfter := resp.Header.Get("Retry-After")

        if resp.StatusCode >= 200 && resp.StatusCode < 300 {
            log.Printf("Ordem submetida com sucesso. status=%d request_id=%s rate_limit_remaining=%s", resp.StatusCode, reqID, rlRemain)
            omOrderSubmissions.WithLabelValues(variant, modeLabel, "success").Inc()
            omLatency.WithLabelValues(variant, modeLabel, "success").Observe(time.Since(startAll).Seconds())
            return &coinbaseResp, nil
        }

        // Erros 429/5xx: retry conforme política
        if (resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500) && attempt < maxRetries {
            log.Printf("Erro HTTP %d (request_id=%s, retry_after=%s, rate_limit_remaining=%s). Retry em %dms...", resp.StatusCode, reqID, retryAfter, rlRemain, backoffMS*attempt)
            reason := "http_5xx"
            if resp.StatusCode == http.StatusTooManyRequests { reason = "http_429" }
            omRetries.WithLabelValues(reason).Inc()
            time.Sleep(time.Duration(backoffMS*attempt) * time.Millisecond)
            continue
        }

        // Sem retry ou esgotado: retorna erro estruturado
        if coinbaseResp.Status == "" {
            coinbaseResp.Status = "REJECTED"
        }
        if coinbaseResp.Message == "" {
            coinbaseResp.Message = fmt.Sprintf("status=%d %s", resp.StatusCode, http.StatusText(resp.StatusCode))
        }
        log.Printf("Erro da API da Coinbase: status=%d request_id=%s body=%s", resp.StatusCode, reqID, string(respBody))
        omOrderSubmissions.WithLabelValues(variant, modeLabel, "error").Inc()
        omLatency.WithLabelValues(variant, modeLabel, "error").Observe(time.Since(startAll).Seconds())
        return &coinbaseResp, fmt.Errorf("coinbase api error: http %d, request_id=%s", resp.StatusCode, reqID)
    }
    return nil, fmt.Errorf("unexpected termination in submitCoinbaseOrder")
}

// headerFirst retorna o primeiro valor encontrado para uma lista de chaves (case-sensitive conforme net/http)
func headerFirst(h http.Header, keys []string) string {
    for _, k := range keys {
        if v := h.Get(k); v != "" {
            return v
        }
    }
    return ""
}

func getEnvInt(key string, def int) int {
    if v := os.Getenv(key); v != "" {
        if n, err := strconv.Atoi(v); err == nil {
            return n
        }
    }
    return def
}
