// File: components/order-manager/main.go (Atualizado)
package main

import (
	"context"
	"log"
	"net"
	"os"
	"strings"

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
	repo *OrderRepository
}

// Implementação do método RPC ExecuteOrder (Agora com lógica real)
func (s *orderExecutorServer) ExecuteOrder(ctx context.Context, req *pb.OrderRequest) (*pb.OrderSubmissionResponse, error) {
	log.Printf("Recebida OrderRequest para execução REAL: ClientOrderID=%s, Symbol=%s",
		req.ClientOrderId, req.Symbol)

	modeLabel := "REAL"
	if isPaperMode() {
		modeLabel = "PAPER"
	}

	// --- LÓGICA DE EXECUÇÃO REAL ---
	// Chama a nossa nova função de cliente da API
	coinbaseResp, err := submitCoinbaseOrder(req)

	if err != nil {
		// Se a submissão falhar, retorna uma resposta de erro
		if s.repo != nil {
			if dbErr := s.repo.RecordExecution(ctx, req, "REJECTED", modeLabel, nil, false); dbErr != nil {
				log.Printf("Aviso: falha ao persistir ordem rejeitada: %v", dbErr)
			}
		}
		return &pb.OrderSubmissionResponse{
			OrderId: "",
			Status:  "REJECTED",
			Details: err.Error(),
		}, nil
	}

	// Retorna a resposta real da exchange
	status := coinbaseResp.Status
	if status == "" {
		status = "ACCEPTED"
	}

	if isPaperMode() && status != "REJECTED" {
		status = "FILLED"
	}

	if s.repo != nil {
		includeFill := false
		if isPaperMode() || strings.EqualFold(status, "FILLED") || strings.EqualFold(status, "DONE") {
			includeFill = true
		}
		if dbErr := s.repo.RecordExecution(ctx, req, status, modeLabel, nil, includeFill); dbErr != nil {
			log.Printf("Aviso: falha ao persistir ordem %s: %v", req.ClientOrderId, dbErr)
		}
	}

	return &pb.OrderSubmissionResponse{
		OrderId: coinbaseResp.ID,
		Status:  status,
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

	ctx := context.Background()
	dbPool, err := initDatabase(ctx)
	if err != nil {
		log.Fatalf("Falha ao conectar ao Postgres: %v", err)
	}
	defer dbPool.Close()
	repo := NewOrderRepository(dbPool)

	// Inicia servidor de métricas Prometheus
	startMetricsServer()

	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("Falha ao ouvir: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterOrderExecutorServer(s, &orderExecutorServer{repo: repo})
	reflection.Register(s)

	if err := s.Serve(lis); err != nil {
		log.Fatalf("Falha ao servir: %v", err)
	}
}
