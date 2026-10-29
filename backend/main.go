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

func main() {
	// Database path from environment or default
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "restopulse.db"
	}

	_, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Fatal: Failed to initialize SQLite database: %v", err)
	}

	r := gin.Default()

	// Apply CORS
	r.Use(middleware.CORSMiddleware())

	// Healthcheck
	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"database": "connected",
			"service":  "RestoPulse Edge Engine",
			"version":  "1.0.0",
		})
	})

	api := r.Group("/api/v1")
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 RestoPulse Backend running on port :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
