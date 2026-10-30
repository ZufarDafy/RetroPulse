# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox
## Application Specifications & Business Rules

**System Name:** RestoPulse (Restaurant Pulse)  
**Category:** Field-Resilient Point-of-Sale (POS) & Kitchen Display System (KDS) with Integrated Chaos Engineering Sandbox  
**Companion Documents:** [ARCHITECTURE.md](ARCHITECTURE.md) — Technical system design, database schema, and API contracts · [FITUR-APLIKASI.md](FITUR-APLIKASI.md) — Feature specifications and verification matrix

---

## 1. About This Document

This document serves as the **Single Source of Truth** for business rules, transaction state lifecycles, hardware failure tolerance, network latency absorption, offline synchronization queue logic, and automated root-cause diagnostics within **RestoPulse**.

The system is specifically engineered to address critical operational dilemmas faced by the Food & Beverage (F&B) industry in emerging markets and high-density dining environments:
1. **Unstable Restaurant WiFi:** Intermittent connectivity during peak rush hours causing cashier POS terminals to hang.
2. **"Tapping Without Response" Syndrome (Rapid Double-Tap Panics):** Customers and cashiers furiously spam-clicking the Checkout button because the UI does not provide instant visual confirmation, leading to duplicate payment deductions and double tickets printed in the kitchen.
3. **Thermal Receipt Printer Jams:** Bluetooth disconnection or paper exhaustion freezing the cashier checkout flow.
4. **Diagnostic Blindspots:** Field engineers struggling to determine whether restaurant complaints stem from poor cellular/WiFi signals, printer failures, backend database lock contention, or user panic behavior.

---

## 2. Warm Friendly UI Design & Two Dedicated Operational Views

RestoPulse employs a **Warm & Friendly (Orange & White)** palette—warm cream canvas `#fffaf5`, crisp white rounded cards, and welcoming `#ea580c` accents—separated into **2 Dedicated Operational Views** to keep daily cashier and kitchen workflows uncluttered by diagnostic data:

### 2.1 View 1: Restaurant Operations (Client View)
Dedicated to cashiers, waitstaff, and kitchen cooks:
- **POS & QR Ordering (Left Column):** Language switcher, 6 curated food & beverage items, interactive cart, automated 10% PB1 restaurant tax calculation, Optimistic UI checkout button (<50ms feedback), client-side Idempotency Key generator, and rapid double-tap debounce guard.
- **Kitchen Display System / KDS (Right Column):** Live FIFO order ticket stream, culinary checklist, ticking elapsed cook timers, status transition controls (*Start Cooking* $\rightarrow$ *Mark Served*), and a real-time hardware status bar for the Bluetooth thermal printer and QRIS gateway.

### 2.2 View 2: Field Engineer Sandbox & Diagnostic Logs
Dedicated to site reliability engineers and field testing:
- **4 Real-World Chaos Switches:** Restaurant WiFi Drop (Offline Queue), Peak-Hour Bad Network Latency (2500ms), Bluetooth Thermal Printer Disconnect, and Backend 500 Database Lock Contention.
- **Live Resiliency KPI Metrics:** Total orders placed, duplicate taps successfully blocked, offline orders queued, and active simulated latency.
- **Structured Diagnostic Log Inspector:** Category filters (`[NETWORK]`, `[HARDWARE]`, `[UX_BEHAVIOR]`, `[BACKEND]`), text search, JSON export, and automated root-cause diagnostics.

*(A **"3 Columns" (Split View)** option is also provided in the top navigation bar for side-by-side comparative inspection on widescreen displays).*

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

## 3. Business Rules for Column 1: POS & QR Ordering

### 3.1 Multilingual Support & Localization
The system provides zero-reload dynamic localization across 3 major languages:
- **English (`en`)** — Default global business language.
- **Bahasa Indonesia (`id`)** — Domestic standard operating language.
- **Simplified Chinese / 简体中文 (`zh`)** — International dining and tourist language.

Every menu item includes localized `name`, `category`, `description`, and `badge` properties. All UI buttons, receipt details, and kitchen tickets update dynamically when switching languages.

### 3.2 Curated Menu Catalog
The catalog features 6 authentic items across multiple categories:
1. **RestoPulse Signature Fried Rice** (*Nasi Goreng Spesial RestoPulse* / 脉搏特制印尼炒饭) — Mains
2. **Honey Spicy Grilled Chicken** (*Ayam Bakar Madu Pedas* / 蜜汁香辣烤鸡) — Mains
3. **Wok Seafood Fried Noodles** (*Mie Goreng Seafood Wok* / 镬气海鲜炒面) — Mains
4. **Sweet Jasmine Iced Tea** (*Es Teh Manis Melati* / 冰甜茉莉花茶) — Beverages
5. **Palm Sugar Iced Latte** (*Kopi Susu Gula Aren* / 椰糖冰拿铁咖啡) — Beverages
6. **Caramel Cheese Crispy Banana** (*Pisang Goreng Keju Karamel* / 焦糖芝士脆香蕉) — Desserts

