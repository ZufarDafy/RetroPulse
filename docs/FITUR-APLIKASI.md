# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox
## Application Feature Matrix & Technical Specifications

**Reference Documents:** [ABOUT-APPS.md](ABOUT-APPS.md) — Application specifications and business rules · [ARCHITECTURE.md](ARCHITECTURE.md) — Technical system design

---

## 1. How to Read This Document

This document catalogs all functional and technical features of the **RestoPulse** platform, grouped into 4 primary operational domains:
1. **POS & QR Ordering (Column 1)**
2. **Kitchen Display System & Hardware Engine (Column 2)**
3. **Field Engineer Chaos Simulator & Diagnostic Sandbox (Column 3)**
4. **Data Persistence, Offline Sync & Cross-Cutting Architecture**

### System Layer Legend:
- **B**: Backend (Go + Gin Framework + GORM)
- **F**: Frontend (React 18 + TypeScript + Vite + Tailwind CSS)
- **DB**: Persistence Layer (GORM SQLite/PostgreSQL & Browser LocalStorage)

---

## 2. Part I — Functional Feature Matrix

### Area 1: POS & QR Ordering (Customer & Staff View - Column 1)

| Code | Layer | Feature Name | Functional Description | Acceptance & Verification Criteria |
|---|---|---|---|---|
| **F01** | F | Dynamic Multilingual Switcher | Instant language toggling between English (EN), Indonesian (ID), and Simplified Chinese (ZH 简体中文). | Button labels, categories, descriptions, and receipts update dynamically without page reloads. |
| **F02** | F · DB | Curated 6-Item Restaurant Catalog | 6 food & beverage items with high-resolution imagery, pricing, category badges, and quick-add actions. | Users can add items with custom quantities and culinary notes (e.g., "extra spicy"). |
| **F03** | F | Interactive Cart Summary | Reactively calculates subtotal, 10% PB1 restaurant tax, and grand total. | Quantities adjust cleanly; items can be cleared or modified with instant recalculation. |
| **F04** | F | Client-Side Idempotency Key Generator | Generates a unique RFC4122 UUID v4 key upon initiating every order cart. | The key persists in memory/storage across retries and offline queuing until resolved. |
| **F05** | F | Optimistic UI Feedback (<50ms) | Instant UI feedback (<50ms) when checkout is tapped, before the server responds over HTTP. | Cart empties immediately, order is staged, micro-animations trigger with zero cashier perceived lag. |
| **F06** | F | Rapid Double-Tap Debounce Guard | Locks checkout button for 1500ms when tapped rapidly during high network latency. | Prevents duplicate network requests; logs `[UX_FRICTION: Rapid Double-Tap Prevented]`. |
| **F07** | F · DB | Offline Store-and-Forward Queue | Persists orders to LocalStorage when WiFi drops (`wifi_offline = true`). | Order receives `QUEUED_OFFLINE` status; navbar indicator counter activates. |
| **F08** | B · F | Automated Batch Synchronization | Flushes locally queued orders to `POST /api/v1/orders/batch-sync` when connectivity recovers. | Offline orders reconcile automatically, updating to `SYNCED` and entering the KDS. |
| **F09** | F | Table Selector & Payment Method | Allows selecting dining tables (T-01 to T-06, VIP-01, Takeaway) and QRIS payment. | Table metadata binds cleanly to the transaction payload. |
| **F10** | F | Thermal Receipt Modal | Displays an authentic digital receipt preview with order number, table, timestamp, and mock QR code. | Triggers automatically on checkout or manually by tapping "View Receipt". |

---

### Area 2: Kitchen Display System (KDS) & Hardware Engine (Column 2)

| Code | Layer | Feature Name | Functional Description | Acceptance & Verification Criteria |
|---|---|---|---|---|
| **F11** | B · F | Real-Time Kitchen Ticket Board | Streams incoming orders in strict chronological FIFO order with waiting timers. | New orders appear instantly in the KDS column without manual refresh. |
| **F12** | B · F | Stepwise Ticket Status Transitions | Governs lifecycle: `PENDING` $\rightarrow$ `PREPARING` $\rightarrow$ `SERVED`. | Status changes persist to the database and update visual card badges in real time. |
| **F13** | F | Bluetooth Thermal Printer Status Bar | Real-time visual indicator: `CONNECTED` (Green), `PAPER_OUT` (Amber), `DISCONNECTED` (Red). | Reflects hardware state changes reactively based on Column 3 simulation toggles. |
| **F14** | F | QRIS Payment Gateway Status Bar | Displays payment gateway health: `OPERATIONAL` or `DEGRADED`. | Serves as a visual indicator of transaction gateway availability. |
| **F15** | B · F | Hardware Fault Isolation Badge | If printer is disconnected, order succeeds in DB and displays amber warning: "Receipt Queued for Reprint". | Kitchen flow is not blocked; warning badge pulses with reprint option. |
| **F16** | F | One-Click Receipt Reprint Action | Dedicated button on kitchen tickets to reprint receipts once hardware connectivity is restored. | Emits `[HARDWARE] Receipt reprinted successfully` log and resolves warning badge. |
| **F17** | F | Cooking Duration Elapsed Timer | Displays live ticking timer (mm:ss) since order placement. | Provides visual urgency cues for kitchen staff as order wait time elapses. |
| **F18** | B · F | KDS Ticket Filtering Tabs | Filters tickets by status: All, Pending, Preparing, or Served. | Allows chefs to isolate active tickets from completed ones. |

