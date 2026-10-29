package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"restopulse-backend/database"
	"restopulse-backend/models"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CreateOrder handles new POS order checkout with idempotency guard
func CreateOrder(c *gin.Context) {
	start := time.Now()

	// 1. Fetch chaos config to apply simulations
	var chaos models.ChaosConfig
	database.DB.First(&chaos, 1)

	// Chaos Check: Simulated DB Lock (HTTP 500)
	if chaos.DBLockSimulated {
		latencyMs := time.Since(start).Milliseconds()
		logEntry := models.DiagnosticLog{
			ID:        uuid.New().String(),
			Timestamp: time.Now(),
			Category:  "BACKEND",
			Level:     "ERROR",
			RootCause: "SIMULATED_DB_LOCK",
			LatencyMs: latencyMs,
			Message:   "HTTP 500 Internal Server Error: pq: deadlock detected / sqlite3: database is locked.",
		}
		database.DB.Create(&logEntry)

		c.JSON(http.StatusInternalServerError, gin.H{
			"status":     "error",
			"error":      "pq: deadlock detected / sqlite3: database is locked",
			"code":       "DB_LOCK_CONTENTION",
			"root_cause": "BACKEND",
			"latency_ms": latencyMs,
		})
		return
	}

	// Chaos Check: Injected Network Latency (e.g. 2500ms)
	if chaos.BadNetworkLatencyMs > 0 {
		time.Sleep(time.Duration(chaos.BadNetworkLatencyMs) * time.Millisecond)
	}

	// 2. Parse request
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Read Idempotency Key from header or body
	idempotencyKey := c.GetHeader("X-Idempotency-Key")
	if idempotencyKey == "" {
		idempotencyKey = req.IdempotencyKey
	}
	if idempotencyKey == "" {
		idempotencyKey = uuid.New().String()
	}

	// 3. Idempotency Check: Does an order with this key already exist?
	var existingOrder models.Order
	err := database.DB.Preload("Items").Where("idempotency_key = ?", idempotencyKey).First(&existingOrder).Error
	if err == nil {
		// Idempotency Hit! Return existing record without duplicate charging or kitchen duplication
		latencyMs := time.Since(start).Milliseconds()
		logEntry := models.DiagnosticLog{
			ID:        uuid.New().String(),
			Timestamp: time.Now(),
			Category:  "UX_BEHAVIOR",
			Level:     "WARN",
			RootCause: "IDEMPOTENCY_DUPLICATE_ABSORBED",
			LatencyMs: latencyMs,
			Message:   fmt.Sprintf("Idempotency guard caught duplicate request for key %s. Existing order %s safely returned without double-charging or double kitchen ticket.", idempotencyKey, existingOrder.OrderNumber),
		}
		database.DB.Create(&logEntry)

		c.Header("X-Idempotency-Key", idempotencyKey)
		c.Header("X-Idempotent-Replay", "true")
		c.JSON(http.StatusOK, gin.H{
			"status":            "success",
			"message":           "Idempotent replay: Order was already created",
			"idempotent_replay": true,
			"data":              existingOrder,
		})
		return
	}

	// 4. Determine Hardware Printer Status
	printStatus := models.PrintStatusPrinted
	if chaos.PrinterStatus == "DISCONNECTED" || chaos.PrinterStatus == "PAPER_OUT" {
		printStatus = models.PrintStatusQueuedForReprint
	}

	// 5. Generate Order Number & Calculate Totals
	orderID := uuid.New().String()
	randSuffix := 1000 + rand.Intn(9000)
	orderNumber := fmt.Sprintf("#RP-%d", randSuffix)

	var totalAmount float64
	var orderItems []models.OrderItem
	for _, itemReq := range req.Items {
		itemSubtotal := itemReq.Price * float64(itemReq.Quantity)
		totalAmount += itemSubtotal
		orderItems = append(orderItems, models.OrderItem{
			ID:         uuid.New().String(),
			OrderID:    orderID,
			MenuItemID: itemReq.MenuItemID,
			Name:       itemReq.Name,
			Price:      itemReq.Price,
			Quantity:   itemReq.Quantity,
			Notes:      itemReq.Notes,
			Subtotal:   itemSubtotal,
		})
	}

	// PB1 Restaurant Tax 10%
	taxAmount := totalAmount * 0.10
	grandTotal := totalAmount + taxAmount

	customerName := req.CustomerName
	if customerName == "" {
		customerName = fmt.Sprintf("Pelanggan %s", req.TableNumber)
	}

	paymentMethod := req.PaymentMethod
	if paymentMethod == "" {
		paymentMethod = "QRIS"
	}

	orderCreatedAt := time.Now()
	if req.ClientCreatedAt != nil {
		orderCreatedAt = *req.ClientCreatedAt
	}

	newOrder := models.Order{
		ID:             orderID,
		IdempotencyKey: idempotencyKey,
		OrderNumber:    orderNumber,
		TableNumber:    req.TableNumber,
		CustomerName:   customerName,
		TotalAmount:    grandTotal,
		PaymentMethod:  paymentMethod,
		PaymentStatus:  models.PaymentStatusPaid,
		KDSStatus:      models.KDSStatusPending,
		PrintStatus:    printStatus,
		SyncStatus:     models.SyncStatusSynced,
		CreatedAt:      orderCreatedAt,
		UpdatedAt:      time.Now(),
		Items:          orderItems,
	}

	// 6. Save in Transaction
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&newOrder).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		latencyMs := time.Since(start).Milliseconds()
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":     "error",
			"error":      "Failed to persist order: " + err.Error(),
			"latency_ms": latencyMs,
		})
		return
	}

	latencyMs := time.Since(start).Milliseconds()

	// 7. Log Diagnostic Events
	if printStatus == models.PrintStatusQueuedForReprint {
		logEntry := models.DiagnosticLog{
			ID:        uuid.New().String(),
			Timestamp: time.Now(),
			Category:  "HARDWARE",
			Level:     "WARN",
			RootCause: "PRINTER_UNREACHABLE_QUEUED_REPRINT",
			LatencyMs: latencyMs,
			Message:   fmt.Sprintf("[HARDWARE_FAULT_ISOLATION] Order %s saved in DB and dispatched to Kitchen KDS, but Bluetooth Printer is disconnected/paper-out. Receipt queued for reprint.", orderNumber),
		}
		database.DB.Create(&logEntry)
	} else {
		logEntry := models.DiagnosticLog{
			ID:        uuid.New().String(),
			Timestamp: time.Now(),
			Category:  "HARDWARE",
			Level:     "INFO",
			RootCause: "PRINTER_SUCCESS",
			LatencyMs: latencyMs,
			Message:   fmt.Sprintf("Thermal receipt printed for order %s via Bluetooth (ESC/POS 58mm).", orderNumber),
		}
		database.DB.Create(&logEntry)
	}

	orderCreatedLog := models.DiagnosticLog{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Category:  "NETWORK",
		Level:     "INFO",
		RootCause: "ORDER_CREATED_COMMITTED",
		LatencyMs: latencyMs,
		Message:   fmt.Sprintf("Order %s committed to database. Total: Rp %0.0f (Table: %s).", orderNumber, grandTotal, req.TableNumber),
	}
	database.DB.Create(&orderCreatedLog)

	c.Header("X-Idempotency-Key", idempotencyKey)
	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Order created successfully",
		"data":    newOrder,
	})
}

