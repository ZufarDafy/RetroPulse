# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox
## Technical Architecture & System Design

**Companion Documents:** [ABOUT-APPS.md](ABOUT-APPS.md) — Application specifications and business rules · [FITUR-APLIKASI.md](FITUR-APLIKASI.md) — Feature matrix and verification criteria

This document defines **how** the system is engineered: module topology, relational database schema, idempotency state machine, offline synchronization engine, chaos injection architecture, dual-database design, and RESTful API contracts.

---

## 1. System Topology & Architecture

The system is designed as a unified fullstack web application featuring lightweight, high-performance modular services capable of running in Docker containers or serverless edge environments:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (BROWSER CLIENT)                       │
│  React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons           │
│                                                                        │
│  ┌──────────────────────┬──────────────────────┬────────────────────┐  │
│  │   COLUMN 1: POS      │   COLUMN 2: KDS      │  COLUMN 3: CHAOS   │  │
│  │  - Optimistic UI     │  - Real-time Board   │  - Chaos Engine    │  │
│  │  - Idempotency Gen   │  - Printer Manager   │  - Log Streamer    │  │
│  │  - Local Queue (IDB) │  - Hardware Badges   │  - Root-Cause Diag │  │
│  └──────────┬───────────┴──────────┬───────────┴──────────▲─────────┘  │
│             │                      │                      │            │
│             ▼                      ▼                      │            │
│      ┌──────────────────────────────────────────────┐     │            │
│      │     CLIENT-SIDE CHAOS INTERCEPTOR            │─────┘            │
│      │  • Offline Drop Interception                 │                  │
│      │  • Latency Delay (2500ms sleep)              │                  │
│      │  • Double-Tap Blocker & UX Event Emitter     │                  │
│      └──────────────────────┬───────────────────────┘                  │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │ HTTP / REST / JSON
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 BACKEND ENGINE (GO + GIN WEB FRAMEWORK)                │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ GIN MIDDLEWARE STACK                                             │  │
│  │  • Logger & Trace ID   • CORS Manager    • Chaos Simulator       │  │
│  │  • Recovery Handler    • Error Handler   • Latency Injector      │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │ CONTROLLERS & SERVICES                                           │  │
│  │  1. Order & Batch-Sync Controller (with Idempotency Guard)        │  │
│  │  2. KDS Ticket Controller (Status Transitions)                   │  │
│  │  3. Chaos Configuration Controller                               │  │
│  │  4. Diagnostic Log Ingestion Controller                          │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │ GORM DATA ACCESS LAYER (DUAL-DATABASE ENGINE)                    │  │
│  │  • Auto-detects POSTGRES_URL / DATABASE_URL                      │  │
│  │  • Falls back to zero-config pure-Go SQLite3                     │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    STORAGE / PERSISTENCE      │
                      │  • restopulse.db (SQLite3)    │
                      │  • Vercel Postgres / Neon DB  │
                      └───────────────────────────────┘
