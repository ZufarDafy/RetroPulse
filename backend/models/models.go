package models

import (
	"time"
)

// Order status constants
const (
	KDSStatusPending   = "PENDING"
	KDSStatusPreparing = "PREPARING"
	KDSStatusServed    = "SERVED"
	KDSStatusCancelled = "CANCELLED"

	PrintStatusPrinted         = "PRINTED"
	PrintStatusQueuedForReprint = "QUEUED_FOR_REPRINT"
	PrintStatusFailed          = "FAILED"

	SyncStatusSynced        = "SYNCED"
	SyncStatusQueuedOffline = "QUEUED_OFFLINE"

	PaymentStatusPaid    = "PAID"
	PaymentStatusPending = "PENDING"
)

// Order represents a restaurant customer or staff order
type Order struct {
	ID             string      `gorm:"primaryKey;size:36" json:"id"`
	IdempotencyKey string      `gorm:"uniqueIndex;size:64;not null" json:"idempotency_key"`
	OrderNumber    string      `gorm:"size:16;not null" json:"order_number"`
	TableNumber    string      `gorm:"size:16;not null" json:"table_number"`
	CustomerName   string      `gorm:"size:64;not null" json:"customer_name"`
	TotalAmount    float64     `gorm:"not null" json:"total_amount"`
	PaymentMethod  string      `gorm:"size:16;not null" json:"payment_method"`
	PaymentStatus  string      `gorm:"size:16;not null" json:"payment_status"`
	KDSStatus      string      `gorm:"index;size:16;not null" json:"kds_status"`
	PrintStatus    string      `gorm:"size:32;not null" json:"print_status"`
	SyncStatus     string      `gorm:"size:32;not null" json:"sync_status"`
	CreatedAt      time.Time   `gorm:"index" json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
	Items          []OrderItem `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE;" json:"items"`
}

// OrderItem represents an individual dish/beverage in an order
type OrderItem struct {
	ID         string  `gorm:"primaryKey;size:36" json:"id"`
	OrderID    string  `gorm:"index;size:36;not null" json:"order_id"`
	MenuItemID string  `gorm:"size:32;not null" json:"menu_item_id"`
	Name       string  `gorm:"size:128;not null" json:"name"`
	Price      float64 `gorm:"not null" json:"price"`
	Quantity   int     `gorm:"not null" json:"quantity"`
	Notes      string  `gorm:"size:255" json:"notes"`
	Subtotal   float64 `gorm:"not null" json:"subtotal"`
}

// DiagnosticLog captures a field reliability event
type DiagnosticLog struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	Timestamp  time.Time `gorm:"index" json:"timestamp"`
	Category   string    `gorm:"index;size:20;not null" json:"category"` // NETWORK, HARDWARE, UX_BEHAVIOR, BACKEND
	Level      string    `gorm:"size:10;not null" json:"level"`          // INFO, WARN, ERROR, CRITICAL
	RootCause  string    `gorm:"size:64;not null" json:"root_cause"`
	LatencyMs  int64     `json:"latency_ms"`
	Message    string    `gorm:"type:text;not null" json:"message"`
	Metadata   string    `gorm:"type:text" json:"metadata,omitempty"`
}

// ChaosConfig holds real-time simulation toggles
type ChaosConfig struct {
	ID                  uint      `gorm:"primaryKey" json:"id"`
	WifiOffline         bool      `json:"wifi_offline"`
	BadNetworkLatencyMs int       `json:"bad_network_latency_ms"`
	PrinterStatus       string    `json:"printer_status"` // CONNECTED, PAPER_OUT, DISCONNECTED
	DBLockSimulated     bool      `json:"db_lock_simulated"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// MenuItem holds multi-language descriptions
type MenuItem struct {
	ID          string            `json:"id"`
	Name        map[string]string `json:"name"` // "id", "en", "zh"
	Description map[string]string `json:"description"`
	Category    map[string]string `json:"category"`
	Price       float64           `json:"price"`
	ImageURL    string            `json:"image_url"`
	Badge       map[string]string `json:"badge,omitempty"`
}

// CreateOrderRequest is the payload sent from POS
type CreateOrderRequest struct {
	IdempotencyKey  string             `json:"idempotency_key" binding:"required"`
	TableNumber     string             `json:"table_number" binding:"required"`
	CustomerName    string             `json:"customer_name"`
	PaymentMethod   string             `json:"payment_method"`
	Items           []CreateOrderItem  `json:"items" binding:"required,min=1"`
	ClientCreatedAt *time.Time         `json:"client_created_at,omitempty"`
}

// CreateOrderItem is an item within the create request
type CreateOrderItem struct {
	MenuItemID string  `json:"menu_item_id" binding:"required"`
	Name       string  `json:"name" binding:"required"`
	Price      float64 `json:"price" binding:"required"`
	Quantity   int     `json:"quantity" binding:"required,min=1"`
	Notes      string  `json:"notes"`
}

// BatchSyncRequest represents multiple offline orders synced together
type BatchSyncRequest struct {
	Orders []CreateOrderRequest `json:"orders" binding:"required"`
}
