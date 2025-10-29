package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	pb "oasis-trading-system/components/order-manager/generated/contracts"
)

func initDatabase(ctx context.Context) (*pgxpool.Pool, error) {
	dbURL := os.Getenv("ORDER_MANAGER_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		return nil, errors.New("ORDER_MANAGER_DATABASE_URL (ou DATABASE_URL) não definido")
	}

	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 8
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	log.Println("OrderManager conectado ao Postgres.")
	return pool, nil
}

type OrderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) *OrderRepository {
	return &OrderRepository{pool: pool}
}

func (r *OrderRepository) RecordExecution(ctx context.Context, req *pb.OrderRequest, status string, mode string, executedAt *time.Time, includeFill bool) error {
	if r == nil || r.pool == nil {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	modeLabel := strings.ToUpper(mode)
	if modeLabel != "REAL" && modeLabel != "PAPER" {
		if isPaperMode() {
			modeLabel = "PAPER"
		} else {
			modeLabel = "REAL"
		}
	}

	orderStatus := status
	if orderStatus == "" {
		orderStatus = "ACCEPTED"
	}

	var orderID int64
	var createdAt time.Time
	err = tx.QueryRow(
		ctx,
		`INSERT INTO orders
            (client_order_id, symbol, side, order_type, quantity, price, status, mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, created_at`,
		req.GetClientOrderId(),
		req.GetSymbol(),
		strings.ToUpper(req.GetSide()),
		strings.ToUpper(req.GetOrderType()),
		req.GetQuantity(),
		req.GetPrice(),
		orderStatus,
		modeLabel,
	).Scan(&orderID, &createdAt)
	if err != nil {
		return err
	}

	if includeFill {
		execAt := time.Now().UTC()
		if executedAt != nil {
			execAt = executedAt.UTC()
		}
		_, err = tx.Exec(
			ctx,
			`INSERT INTO fills
                (order_id, symbol, side, quantity, price, fee, executed_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
			orderID,
			req.GetSymbol(),
			strings.ToUpper(req.GetSide()),
			req.GetQuantity(),
			req.GetPrice(),
			"0",
			execAt,
		)
		if err != nil {
			return err
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		return err
	}

	return nil
}
