package database

import (
	"log"
	"restopulse-backend/models"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB initializes SQLite with GORM and runs auto-migrations
func InitDB(dbPath string) (*gorm.DB, error) {
	if dbPath == "" {
		dbPath = "restopulse.db"
	}

	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}

	// Auto migrate entities
	err = DB.AutoMigrate(
		&models.Order{},
		&models.OrderItem{},
		&models.DiagnosticLog{},
		&models.ChaosConfig{},
	)
	if err != nil {
		return nil, err
	}

	// Initialize default Chaos Config if not existing
	var chaos models.ChaosConfig
	if err := DB.First(&chaos, 1).Error; err != nil {
		initialConfig := models.ChaosConfig{
			ID:                  1,
			WifiOffline:         false,
			BadNetworkLatencyMs: 0,
			PrinterStatus:       "CONNECTED",
			DBLockSimulated:     false,
			UpdatedAt:           time.Now(),
		}
		if err := DB.Create(&initialConfig).Error; err != nil {
			log.Printf("Failed to seed initial chaos config: %v", err)
		}
	}

	// Seed sample initial logs if empty
	var logCount int64
	DB.Model(&models.DiagnosticLog{}).Count(&logCount)
	if logCount == 0 {
		sampleLogs := []models.DiagnosticLog{
			{
				ID:        "log-init-001",
				Timestamp: time.Now().Add(-5 * time.Minute),
				Category:  "NETWORK",
				Level:     "INFO",
				RootCause: "SYSTEM_INITIALIZED",
				LatencyMs: 4,
				Message:   "RestoPulse Edge Service initialized. Local SQLite ready.",
			},
			{
				ID:        "log-init-002",
				Timestamp: time.Now().Add(-4 * time.Minute),
				Category:  "HARDWARE",
				Level:     "INFO",
				RootCause: "PRINTER_ONLINE",
				LatencyMs: 12,
				Message:   "Bluetooth Thermal Printer paired successfully (MAC: 84:C7:EA:12:34:56).",
			},
		}
		DB.Create(&sampleLogs)
	}

	log.Printf("RestoPulse database connected and migrated successfully: %s", dbPath)
	return DB, nil
}
