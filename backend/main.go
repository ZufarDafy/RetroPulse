package main

import (
	"log"
	"net/http"
	"os"
	"restopulse-backend/database"
	"restopulse-backend/handlers"
	"restopulse-backend/middleware"

	"github.com/gin-gonic/gin"
)

var router *gin.Engine

func setupRouter() *gin.Engine {
	// Database path from environment or default (use /tmp on Vercel/serverless)
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		if os.Getenv("VERCEL") != "" || os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
			dbPath = "/tmp/restopulse.db"
		} else {
			dbPath = "restopulse.db"
		}
	}

	_, err := database.InitDB(dbPath)
	if err != nil {
		log.Printf("⚠️ Database initialization warning: %v", err)
	}

	r := gin.Default()

	// Apply CORS
	r.Use(middleware.CORSMiddleware())

	// Healthcheck handler
	healthHandler := func(c *gin.Context) {
		dbStatus := "connected"
		if database.DB == nil {
			dbStatus = "database disconnected"
		}
		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"database": dbStatus,
			"service":  "RestoPulse Edge Engine",
			"version":  "1.0.0",
		})
	}

	// Support /health, /v1/health, and /api/v1/health regardless of rewrite path stripping
	r.GET("/health", healthHandler)

	prefixes := []string{"/api/v1", "/v1"}
	for _, prefix := range prefixes {
		r.GET(prefix+"/health", healthHandler)

		api := r.Group(prefix)
		{
			// Menu
			api.GET("/menu", handlers.GetMenu)

			// Orders & KDS
			api.GET("/orders", handlers.GetOrders)
			api.POST("/orders", handlers.CreateOrder)
			api.POST("/orders/batch-sync", handlers.BatchSyncOrders)
			api.PATCH("/orders/:id/status", handlers.UpdateKDSStatus)
			api.POST("/orders/:id/reprint", handlers.ReprintReceipt)

			// Chaos Simulator
			api.GET("/chaos/config", handlers.GetChaosConfig)
			api.POST("/chaos/config", handlers.UpdateChaosConfig)

			// Diagnostic Logs
			api.GET("/logs", handlers.GetLogs)
			api.POST("/logs", handlers.CreateLog)
			api.DELETE("/logs", handlers.ClearLogs)
		}
	}

	return r
}

func init() {
	router = setupRouter()
}

// Handler exports the HTTP handler for Vercel Serverless Function invocations
func Handler(w http.ResponseWriter, r *http.Request) {
	if router == nil {
		router = setupRouter()
	}
	router.ServeHTTP(w, r)
}

func main() {
	if router == nil {
		router = setupRouter()
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 RestoPulse Backend running on port :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
