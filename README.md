# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox

> **A mission-critical Fullstack Restaurant POS, Kitchen Display System (KDS), and Field Chaos Engineering Sandbox** engineered to conquer flaky restaurant WiFi, double-tap transaction panics, thermal printer jams, and backend database lock contention.

---

## Architecture at a Glance (3-Column Interactive Dashboard)

RestoPulse provides an integrated, zero-friction interactive dashboard designed for F&B front-of-house staff, kitchen chefs, and Field Reliability Engineers to simulate and observe real-world operational challenges in real-time.

Built with a **Warm & Friendly (Orange & White)** design language (`#fffaf5` cream backdrop, crisp cards, and `#ea580c` warm orange accents), RestoPulse features **2 Dedicated Main View Modes** to keep daily restaurant operations clean and unburdened by technical logs:

1. **Restaurant Operations View (Client View):** Column 1 (POS & QR Ordering) and Column 2 (Kitchen Display System / KDS) side-by-side for cashiers, waitstaff, and kitchen cooks.
2. **Field Engineer Sandbox View:** A specialized control plane with 4 real-time chaos simulation switches and a live structured diagnostic log inspector with **Automated Root-Cause Diagnosis**.
*(A **"3 Columns" (Split View)** option is also available in the top navbar for side-by-side comparative testing on widescreen displays).*

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│     VIEW 1: RESTAURANT OPERATIONS     │        VIEW 2: SANDBOX & LOGS         │
│  (Cashier POS & Kitchen KDS Display)  │  (Field Chaos Toggles & Root-Cause)   │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ • POS Menu Grid & Order Cart          │ • 4 Chaos Toggles (WiFi Drop, Latency,│
│ • Idempotency Key & Optimistic UI     │   Printer Disconnect, DB 500 Lock)    │
│ • Rapid Double-Tap Blocker (<1500ms)  │ • Live Resiliency KPI Metrics         │
│ • KDS Live Tickets (Pending->Cooking) │ • Structured Diagnostic Log Inspector │
│ • Hardware Status (Printer, QRIS)     │ • Automated Root-Cause Diagnosis      │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## Technical Documentation Map

| Document | Description | Authority Status |
|---|---|---|
| [docs/ABOUT-APPS.md](docs/ABOUT-APPS.md) | **Application Specifications & Business Rules**: In-depth explanations of F&B industry pain points, client-side idempotency, printer hardware fault tolerance, offline sync queue mechanics, and UX debounce rules. | **Authoritative** for Business Rules |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | **System Architecture & Technical Design**: Service topology, relational database schema (DDL), idempotency state machine, chaos interceptor mechanics, dual-database engine (SQLite/PostgreSQL), and RESTful API contracts. | **Authoritative** for Technical Architecture |
| [docs/FITUR-APLIKASI.md](docs/FITUR-APLIKASI.md) | **Feature Matrix & Verification Criteria**: 38 functional and technical features (F01–F38) categorized across 4 operational domains with verification criteria. | Complete |

---

## Technology Stack

- **Backend:** **Go 1.22+** with the **Gin Web Framework**, **GORM**, and **Dual Database Engine** (pure-Go zero-config **SQLite** for local dev/Docker, and auto-switching **PostgreSQL** for cloud / Vercel Postgres).
- **Frontend:** **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Lucide React** icons.
- **State & Sync:** Optimistic UI state with LocalStorage offline queue reconciliation and RFC4122 UUID v4 Idempotency Key generators.
- **Containerization:** Multi-stage **Dockerfiles** and turnkey **docker-compose.yml**.
- **Deployment:** Fully compatible with **Vercel** (Frontend, Serverless Go Backend, and Vercel Postgres), **Render**, **Railway**, and Docker VPS.

---

## Core Features

### 1. POS & QR Ordering (Customer & Staff View)
- **Instant Multilingual Switcher:** Real-time UI language toggling between **English (EN)**, **Bahasa Indonesia (ID)**, and **Simplified Chinese (ZH 简体中文)**.
- **Dynamic Menu Localization:** Menu item names, categories, descriptions, badges, and receipts translate dynamically in real time across all views.
- **Client-Side Idempotency Keys:** Every order intent generates a unique RFC4122 UUID v4 key sent via the `X-Idempotency-Key` header, guaranteeing zero double-charges even across network retries.
- **Optimistic UI Feedback (<50ms):** Instant visual confirmation in under 50 milliseconds upon tapping Checkout, completely eliminating cashier uncertainty and double-tap panics.
- **Rapid Double-Tap Blocker:** Detects panicky double-clicks within a 1500ms window, locks the checkout button, suppresses duplicate network calls, and logs a `[UX_FRICTION: Rapid Double-Tap Prevented]` event.
- **Offline Sync Queue:** When restaurant WiFi drops, orders are stored safely in browser LocalStorage (`QUEUED_OFFLINE`) and automatically flushed to the backend via `POST /api/v1/orders/batch-sync` upon reconnection.

