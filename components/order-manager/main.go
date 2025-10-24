// File: components/order-manager/main.go (Atualizado)
package main

import (
	"context"
	"log"
	"net"
	"os"

	"github.com/joho/godotenv"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
	pb "oasis-trading-system/components/order-manager/generated/contracts"
)

const (
	port = ":50052"
)

type orderExecutorServer struct {
	pb.UnimplementedOrderExecutorServer
}

// Implementação do método RPC ExecuteOrder (Agora com lógica real)
func (s *orderExecutorServer) ExecuteOrder(ctx context.Context, req *pb.OrderRequest) (*pb.OrderSubmissionResponse, error) {
	log.Printf("Recebida OrderRequest para execução REAL: ClientOrderID=%s, Symbol=%s",
		req.ClientOrderId, req.Symbol)

	// --- LÓGICA DE EXECUÇÃO REAL ---
	// Chama a nossa nova função de cliente da API
	coinbaseResp, err := submitCoinbaseOrder(req)

	if err != nil {
		// Se a submissão falhar, retorna uma resposta de erro
		return &pb.OrderSubmissionResponse{
			OrderId: "",
			Status:  "REJECTED",
			Details: err.Error(),
		}, nil
	}

	// Retorna a resposta real da exchange
	return &pb.OrderSubmissionResponse{
		OrderId: coinbaseResp.ID,
		Status:  coinbaseResp.Status,
		Details: coinbaseResp.Message,
	}, nil
}

func main() {
    // Adiciona este bloco no início da função main
    // Carrega o .env da raiz do projeto
    err := godotenv.Load("../../.env")
    if err != nil {
        log.Println("Atenção: Ficheiro .env não encontrado. A usar vars de ambiente do sistema.")
    }

	port := os.Getenv("ORDER_MANAGER_GRPC_ADDR")
	if port == "" {
		// Padrão em IPv4 para compatibilidade no Windows
		port = "0.0.0.0:50052"
	}

	mode := os.Getenv("ORDER_MANAGER_MODE")
	if mode == "" {
		mode = "paper" // padrão seguro
	}
	log.Printf("Iniciando OrderManager (Go) no modo %s na porta %s...", mode, port)

	// Inicia servidor de métricas Prometheus
	startMetricsServer()

	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("Falha ao ouvir: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterOrderExecutorServer(s, &orderExecutorServer{})
	reflection.Register(s)

	if err := s.Serve(lis); err != nil {
		log.Fatalf("Falha ao servir: %v", err)
	}
}