```

### 1.1 Technology Stack Rationale

| Component | Technology | Rationale |
|---|---|---|
| **Backend Framework** | **Go 1.22+ (Gin Web Framework)** | Exceptional performance (*sub-millisecond latency*), ultra-low memory footprint (<25MB RAM), native goroutine concurrency, and single-binary portability. |
| **ORM & Dual Database** | **GORM (SQLite + PostgreSQL)** | Supports zero-config portable execution via pure-Go SQLite for local dev/Docker, and automatically switches to PostgreSQL when `POSTGRES_URL` or `DATABASE_URL` is detected (e.g. Vercel Postgres, Neon, Supabase). |
| **Frontend Framework**| **React 18 + TypeScript + Vite** | Rapid reactivity, complete type safety, rich component ecosystem, and instant Hot Module Replacement (HMR). |
| **Styling & Icons** | **Tailwind CSS + Lucide React** | Warm, friendly commercial F&B aesthetic (inspired by Square, Toast, and Lightspeed) with responsive layout locking. |
| **Client Storage** | **Browser LocalStorage** | Durable store-and-forward queue for offline orders that survives page refreshes and browser restarts. |
| **Deployment Engine** | **Vercel / Docker Compose** | Turnkey container orchestration locally, plus zero-cost Serverless Go Backend + Frontend + Vercel Postgres in the cloud. |

---

## 2. Relational Database Schema

The persistence layer comprises 4 core entities: `orders`, `order_items`, `diagnostic_logs`, and `chaos_configs`.

### 2.1 Table Definitions (DDL)

```sql
-- 1. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,                   -- RFC4122 UUID v4
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,   -- Prevents duplicate transactions
    order_number VARCHAR(16) NOT NULL,            -- e.g., #RP-1001
    table_number VARCHAR(16) NOT NULL,            -- e.g., "T-01", "VIP-01", "TA-01"
    customer_name VARCHAR(64) NOT NULL,           -- Customer / table alias
    total_amount NUMERIC(12, 2) NOT NULL,         -- Grand total in IDR
    payment_method VARCHAR(16) NOT NULL,          -- "QRIS", "CASH", "CARD"
    payment_status VARCHAR(16) NOT NULL,          -- "PAID", "PENDING"
    kds_status VARCHAR(16) NOT NULL,              -- "PENDING", "PREPARING", "SERVED", "CANCELLED"
    print_status VARCHAR(32) NOT NULL,            -- "PRINTED", "QUEUED_FOR_REPRINT", "FAILED"
    sync_status VARCHAR(32) NOT NULL,             -- "SYNCED", "QUEUED_OFFLINE"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_kds_status ON orders(kds_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 2. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(36) PRIMARY KEY,                   -- Item UUID
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(32) NOT NULL,            -- Static catalog ID (e.g. "item-001")
    name VARCHAR(128) NOT NULL,                   -- Snapshot item name
    price NUMERIC(12, 2) NOT NULL,                -- Unit price in IDR
    quantity INTEGER NOT NULL,                    -- Ordered quantity
    notes VARCHAR(255),                           -- Custom kitchen requests
    subtotal NUMERIC(12, 2) NOT NULL              -- (price * quantity)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 3. Diagnostic Logs Table
CREATE TABLE IF NOT EXISTS diagnostic_logs (
    id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(20) NOT NULL,                -- "NETWORK", "HARDWARE", "UX_BEHAVIOR", "BACKEND"
    level VARCHAR(10) NOT NULL,                   -- "INFO", "WARN", "ERROR", "CRITICAL"
    root_cause VARCHAR(64) NOT NULL,              -- Machine-readable error code
    latency_ms BIGINT DEFAULT 0,
    message TEXT NOT NULL,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_logs_timestamp ON diagnostic_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_diagnostic_logs_category ON diagnostic_logs(category);

-- 4. Field Chaos Configuration Table
CREATE TABLE IF NOT EXISTS chaos_configs (
    id SERIAL PRIMARY KEY,
    wifi_offline BOOLEAN DEFAULT FALSE,
    bad_network_latency_ms INTEGER DEFAULT 0,
    printer_status VARCHAR(32) DEFAULT 'CONNECTED', -- 'CONNECTED', 'PAPER_OUT', 'DISCONNECTED'
    db_lock_simulated BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Idempotency State Machine & Guard Engine

```
[POS Client: Tap Checkout]
       │
       ▼
[Generate or Reuse Idempotency Key (UUID v4)]
       │
       ├────────────────────────────────────────┐
       ▼ (Simulated WiFi Drop = True)           ▼ (Online)
[Enqueue in LocalStorage (QUEUED_OFFLINE)]   [POST /api/v1/orders with X-Idempotency-Key]
       │                                        │
       │ (On WiFi Restoration)                  ▼
       └──────────────────────────────────> [Go Backend: Check Key in Database]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
                    [Key NOT Found]                             [Key EXISTS]
                          │                                           │
                    [Atomic DB Commit]                       [Safe Replay (200 OK)]
                    [Status: 201 Created]                    [idempotent_replay: true]
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                ▼
                                    [Update UI & KDS Stream]
```

### 3.1 Idempotency Guarantee
1. **Uniqueness:** Every unique cart session maintains a single RFC4122 UUID v4 key.
2. **Replay Safety:** Re-submitting the exact same key returns the existing order record without creating duplicate kitchen tickets or altering inventory.
3. **Double-Tap Debounce:** In-flight checkout buttons lock for 1500ms, preventing duplicate HTTP requests before they leave the browser.

---

## 4. Hardware Fault Isolation Architecture

```
                 ┌────────────────────────────────┐
                 │       ORDER COMMITTED          │
                 │   Database: OK | KDS: OK       │
                 └──────────────┬─────────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
      [Printer CONNECTED]             [Printer DISCONNECTED]
               │                                 │
     [Print Receipt (OK)]             [Tag: QUEUED_FOR_REPRINT]
                                      [Show Warning in KDS Ticket]
                                                 │
                                                 ▼ (Printer Reconnected)
                                      [User Clicks "Reprint"]
                                      [Hardware Log: Success]
```

---

## 5. Dual-Database Auto-Detection

The Go backend dynamically initializes the persistence provider based on environment variables:

```go
func InitDB(dbPath string) (*gorm.DB, error) {
    postgresURL := os.Getenv("POSTGRES_URL")
    if postgresURL == "" {
        postgresURL = os.Getenv("DATABASE_URL")
    }

    var dialector gorm.Dialector
    if postgresURL != "" {
        dialector = postgres.Open(postgresURL)
    } else {
        if dbPath == "" {
            dbPath = os.Getenv("DATABASE_PATH")
            if dbPath == "" { dbPath = "restopulse.db" }
        }
        dialector = sqlite.Open(dbPath)
    }

    DB, err = gorm.Open(dialector, &gorm.Config{...})
    // Auto-migrate tables
    DB.AutoMigrate(&models.Order{}, &models.OrderItem{}, &models.DiagnosticLog{}, &models.ChaosConfig{})
    return DB, nil
}
```

---

## 6. RESTful API Contracts

### `GET /api/v1/health`
Checks backend service and database health.
- **Response 200 OK:**
  ```json
  {
    "status": "ok",
    "database": "connected",
    "service": "RestoPulse Edge Engine",
    "version": "1.0.0"
  }
  ```

### `GET /api/v1/menu`
Retrieves curated F&B items with complete `en`, `id`, and `zh` translations.
- **Response 200 OK:** Array of menu items including price, image URL, category, and badge.

### `POST /api/v1/orders`
Submits a new order with `X-Idempotency-Key` protection.
- **Headers:** `X-Idempotency-Key: <UUID>`
- **Response 201 Created:** Created order object.
- **Response 200 OK:** Safe idempotent replay if key already exists.

### `POST /api/v1/orders/batch-sync`
Reconciles locally queued offline orders in bulk.
- **Payload:** `{ "orders": [ ... ] }`
- **Response 200 OK:**
  ```json
  {
    "synced_count": 3,
    "duplicates_skipped": 0,
    "orders": [ ... ]
  }
  ```

### `PATCH /api/v1/orders/:id/status`
Updates kitchen ticket status (`PENDING` $\rightarrow$ `PREPARING` $\rightarrow$ `SERVED`).

### `POST /api/v1/orders/:id/reprint`
Processes thermal receipt reprint after hardware recovery.

### `GET /api/v1/chaos/config` & `POST /api/v1/chaos/config`
Reads and updates simulated field chaos parameters (latency, printer status, simulated DB lock).

### `GET /api/v1/logs`, `POST /api/v1/logs`, `DELETE /api/v1/logs`
Manages structured diagnostic and UX friction audit logs.