// BatchSyncOrders handles bulk sync of orders stored locally while offline
func BatchSyncOrders(c *gin.Context) {
	start := time.Now()

	var req models.BatchSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var chaos models.ChaosConfig
	database.DB.First(&chaos, 1)

	syncedCount := 0
	duplicatesSkipped := 0
	var syncedOrders []models.Order

	for _, orderReq := range req.Orders {
		// Check idempotency key
		var existing models.Order
		if err := database.DB.Where("idempotency_key = ?", orderReq.IdempotencyKey).First(&existing).Error; err == nil {
			duplicatesSkipped++
			syncedOrders = append(syncedOrders, existing)
			continue
		}

		printStatus := models.PrintStatusPrinted
		if chaos.PrinterStatus == "DISCONNECTED" || chaos.PrinterStatus == "PAPER_OUT" {
			printStatus = models.PrintStatusQueuedForReprint
		}

		orderID := uuid.New().String()
		orderNumber := fmt.Sprintf("#RP-%d", 1000+rand.Intn(9000))

		var totalAmount float64
		var items []models.OrderItem
		for _, itemReq := range orderReq.Items {
			sub := itemReq.Price * float64(itemReq.Quantity)
			totalAmount += sub
			items = append(items, models.OrderItem{
				ID:         uuid.New().String(),
				OrderID:    orderID,
				MenuItemID: itemReq.MenuItemID,
				Name:       itemReq.Name,
				Price:      itemReq.Price,
				Quantity:   itemReq.Quantity,
				Notes:      itemReq.Notes,
				Subtotal:   sub,
			})
		}
		grandTotal := totalAmount * 1.10

		clientTime := time.Now()
		if orderReq.ClientCreatedAt != nil {
			clientTime = *orderReq.ClientCreatedAt
		}

		custName := orderReq.CustomerName
		if custName == "" {
			custName = fmt.Sprintf("Pelanggan %s", orderReq.TableNumber)
		}

		paymentMethod := orderReq.PaymentMethod
		if paymentMethod == "" {
			paymentMethod = "QRIS"
		}

		newOrder := models.Order{
			ID:             orderID,
			IdempotencyKey: orderReq.IdempotencyKey,
			OrderNumber:    orderNumber,
			TableNumber:    orderReq.TableNumber,
			CustomerName:   custName,
			TotalAmount:    grandTotal,
			PaymentMethod:  paymentMethod,
			PaymentStatus:  models.PaymentStatusPaid,
			KDSStatus:      models.KDSStatusPending,
			PrintStatus:    printStatus,
			SyncStatus:     models.SyncStatusSynced,
			CreatedAt:      clientTime,
			UpdatedAt:      time.Now(),
			Items:          items,
		}

		if err := database.DB.Create(&newOrder).Error; err == nil {
			syncedCount++
			syncedOrders = append(syncedOrders, newOrder)
		}
	}

	latencyMs := time.Since(start).Milliseconds()

	// Log batch sync event
	logEntry := models.DiagnosticLog{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Category:  "NETWORK",
		Level:     "INFO",
		RootCause: "BATCH_SYNC_RESOLVED",
		LatencyMs: latencyMs,
		Message:   fmt.Sprintf("Offline Sync Reconciliation complete: %d orders synced, %d duplicate orders skipped.", syncedCount, duplicatesSkipped),
	}
	database.DB.Create(&logEntry)

	c.JSON(http.StatusOK, gin.H{
		"status":             "success",
		"synced_count":       syncedCount,
		"duplicates_skipped": duplicatesSkipped,
		"orders":             syncedOrders,
	})
}

