package handlers

import (
	"net/http"
	"restopulse-backend/database"
	"restopulse-backend/models"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetLogs returns structured diagnostic logs
func GetLogs(c *gin.Context) {
	category := c.Query("category")
	query := database.DB.Model(&models.DiagnosticLog{}).Order("timestamp desc").Limit(150)

	if category != "" && category != "ALL" {
		query = query.Where("category = ?", category)
	}

	var logs []models.DiagnosticLog
	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   logs,
	})
}

// CreateLog receives and stores a diagnostic log emitted by client or backend
func CreateLog(c *gin.Context) {
	var req models.DiagnosticLog
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ID == "" {
		req.ID = uuid.New().String()
	}
	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}
	if req.Level == "" {
		req.Level = "INFO"
	}

	if err := database.DB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create log"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   req,
	})
}

// ClearLogs deletes diagnostic logs
func ClearLogs(c *gin.Context) {
	if err := database.DB.Exec("DELETE FROM diagnostic_logs").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear logs"})
		return
	}

	// Add single reset log
	resetLog := models.DiagnosticLog{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Category:  "UX_BEHAVIOR",
		Level:     "INFO",
		RootCause: "LOG_STREAM_CLEARED",
		LatencyMs: 1,
		Message:   "Diagnostic log stream was manually cleared by field operator.",
	}
	database.DB.Create(&resetLog)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Logs cleared successfully",
	})
}