### 2. Kitchen Display System (KDS) & Hardware Status
- **Live Ticket Board:** Orders stream directly into an independently scrollable KDS card with waiting timers and status transitions: `Pending` $\rightarrow$ `Preparing` $\rightarrow$ `Served`.
- **Live Hardware Health Bar:** Real-time status for Bluetooth Thermal Printer (`Connected`, `Paper Out`, `Disconnected`) and QRIS Payment Gateway.
- **Graceful Printer Fallback:** If the thermal printer disconnects or runs out of paper, transactions still succeed in the database and kitchen queue, tagged with a **"Receipt Queued for Reprint"** warning badge and a 1-click reprint button.

### 3. Field Chaos Engineering Simulator & Diagnostic Sandbox
- **4 Real-World Chaos Switches:**
  1. *Simulate Restaurant WiFi Drop (Offline Mode)*
  2. *Simulate Peak-Hour Bad Network (2500ms API Latency)*
  3. *Simulate Bluetooth Thermal Printer Disconnected*
  4. *Simulate Backend 500 Database Lock Contention (`deadlock detected / database is locked`)*
- **Structured Diagnostic Log Inspector:** Real-time log streamer categorized by `[NETWORK]`, `[HARDWARE]`, `[UX_BEHAVIOR]`, and `[BACKEND]` with timestamps, latency, JSON export, and automated root-cause explanations.

---

## Running the Application

### Option 1: Docker Compose (One-Command Startup)

```bash
docker compose up --build
```

Access the application at:
- **Frontend Dashboard:** `http://localhost:5188` (or `http://localhost:5173` in local dev)
- **Backend API:** `http://localhost:8080/api/v1`
- **Healthcheck Endpoint:** `http://localhost:8080/api/v1/health`

---

### Option 2: Local Development Mode

#### 1. Start the Go Backend
```bash
cd backend
go run main.go
# Server starts on port :8080 with zero-config portable SQLite (restopulse.db)
```

#### 2. Start the React Frontend
```bash
cd frontend
npm install
npm run dev
# Dashboard available on http://localhost:5173
```

---

## Deployment Guide (All-in-Vercel)

RestoPulse can be deployed entirely on **Vercel** with **$0 hosting cost**:
1. **Frontend:** Deployed to Vercel with Root Directory set to `frontend`.
2. **Backend:** Deployed to Vercel with Root Directory set to `backend` (Vercel automatically detects Go and `backend/main.go`).
3. **Database:** Create a free **Vercel Postgres** database in your Vercel Dashboard (**Storage** $\rightarrow$ **Create Database** $\rightarrow$ **Postgres**), then connect it to your backend project. The Go backend automatically detects `POSTGRES_URL` and auto-migrates all tables!

*(Alternatively, use **Render.com** + **Neon.tech**, **Koyeb**, or a standard Docker VPS).*

---

## RESTful API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check for backend service and database connectivity |
| `GET` | `/api/v1/menu` | Retrieve curated menu items with EN, ID, and ZH translations |
| `POST` | `/api/v1/orders` | Checkout new order with `X-Idempotency-Key` protection |
| `POST` | `/api/v1/orders/batch-sync` | Bulk reconcile locally queued offline orders |
| `GET` | `/api/v1/orders` | Retrieve active orders for POS and KDS ticket boards |
| `PATCH` | `/api/v1/orders/:id/status` | Update kitchen ticket status (`PENDING` / `PREPARING` / `SERVED`) |
| `POST` | `/api/v1/orders/:id/reprint` | Process thermal receipt reprint after printer recovery |
| `GET` | `/api/v1/chaos/config` | Retrieve active field chaos simulation settings |
| `POST` | `/api/v1/chaos/config` | Update simulated latency, printer status, WiFi, or DB lock |
| `GET` | `/api/v1/logs` | Fetch structured field diagnostic audit logs |
| `POST` | `/api/v1/logs` | Ingest diagnostic and UX friction events from client |
| `DELETE` | `/api/v1/logs` | Clear diagnostic logs |

---

## License & Copyright
Developed for the F&B Technology community and Field Site Reliability Engineering (Field SRE) practice.
