// File: components/order-manager/coinbase.go
// (Novo Ficheiro)

package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
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

const (
	coinbaseAPIURL = "https://api.pro.coinbase.com"
)

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
	// Carrega as credenciais das variáveis de ambiente
	apiKey := os.Getenv("COINBASE_API_KEY")
	apiSecret := os.Getenv("COINBASE_API_SECRET")
	apiPassphrase := os.Getenv("COINBASE_API_PASSPHRASE")

	if apiKey == "" || apiSecret == "" || apiPassphrase == "" {
		log.Fatal("Erro: Variáveis de ambiente da API da Coinbase (KEY, SECRET, PASSPHRASE) não estão definidas.")
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
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// 3. Cria a assinatura
	signature := createSignature(apiSecret, timestamp, method, requestPath, bodyString)

	// 4. Monta a requisição HTTP
	client := &http.Client{}
	httpReq, _ := http.NewRequest(method, coinbaseAPIURL+requestPath, bytes.NewBuffer(bodyBytes))

	// 5. Adiciona os cabeçalhos de autenticação
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("CB-ACCESS-KEY", apiKey)
	httpReq.Header.Set("CB-ACCESS-SIGN", signature)
	httpReq.Header.Set("CB-ACCESS-TIMESTAMP", timestamp)
	httpReq.Header.Set("CB-ACCESS-PASSPHRASE", apiPassphrase)

	// 6. Envia a requisição
	log.Printf("A submeter ordem REAL para a Coinbase: %s", bodyString)
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// 7. Processa a resposta
	respBody, _ := ioutil.ReadAll(resp.Body)
	var coinbaseResp CoinbaseOrderResponse
	json.Unmarshal(respBody, &coinbaseResp)

	if resp.StatusCode != 200 {
		log.Printf("Erro da API da Coinbase: %s", string(respBody))
		coinbaseResp.Status = "REJECTED" // Garante que o status reflete o erro
		return &coinbaseResp, fmt.Errorf("API retornou status %d: %s", resp.StatusCode, coinbaseResp.Message)
	}

	return &coinbaseResp, nil
}