---

### Area 3: Field Chaos Engineering Simulator & Diagnostic Sandbox (Column 3)

| Code | Layer | Feature Name | Functional Description | Acceptance & Verification Criteria |
|---|---|---|---|---|
| **F19** | F | Chaos Switch 1: WiFi Drop (Offline Mode) | Immediately cuts client network connectivity via client-side interceptor. | Tests offline queue resilience and graceful store-and-forward fallback. |
| **F20** | B · F | Chaos Switch 2: Bad Network Latency (2500ms) | Injects a 2500ms artificial delay into every client and server API request. | Tests Optimistic UI responsiveness and double-tap prevention under lag. |
| **F21** | F | Chaos Switch 3: Bluetooth Printer Disconnected | Simulates hardware power failure or paper shortage. | Tests hardware fault isolation and receipt reprint queuing. |
| **F22** | B · F | Chaos Switch 4: Backend 500 DB Lock Contention | Forces backend to return HTTP 500 database lock error (`deadlock / locked`). | Client handles error gracefully with human-friendly guidance; cart remains safe. |
| **F23** | F | Real-Time Structured Diagnostic Streamer | Streams system events tagged by `[NETWORK]`, `[HARDWARE]`, `[UX_BEHAVIOR]`, and `[BACKEND]`. | New logs append at top with category-specific colors and microsecond precision. |
| **F24** | F | Automated Root-Cause Diagnosis Engine | Translates technical errors into plain-language incident explanations. | Assists field reliability engineers in immediately diagnosing root causes. |
| **F25** | F | Category Filtering & Keyword Log Search | Enables instant filtering by category and full-text keyword search across messages. | Isolates relevant audit logs with single-click precision. |
| **F26** | F | Diagnostic Log Export & Clearing | Features "Clear Logs" and "Export JSON" buttons to download structured audit files. | Downloads formatted JSON for post-incident reviews and telemetry analysis. |
| **F27** | B · F | Resiliency KPI Metrics Summary | Displays live counters: Total Orders, Double-Taps Blocked, Queued Offline, Injected Latency. | Quantifies system resiliency and chaos impacts in real time. |
| **F28** | F | One-Click Reset All Chaos Button | Reverts all 4 switches back to normal operating baseline simultaneously. | Restores system to optimal performance in a single tap. |

---

### Area 4: Data Persistence, Backend Engine & Fullstack Cloud Architecture

| Code | Layer | Feature Name | Functional Description | Acceptance & Verification Criteria |
|---|---|---|---|---|
| **F29** | B · DB | Idempotent Order Endpoint (`POST /api/v1/orders`) | Commits orders atomically and validates `X-Idempotency-Key` uniqueness. | Submitting duplicate requests commits only 1 database record safely. |
| **F30** | B · DB | Bulk Synchronization Endpoint (`POST /api/v1/orders/batch-sync`) | Accepts arrays of offline orders and persists them transactionally. | Returns counts of synced and duplicate-skipped orders. |
| **F31** | B · DB | Order Query Endpoint (`GET /api/v1/orders`) | Fetches active and historical orders for POS and KDS ticket boards. | Returns structured JSON with line item details. |
| **F32** | B · DB | KDS Status Transition Endpoint (`PATCH /api/v1/orders/:id/status`) | Updates `kds_status` with validation. | Updates database record with fresh `updated_at` timestamps. |
| **F33** | B · DB | Diagnostic Log Telemetry Endpoints (`POST & GET /api/v1/logs`) | Ingests and serves structured diagnostic events. | Persists logs durably in database storage. |
| **F34** | B · DB | Dual-Database GORM Migration Engine | Auto-detects PostgreSQL (`POSTGRES_URL`) or falls back to zero-config SQLite. | Automatically migrates `orders`, `order_items`, `diagnostic_logs`, and `chaos_configs`. |
| **F35** | B · F | Multi-Stage Dockerfile Containerization | Multi-stage Dockerfiles produce slim, portable images (<50MB Go binary). | Builds and runs efficiently across container environments. |
| **F36** | B · F | Turnkey Docker Compose Orchestration | Runs fullstack application with a single `docker compose up` command. | Frontend and backend communicate cleanly on internal bridge network. |
| **F37** | F · UX | Onboarding Modal & Context Explainer | Welcome dialog explaining F&B pain points, architecture pillars, and features. | Informative modal with "Don't show again" option and manual trigger in Navbar. |
| **F38** | F · UX | Interactive Spotlight Guided Tour (7 Steps) | Step-by-step interactive tour that highlights UI buttons and elements directly on screen. | Seamlessly guides new users through POS, KDS, and Chaos Sandbox scenarios in 3 languages. |