// GetOrders retrieves all active and past orders for KDS and POS
func GetOrders(c *gin.Context) {
	var orders []models.Order
	query := database.DB.Preload("Items").Order("created_at desc")

	status := c.Query("status")
	if status != "" && status != "ALL" {
		query = query.Where("kds_status = ?", status)
	}

	if err := query.Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   orders,
	})
}

// UpdateKDSStatus transitions an order status in the Kitchen Display System
func UpdateKDSStatus(c *gin.Context) {
	orderID := c.Param("id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var order models.Order
	if err := database.DB.Preload("Items").Where("id = ?", orderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	oldStatus := order.KDSStatus
	order.KDSStatus = req.Status
	order.UpdatedAt = time.Now()

	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order status"})
		return
	}

	logEntry := models.DiagnosticLog{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Category:  "UX_BEHAVIOR",
		Level:     "INFO",
		RootCause: "KDS_STATUS_TRANSITION",
		LatencyMs: 3,
		Message:   fmt.Sprintf("Kitchen Chef updated Order %s status: %s -> %s.", order.OrderNumber, oldStatus, req.Status),
	}
	database.DB.Create(&logEntry)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "KDS status updated",
		"data":    order,
	})
}

// ReprintReceipt reprints receipt if printer is connected
func ReprintReceipt(c *gin.Context) {
	orderID := c.Param("id")

	var chaos models.ChaosConfig
	database.DB.First(&chaos, 1)

	if chaos.PrinterStatus != "CONNECTED" {
		logEntry := models.DiagnosticLog{
			ID:        uuid.New().String(),
			Timestamp: time.Now(),
			Category:  "HARDWARE",
			Level:     "ERROR",
			RootCause: "PRINTER_REPRINT_BLOCKED",
			LatencyMs: 2,
			Message:   fmt.Sprintf("Reprint request for Order %s blocked: Bluetooth thermal printer is still in '%s' status.", orderID, chaos.PrinterStatus),
		}
		database.DB.Create(&logEntry)

		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"error":   fmt.Sprintf("Cannot reprint receipt: Thermal printer is %s", chaos.PrinterStatus),
			"printer": chaos.PrinterStatus,
		})
		return
	}

	var order models.Order
	if err := database.DB.Where("id = ?", orderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	order.PrintStatus = models.PrintStatusPrinted
	order.UpdatedAt = time.Now()
	database.DB.Save(&order)

	logEntry := models.DiagnosticLog{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Category:  "HARDWARE",
		Level:     "INFO",
		RootCause: "PRINTER_REPRINT_SUCCESS",
		LatencyMs: 15,
		Message:   fmt.Sprintf("Receipt for Order %s successfully reprinted on Bluetooth thermal printer.", order.OrderNumber),
	}
	database.DB.Create(&logEntry)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Receipt reprinted successfully",
		"data":    order,
	})
}
