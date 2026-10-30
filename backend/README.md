# RestoPulse Backend Engine

This directory contains the core backend API service for **RestoPulse: Offline-Resilient Restaurant POS, Kitchen Display System (KDS), and Field Diagnostic Sandbox**.

Built with **Go 1.22+**, the **Gin Web Framework**, and **GORM**, it delivers sub-millisecond API response times, native goroutine concurrency, and dual-database support for portable and cloud deployments.

---

## Key Features

- **High-Performance Go HTTP Service:** Built on Gin with custom middleware for CORS, logging, recovery, and latency simulation.
- **Client-Side Idempotency Guard:** Validates RFC4122 UUID v4 keys sent via the `X-Idempotency-Key` header, guaranteeing zero double-charges or duplicate kitchen tickets.
- **Dual-Database Architecture:**
  - **Local Dev / Docker:** Automatically connects to zero-config pure-Go SQLite (`restopulse.db`).
  - **Cloud / Serverless:** Automatically detects `POSTGRES_URL` or `DATABASE_URL` (such as Vercel Postgres, Neon.tech, or Supabase) and connects using the GORM PostgreSQL driver.
- **Automatic Migrations:** Automatically creates and updates tables (`orders`, `order_items`, `diagnostic_logs`, `chaos_configs`) on startup.
- **Bulk Batch Synchronization (`POST /api/v1/orders/batch-sync`):** Transactionally commits arrays of orders that were queued in browser storage during offline periods.
- **Simulated Chaos Controls:** API endpoints to toggle simulated network latency, printer connectivity, and database lock errors.

---

## Getting Started

### Prerequisites
- Go 1.22+

### Run Locally
```bash
# Run server
go run main.go
```
The server will start on port `8080` (or the port specified by the `PORT` environment variable).

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port the server binds to | `8080` |
| `DATABASE_PATH` | File path for SQLite database | `restopulse.db` |
| `POSTGRES_URL` | PostgreSQL connection string (auto-detected on Vercel Postgres / Neon) | `""` (falls back to SQLite) |
| `DATABASE_URL` | Generic PostgreSQL connection string fallback | `""` |

---

## Docker Execution

The backend contains a multi-stage `Dockerfile`:
- **Stage 1 (Builder):** Compiles the Go binary with `-ldflags="-w -s"` for minimal size.
- **Stage 2 (Runtime):** Stripped-down Alpine Linux image (<30MB) with persistent volume mount at `/app/data`.
