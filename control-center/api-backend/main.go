package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/joho/godotenv"
	"github.com/segmentio/kafka-go"
	"golang.org/x/crypto/bcrypt"
)

// --- Constantes ---
const controlCommandTopic = "control.commands"

// --- Estruturas de Dados ---

type Position struct {
	Symbol       string `json:"symbol"`
	Quantity     string `json:"quantity"`
	AveragePrice string `json:"average_price"`
	Mode         string `json:"mode"`
}

type Operation struct {
	ID            int64     `json:"id"`
	ClientOrderID string    `json:"client_order_id"`
	Symbol        string    `json:"symbol"`
	Side          string    `json:"side"`
	OrderType     string    `json:"order_type"`
	Quantity      string    `json:"quantity"`
	Price         string    `json:"price"`
	Status        string    `json:"status"`
	ExecutedAt    time.Time `json:"executed_at"`
	Fee           string    `json:"fee"`
	Mode          string    `json:"mode"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type ControlCommand struct {
	Command string      `json:"command"`
	Payload interface{} `json:"payload"`
}

type SetBotStatusPayload struct {
	Status string `json:"status"`
}

type SetStrategyConfigPayload struct {
	StrategyID string `json:"strategy_id"`
	Enabled    bool   `json:"enabled"`
	Mode       string `json:"mode"`
}

// Estrutura para injetar dependências
type ApiHandler struct {
	redisClient *redis.Client
	dbPool      *pgxpool.Pool
	kafkaWriter *kafka.Writer
}

type jwtClaims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

var (
	jwtSecretKey            []byte
	placeholderUser         string
	placeholderPasswordHash []byte
)

func generateJWT(username string) (string, error) {
	claims := jwtClaims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   username,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(jwtSecretKey)
	if err != nil {
		return "", err
	}

	return signed, nil
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid bearer token"})
			return
		}

		claims := &jwtClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return jwtSecretKey, nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set("username", claims.Username)
		c.Next()
	}
}

func main() {
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("Atenção: Ficheiro .env não encontrado.")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Println("Atenção: Variável de ambiente JWT_SECRET não definida, a usar valor temporário 'dev-secret'.")
		jwtSecret = "dev-secret"
	}
	jwtSecretKey = []byte(jwtSecret)

	placeholderUser = os.Getenv("CONTROL_CENTER_API_USER")
	if placeholderUser == "" {
		placeholderUser = "admin"
	}

	rawPassword := os.Getenv("CONTROL_CENTER_API_PASSWORD")
	if rawPassword == "" {
		log.Println("Atenção: CONTROL_CENTER_API_PASSWORD não definido, a usar 'changeme'.")
		rawPassword = "changeme"
	}

	var err error
	placeholderPasswordHash, err = bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Falha ao preparar hash de password: %v", err)
	}

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "redis://localhost:6379/0"
	}
	redisOpts, err := redis.ParseURL(redisAddr)
	if err != nil {
		log.Fatalf("Falha ao parsear URL do Redis: %v", err)
	}
	rdb := redis.NewClient(redisOpts)
	if _, err := rdb.Ping(context.Background()).Result(); err != nil {
		log.Fatalf("Falha ao conectar ao Redis: %v", err)
	}
	log.Println("Conectado ao Redis.")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"
		log.Printf("Atenção: Variável DATABASE_URL não definida, a usar valor padrão local: %s", dbURL)
	}
	dbPool, err := pgxpool.Connect(context.Background(), dbURL)
	if err != nil {
		log.Printf("Atenção: Falha ao conectar ao PostgreSQL (%v). Endpoints dependentes ficarão indisponíveis.", err)
	}

	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "localhost:9092"
	}
	brokers := strings.Split(kafkaBrokers, ",")
	kafkaWriter := &kafka.Writer{
		Addr:     kafka.TCP(brokers...),
		Topic:    controlCommandTopic,
		Balancer: &kafka.LeastBytes{},
		Async:    true,
	}
	log.Printf("Producer Kafka configurado para tópico '%s' em %s", controlCommandTopic, kafkaBrokers)

	handler := &ApiHandler{
		redisClient: rdb,
		dbPool:      dbPool,
		kafkaWriter: kafkaWriter,
	}

	defer func() {
		if handler.kafkaWriter != nil {
			if err := handler.kafkaWriter.Close(); err != nil {
				log.Printf("Erro ao fechar o writer Kafka: %v", err)
			}
		}
		if handler.dbPool != nil {
			handler.dbPool.Close()
		}
	}()

	router := gin.Default()

	router.POST("/api/v1/auth/login", func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "pedido inválido"})
			return
		}

		if req.Username != placeholderUser {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "credenciais inválidas"})
			return
		}

		if err := bcrypt.CompareHashAndPassword(placeholderPasswordHash, []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "credenciais inválidas"})
			return
		}

		token, err := generateJWT(req.Username)
		if err != nil {
			log.Printf("Erro ao gerar token JWT: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao gerar token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": token})
	})

	apiV1 := router.Group("/api/v1")
	apiV1.Use(authMiddleware())
	{
		apiV1.GET("/portfolio", handler.getPortfolio)
		apiV1.GET("/operations", handler.getOperations)
		apiV1.POST("/bot/status", handler.setBotStatus)
		apiV1.POST("/strategies/:strategy_id/toggle", handler.setStrategyConfig)
	}

	port := os.Getenv("CONTROL_CENTER_API_PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Control Center API a ouvir em :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Falha ao iniciar servidor: %v", err)
	}
}

func (h *ApiHandler) getPortfolio(c *gin.Context) {
	ctx := context.Background()
	var positions []Position

	for _, modePrefix := range []string{"position:live:", "position:paper:"} {
		iter := h.redisClient.Scan(ctx, 0, modePrefix+"*", 0).Iterator()
		for iter.Next(ctx) {
			key := iter.Val()
			val, err := h.redisClient.Get(ctx, key).Result()
			if err != nil {
				log.Printf("Erro ao ler chave Redis %s: %v", key, err)
				continue
			}

			type redisPosition struct {
				Symbol       string `json:"symbol"`
				Quantity     string `json:"quantity"`
				AveragePrice string `json:"average_price"`
			}

			var rp redisPosition
			if err := json.Unmarshal([]byte(val), &rp); err != nil {
				log.Printf("Erro ao deserializar JSON da chave %s: %v", key, err)
				continue
			}

			mode := "REAL"
			if strings.HasPrefix(key, "position:paper:") {
				mode = "PAPER"
			}

			positions = append(positions, Position{
				Symbol:       rp.Symbol,
				Quantity:     rp.Quantity,
				AveragePrice: rp.AveragePrice,
				Mode:         mode,
			})
		}
		if err := iter.Err(); err != nil {
			log.Printf("Erro ao iterar chaves Redis (%s*): %v", modePrefix, err)
		}
	}

	c.JSON(http.StatusOK, positions)
}

func (h *ApiHandler) getOperations(c *gin.Context) {
	if h.dbPool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "serviço de operações indisponível"})
		return
	}

	ctx := context.Background()
	modeFilter := c.DefaultQuery("mode", "ALL")
	limit := c.DefaultQuery("limit", "100")

	query := `
        SELECT id, client_order_id, symbol, side, order_type, quantity::text, price::text, status,
               NULL::timestamptz as executed_at, NULL::text as fee, 'REAL' as mode
        FROM orders
        WHERE ($1 = 'ALL' OR mode = $1)
        UNION ALL
        SELECT f.id, o.client_order_id, f.symbol, f.side, NULL::text as order_type, f.quantity::text, f.price::text, 'FILLED' as status,
               f.executed_at, f.fee::text, 'REAL' as mode
        FROM fills f JOIN orders o ON f.order_id = o.id
        WHERE ($1 = 'ALL' OR mode = $1)
        ORDER BY COALESCE(executed_at, created_at) DESC
        LIMIT $2`

	rows, err := h.dbPool.Query(ctx, query, modeFilter, limit)
	if err != nil {
		log.Printf("Erro ao consultar operações: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar operações"})
		return
	}
	defer rows.Close()

	var operations []Operation
	for rows.Next() {
		var op Operation
		if err := rows.Scan(
			&op.ID,
			&op.ClientOrderID,
			&op.Symbol,
			&op.Side,
			&op.OrderType,
			&op.Quantity,
			&op.Price,
			&op.Status,
			&op.ExecutedAt,
			&op.Fee,
			&op.Mode,
		); err != nil {
			log.Printf("Erro ao scanear linha de operação: %v", err)
			continue
		}
		operations = append(operations, op)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Erro após iterar linhas de operações: %v", err)
	}

	c.JSON(http.StatusOK, operations)
}

func (h *ApiHandler) setBotStatus(c *gin.Context) {
	var req struct {
		Status string `json:"status" binding:"required,oneof=START STOP"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pedido inválido: status deve ser START ou STOP"})
		return
	}

	status := "STOPPED"
	if req.Status == "START" {
		status = "RUNNING"
	}

	command := ControlCommand{
		Command: "SET_BOT_STATUS",
		Payload: SetBotStatusPayload{Status: status},
	}

	commandJSON, err := json.Marshal(command)
	if err != nil {
		log.Printf("Erro ao serializar comando SET_BOT_STATUS: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao preparar comando"})
		return
	}

	if err := h.kafkaWriter.WriteMessages(context.Background(), kafka.Message{Value: commandJSON}); err != nil {
		log.Printf("Erro ao publicar comando SET_BOT_STATUS no Kafka: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao enviar comando"})
		return
	}

	log.Printf("Comando SET_BOT_STATUS (%s) publicado", status)
	c.JSON(http.StatusAccepted, gin.H{"message": "Comando aceite"})
}

