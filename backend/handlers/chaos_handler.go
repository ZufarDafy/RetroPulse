package handlers

import (
	"fmt"
	"net/http"
	"restopulse-backend/database"
	"restopulse-backend/models"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetChaosConfig retrieves current simulation toggles
func GetChaosConfig(c *gin.Context) {
	var config models.ChaosConfig
	if err := database.DB.First(&config, 1).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chaos config"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   config,
	})
}

// UpdateChaosConfig updates simulation toggles and records a diagnostic log
func UpdateChaosConfig(c *gin.Context) {
	var req models.ChaosConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing models.ChaosConfig
	database.DB.First(&existing, 1)

	existing.WifiOffline = req.WifiOffline
	existing.BadNetworkLatencyMs = req.BadNetworkLatencyMs
	existing.PrinterStatus = req.PrinterStatus
	existing.DBLockSimulated = req.DBLockSimulated
	existing.UpdatedAt = time.Now()

	if err := database.DB.Save(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update chaos config"})
		return
	}

	// Generate diagnostic log describing the change
	var category = "NETWORK"
	var message = "Chaos configuration updated"
	var rootCause = "CHAOS_SETTINGS_CHANGED"

	if req.DBLockSimulated {
		category = "BACKEND"
		rootCause = "CHAOS_DB_LOCK_ARMED"
		message = "Field Chaos: Simulated Backend 500 DB Deadlock/Lock contention is now ACTIVE."
	} else if req.PrinterStatus == "DISCONNECTED" {
		category = "HARDWARE"
		rootCause = "CHAOS_PRINTER_DISCONNECTED"
		message = "Field Chaos: Bluetooth Thermal Printer simulated DISCONNECTED state."
	} else if req.PrinterStatus == "PAPER_OUT" {
		category = "HARDWARE"
		rootCause = "CHAOS_PRINTER_PAPER_OUT"
		message = "Field Chaos: Bluetooth Thermal Printer simulated PAPER_OUT condition."
	} else if req.BadNetworkLatencyMs > 0 {
		category = "NETWORK"
		rootCause = "CHAOS_LATENCY_INJECTED"
		message = fmt.Sprintf("Field Chaos: Injected %dms artificial latency to API roundtrip.", req.BadNetworkLatencyMs)
	} else if req.WifiOffline {
		category = "NETWORK"
		rootCause = "CHAOS_WIFI_OFFLINE"
		message = "Field Chaos: Restaurant WiFi Drop simulated. Client forced into offline storage mode."
	} else {
		message = "Field Chaos: All chaos parameters reset to normal operations."
		rootCause = "CHAOS_RESET_NORMAL"
	}

	diagLog := models.DiagnosticLog{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Category:  category,
		Level:     "INFO",
		RootCause: rootCause,
		LatencyMs: 2,
		Message:   message,
	}
	database.DB.Create(&diagLog)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Chaos configuration updated successfully",
		"data":    existing,
	})
}