### 3.3 Client-Side Idempotency Key
- Whenever items are added to the cart, the system binds a unique RFC4122 `UUID v4` as the transaction's `Idempotency Key`.
- This key is transmitted both via the `X-Idempotency-Key` HTTP header and in the order payload.
- If a network request times out, drops mid-flight, or is retried by an offline sync queue, the exact same `Idempotency Key` is preserved.
- The Go backend verifies the key against the database:
  - **New Key:** The backend atomically commits the order, writes ticket items, and responds with `201 Created`.
  - **Existing Key:** The backend absorbs the duplicate, safely returning the existing committed order (`200 OK` / `idempotent_replay: true`) without charging the customer twice or duplicating kitchen tickets.

### 3.4 Optimistic UI Feedback (<50ms)
- When the **"Checkout & Print Receipt (QRIS)"** button is pressed, the client interface **does not wait** for the server HTTP roundtrip.
- Within **< 50 milliseconds**, the interface immediately:
  1. Triggers micro-animations (pulse feedback and celebratory confetti).
  2. Emits an audible success chime.
  3. Clears the cart for the next customer.
  4. Stages the order into the local order stream and KDS with status `PROCESSING` or `QUEUED_OFFLINE`.
  5. Opens the digital receipt modal.
- This eliminates the cashier's perception of app lag, preventing panic-induced spam clicks.

### 3.5 Rapid Double-Tap Debounce Guard
- If a user rapidly taps Checkout more than once within **$\le 1500$ milliseconds**:
  1. The checkout button is instantly debounced and locked.
  2. Subsequent taps are discarded on the client side before any network requests are dispatched.
  3. The system emits a structured diagnostic event:  
     `[UX_BEHAVIOR] [UX_FRICTION: Rapid Double-Tap Prevented] User tapped 'Checkout' again after only 240ms. Duplicate click blocked; original intent preserved.`

### 3.6 Offline Sync Queue (Store-and-Forward)
- If the browser detects offline status or simulated **WiFi Drop**:
  1. The order is not rejected.
  2. The full transaction payload is enqueued into persistent browser LocalStorage (`QUEUED_OFFLINE`).
  3. The order badge displays `(Queued Offline)`, and the top navigation bar shows an alert counter (`X Orders Queued Offline`).
  4. When network connectivity is restored (simulated WiFi toggle turned off), the system automatically triggers a background batch reconciliation (`POST /api/v1/orders/batch-sync`) to commit all queued orders without staff intervention.

---

## 4. Business Rules for Column 2: Kitchen Display System (KDS)

### 4.1 Live Ticket Stream & Chef Checklist
- Incoming orders appear in strict First-In, First-Out (FIFO) chronological sequence.
- Each ticket displays the table number, order number, waiting duration, and an interactive checklist allowing line cooks to cross off prepared dishes.

### 4.2 Status Transitions
- Tickets follow a controlled state machine:
  - **`PENDING`** (Red border, pulsing): Order received, awaiting preparation.
  - **`PREPARING`** (Amber border): Cook pressed "Start Cooking", kitchen timer active.
  - **`SERVED`** (Emerald badge): Cook pressed "Mark Served", order fulfilled.

### 4.3 Hardware Fault Isolation (Printer Resilience)
- Kitchen ticket processing is completely decoupled from receipt printer hardware.
- If the Bluetooth printer status is `DISCONNECTED` or `PAPER_OUT`:
  1. The cashier checkout flow does **not** fail.
  2. The kitchen ticket displays normally in the KDS.
  3. The ticket card highlights an amber warning: **"Receipt Queued for Reprint (Printer was offline during checkout)"**.
  4. A **"Reprint"** button allows staff to reprint the receipt once the printer is reconnected.

---

## 5. Business Rules for Column 3: Field Chaos Engineering Sandbox

### 5.1 The 4 Real-World Chaos Switches
1. **Simulate Restaurant WiFi Drop (Offline Mode):** Intercepts client-side network calls, forcing the POS terminal into LocalStorage offline queue mode.
2. **Simulate Peak-Hour Bad Network Latency (2500ms):** Injects an artificial 2500ms latency to test Optimistic UI responsiveness and double-tap prevention.
3. **Simulate Bluetooth Thermal Printer Disconnect:** Simulates hardware power failure or paper runout, verifying that kitchen tickets continue flowing smoothly.
4. **Simulate Backend 500 DB Lock Contention:** Instructs the backend to simulate a database lock (`deadlock detected / database is locked`), verifying that the cashier's cart remains intact with user-friendly error guidance.

### 5.2 Structured Diagnostic Log Inspector
- Ingests real-time events across 4 distinct categories:
  - `[NETWORK]`: Connection drops, batch sync resolutions, API latencies.
  - `[HARDWARE]`: Printer connections, disconnects, paper shortages, receipt reprints.
  - `[UX_BEHAVIOR]`: Rapid double-taps, client-side idempotency guards.
  - `[BACKEND]`: Server 500 deadlocks, order commitments, database migrations.
- Features category filtering, keyword search, one-click JSON audit log export, and **Automated Root-Cause Explanations** that translate technical telemetry into plain-English incident diagnoses.