func (h *ApiHandler) setStrategyConfig(c *gin.Context) {
	strategyID := c.Param("strategy_id")

	var req struct {
		Enabled *bool  `json:"enabled" binding:"required"`
		Mode    string `json:"mode" binding:"required,oneof=REAL PAPER"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pedido inválido: 'enabled' (boolean) e 'mode' (REAL/PAPER) são obrigatórios"})
		return
	}

	command := ControlCommand{
		Command: "SET_STRATEGY_CONFIG",
		Payload: SetStrategyConfigPayload{
			StrategyID: strategyID,
			Enabled:    *req.Enabled,
			Mode:       req.Mode,
		},
	}

	commandJSON, err := json.Marshal(command)
	if err != nil {
		log.Printf("Erro ao serializar comando SET_STRATEGY_CONFIG: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao preparar comando"})
		return
	}

	if err := h.kafkaWriter.WriteMessages(context.Background(), kafka.Message{
		Key:   []byte(strategyID),
		Value: commandJSON,
	}); err != nil {
		log.Printf("Erro ao publicar comando SET_STRATEGY_CONFIG no Kafka: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao enviar comando"})
		return
	}

	log.Printf("Comando SET_STRATEGY_CONFIG para %s (Enabled: %t, Mode: %s) publicado", strategyID, *req.Enabled, req.Mode)
	c.JSON(http.StatusAccepted, gin.H{"message": "Comando aceite"})
}
