# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox
## Arsitektur Teknis Sistem & Desain Mesin

**Dokumen Pendamping:** [ABOUT-APPS.md](ABOUT-APPS.md) — spesifikasi aplikasi dan aturan bisnis · [FITUR-APLIKASI.md](FITUR-APLIKASI.md) — matriks rincian fitur

Dokumen ini mendefinisikan **bagaimana** sistem dibangun secara teknis: struktur modul, skema basis data, mesin idempotensi, antrian sinkronisasi luring, injeksi kekacauan (*chaos injection*), serta kontrak antarmuka API RESTful.

---

## 1. Topologi Sistem & Tumpukan Teknologi

Sistem dirancang sebagai aplikasi web *fullstack* terpadu dengan arsitektur modular yang ringan, cepat, dan siap dijalankan secara portabel tanpa instalasi rumit:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (BROWSER CLIENT)                       │
│  React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons           │
│                                                                        │
│  ┌──────────────────────┬──────────────────────┬────────────────────┐  │
│  │     KOLOM 1: POS     │     KOLOM 2: KDS     │   KOLOM 3: CHAOS   │  │
│  │  - Optimistic UI     │  - Real-time Board   │  - Chaos Engine    │  │
│  │  - Idempotency Gen   │  - Printer Manager   │  - Log Streamer    │  │
│  │  - Local Queue (IDB) │  - Hardware Badges   │  - Root-Cause Diag │  │
│  └──────────┬───────────┴──────────┬───────────┴──────────▲─────────┘  │
│             │                      │                      │            │
│             ▼                      ▼                      │            │
│      ┌──────────────────────────────────────────────┐     │            │
│      │     CLIENT-SIDE CHAOS INTERCEPTOR AXIOS      │─────┘            │
│      │  • Offline Drop Interception                 │                  │
│      │  • Latency Delay (2500ms sleep)              │                  │
│      │  • Double-Click Blocker & UX Event Emitter   │                  │
│      └──────────────────────┬───────────────────────┘                  │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │ HTTP / REST / JSON
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND ENGINE (GO + GIN)                       │
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
│  │ GORM DATA ACCESS LAYER (ORM)                                     │  │
│  │  • Transactions & Mutex Lock Handlers                            │  │
│  │  • SQLite3 (Default Zero-Config) / PostgreSQL Fallback           │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    STORAGE / PERSISTENCE      │
                      │  • restopulse.db (SQLite3)    │
                      │  • PostgreSQL 16 (Opsional)   │
                      └───────────────────────────────┘
```

### 1.1 Pemilihan Tumpukan Teknologi (Tech Stack Rationale)

| Komponen | Teknologi | Alasan Pemilihan |
|---|---|---|
| **Backend Framework** | **Go 1.21+ (Gin Web Framework)** | Kinerja sangat tinggi (*sub-millisecond latency*), *memory footprint* minimal (<25MB RAM), *concurrency* bawaan (*goroutines*), dan kompilasi biner tunggal (*single binary output*). |
| **ORM & Persistence** | **GORM + SQLite3 (atau PostgreSQL)** | *Zero-config portable deployment*. Pengguna dapat langsung menjalankan backend tanpa instalasi database server terpisah. Didukung struktur relasional tabel lengkap dengan indeks unik. |
| **Frontend Framework**| **React 18 + TypeScript + Vite** | Reaktivitas cepat, *type-safety*, ekosistem komponen luas, dan waktu kompilasi kilat (*Instant HMR*). |
| **Styling & Ikon** | **Tailwind CSS + Lucide React** | Desain modern, adaptif, responsif, dan estetika premium kelas F&B komersial (Square/Toast/Lightspeed vibes). |
| **Penyimpanan Klien** | **LocalStorage / IndexedDB (Zustand persist)** | Penyimpanan antrian luring (*offline sync queue*) yang bertahan dari *refresh* atau penutupan peramban. |
| **Kontainerisasi** | **Docker & Docker Compose** | *Multi-stage build* untuk menghasilkan image Docker yang ramping dan portabel. |

---

## 2. Skema Basis Data Relasional

Struktur basis data mencakup 5 entitas inti: `orders`, `order_items`, `idempotency_records`, `diagnostic_logs`, dan `chaos_configs`.

### 2.1 Definisi Tabel SQL (DDL)

```sql
-- 1. Tabel Pesanan (Orders)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,                   -- UUID v4
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,   -- Mencegah pesanan ganda
    order_number VARCHAR(16) NOT NULL,            -- Misal: #RP-1001
    table_number VARCHAR(8) NOT NULL,             -- Misal: "T-04", "TA-01"
    customer_name VARCHAR(64) NOT NULL,           -- Nama pemesan / kasir
    total_amount NUMERIC(12, 2) NOT NULL,         -- Total harga transaksi (IDR)
    payment_method VARCHAR(16) NOT NULL,          -- "QRIS", "CASH", "CARD"
    payment_status VARCHAR(16) NOT NULL,          -- "PAID", "PENDING"
    kds_status VARCHAR(16) NOT NULL,              -- "PENDING", "PREPARING", "SERVED", "CANCELLED"
    print_status VARCHAR(16) NOT NULL,            -- "PRINTED", "QUEUED_FOR_REPRINT", "FAILED"
    sync_status VARCHAR(16) NOT NULL,             -- "SYNCED", "QUEUED_OFFLINE"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_orders_kds_status ON orders(kds_status);
CREATE INDEX idx_orders_idempotency_key ON orders(idempotency_key);

-- 2. Tabel Rincian Item Pesanan (Order Items)
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(36) PRIMARY KEY,                   -- UUID v4
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    notes TEXT,
    subtotal NUMERIC(12, 2) NOT NULL
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- 3. Tabel Riwayat Kunci Idempotensi (Idempotency Audit)
CREATE TABLE IF NOT EXISTS idempotency_records (
    key VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    request_hash VARCHAR(64),
    response_body TEXT,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Log Diagnostik (Diagnostic Logs)
CREATE TABLE IF NOT EXISTS diagnostic_logs (
    id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(16) NOT NULL,                 -- "NETWORK", "HARDWARE", "UX_BEHAVIOR", "BACKEND"
    level VARCHAR(16) NOT NULL,                    -- "INFO", "WARN", "ERROR", "CRITICAL"
    root_cause VARCHAR(64) NOT NULL,               -- Misal: "RAPID_DOUBLE_TAP", "PRINTER_OFFLINE"
    latency_ms INTEGER DEFAULT 0,
    message TEXT NOT NULL,
    metadata JSON
);
CREATE INDEX idx_diagnostic_logs_category ON diagnostic_logs(category);
CREATE INDEX idx_diagnostic_logs_timestamp ON diagnostic_logs(timestamp);

-- 5. Tabel Konfigurasi Simulasi Chaos (Chaos Configs)
CREATE TABLE IF NOT EXISTS chaos_configs (
    id INTEGER PRIMARY KEY CHECK (id = 1),         -- Baris tunggal konfigurasi
    wifi_offline BOOLEAN DEFAULT FALSE,
    bad_network_latency_ms INTEGER DEFAULT 0,
    printer_status VARCHAR(16) DEFAULT 'CONNECTED',-- "CONNECTED", "PAPER_OUT", "DISCONNECTED"
    db_lock_simulated BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Desain Mesin & Pola Arsitektur Inti

### 3.1 Mesin Idempotensi & Pencegahan Duplikasi (Idempotency Engine)

Pola idempotensi dirancang untuk menjamin bahwa permintaan berulang dengan kunci yang sama **tidak pernah** menghasilkan transaksi ganda.

```
Pengguna Tekan Tombol Bayar
         │
         ▼
[ Client POS ] ──(1. Generate Intent UUID)──> Idempotency-Key: "550e8400-e29b-..."
         │
         ├──(2. Optimistic UI <50ms)──> Bersihkan keranjang, tampilkan tiket
         │
         ▼
[ Chaos Interceptor ] (Cek mode Offline / Latency 2500ms)
         │
         ▼ (HTTP POST /orders)
[ Go Gin Backend ]
         │
         ▼
[ GORM DB Transaction ]
         │
   ┌─────┴───────────────────────────────┐
   │ Apakah Key ada di Basis Data?       │
   └─────┬───────────────────────────────┘
         │
   ┌─────┴───────────────────────────────┐
   ▼                                     ▼
[ SUDAH ADA ]                       [ BELUM ADA ]
Log: [BACKEND] Idempotency Hit      Insert `orders` & `order_items`
Return 200 OK (Existing Order)       Insert `idempotency_records`
Tanpa Menambah Tiket KDS Baru        Return 201 Created
                                    KDS Tampilkan Tiket Baru
```

### 3.2 Mesin Toleransi Perangkat Keras Printer (Hardware Fault Isolation)

Ketika kasir mencetak pesanan tetapi printer Bluetooth dalam status `DISCONNECTED` atau `PAPER_OUT`:
1. Sistem **tidak melempar error gagal order**. Transaksi finansial dan pesanan dapur adalah prioritas tertinggi restoran.
2. Status cetak tiket diatur menjadi `print_status = "QUEUED_FOR_REPRINT"`.
3. Di sisi UI KDS dan POS, lencana kuning *"Receipt Queued for Reprint"* berkedip, dilengkapi tombol *"Reprint Receipt"*.
4. Log terstruktur `[HARDWARE] [PRINTER_OFFLINE]` dicatat lengkap dengan data stempel waktu.
5. Ketika printer kembali terhubung (`CONNECTED`), event handler memeriksa antrian dan mengizinkan cetak ulang massal (*flush reprint queue*).

### 3.3 Antrian Sinkronisasi Luring (Offline Sync Queue Machine)

Ketika konektivitas WiFi terputus (`wifi_offline = true` atau `navigator.onLine = false`):

```
Pesanan Dibuat Saat Offline
         │
         ▼
[ Client LocalStorage Queue ]
Simpan payload JSON + status: "QUEUED_OFFLINE"
Badge: "Unsynced Orders: 1"
         │
         ▼ (Koneksi WiFi Pulih)
[ Network Restored Listener ]
         │
         ▼ (Kirim Batch)
POST /api/v1/orders/batch-sync
Payload: [ Order1, Order2, ... ]
         │
         ▼
[ Go Backend Batch Handler ]
Looping pemrosesan transaksi ber-Idempotency Key
Reconcile orders -> Simpan yang belum ada, Lewati yang duplikat
         │
         ▼
Return 200 OK dengan laporan:
{ "synced_count": 2, "duplicates_skipped": 0 }
         │
         ▼
Client kosongkan antrian offline & ubah label status jadi "SYNCED"
```

---

## 4. Spesifikasi Kontrak RESTful API

Seluruh rute API diawali dengan `/api/v1`. Format data bertukar secara konsisten menggunakan JSON (`Content-Type: application/json`).

### 4.1 Ringkasan Endpoint

| Metode | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/health` | Pemeriksaan kesehatan server Go dan koneksi basis data. |
| `GET` | `/api/v1/menu` | Mengambil 6 item menu terlokalisasi (ID, EN, ZH). |
| `POST`| `/api/v1/orders` | Membuat pesanan baru dengan validasi `X-Idempotency-Key`. |
| `POST`| `/api/v1/orders/batch-sync`| Sinkronisasi pesanan offline secara massal (*batch*). |
| `GET` | `/api/v1/orders` | Mengambil seluruh riwayat pesanan aktif untuk KDS & POS. |
| `PATCH`| `/api/v1/orders/:id/status`| Mengubah status tiket KDS (`PENDING` -> `PREPARING` -> `SERVED`). |
| `POST`| `/api/v1/orders/:id/reprint`| Memicu cetak ulang struk setelah printer normal. |
| `GET` | `/api/v1/chaos/config` | Mengambil status sakelar gangguan (*chaos toggles*). |
| `POST`| `/api/v1/chaos/config` | Memperbarui parameter gangguan (*latency, db lock, dll*). |
| `GET` | `/api/v1/logs` | Mengambil daftar log diagnostik terstruktur. |
| `POST`| `/api/v1/logs` | Mengirimkan log dari peramban ke server. |

### 4.2 Contoh Kontrak Detail

#### `POST /api/v1/orders`
**Request Headers:**
```http
Content-Type: application/json
X-Idempotency-Key: 7b5a8321-789a-4cde-a123-abcdef012345
```

**Request Body:**
```json
{
  "idempotency_key": "7b5a8321-789a-4cde-a123-abcdef012345",
  "table_number": "T-03",
  "customer_name": "Kasir 1 / Meja 3",
  "payment_method": "QRIS",
  "items": [
    {
      "menu_item_id": "m1",
      "name": "Nasi Goreng Spesial RestoPulse",
      "price": 38000,
      "quantity": 2,
      "notes": "Pedas sedang, tanpa acar"
    },
    {
      "menu_item_id": "m4",
      "name": "Es Teh Manis Melati",
      "price": 8000,
      "quantity": 2,
      "notes": "Es sedikit"
    }
  ],
  "client_created_at": "2026-10-27T19:35:00Z"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Order processed successfully",
  "data": {
    "id": "e98e4d3a-1234-4567-89ab-cdef01234567",
    "order_number": "#RP-1008",
    "table_number": "T-03",
    "customer_name": "Kasir 1 / Meja 3",
    "total_amount": 92000,
    "payment_method": "QRIS",
    "payment_status": "PAID",
    "kds_status": "PENDING",
    "print_status": "PRINTED",
    "sync_status": "SYNCED",
    "created_at": "2026-10-27T19:35:00Z"
  }
}
```

**Response (200 OK - Idempotent Replay):**
Jika dikirim ulang dengan `Idempotency-Key` yang sama, server mengembalikan data pesanan yang sudah ada dengan header `X-Idempotent-Replay: true`.

---

## 5. Middleware Chaos & Diagnostik Terstruktur

Di sisi server Go, middleware memeriksa apakah simulasi aktif:
1. **Latency Delay:**
   ```go
   if chaosConfig.BadNetworkLatencyMs > 0 {
       time.Sleep(time.Duration(chaosConfig.BadNetworkLatencyMs) * time.Millisecond)
   }
   ```
2. **Database Lock Emulation:**
   ```go
   if chaosConfig.DBLockSimulated {
       c.JSON(http.StatusInternalServerError, gin.H{
           "error": "pq: deadlock detected / sqlite3: database is locked",
           "code": "DB_LOCK_CONTENTION",
           "root_cause": "BACKEND",
       })
       c.Abort()
       return
   }
   ```
3. **Structured Logger:**
   Mencatat durasi setiap *handler*, stempel waktu mikrodetik, dan mempublikasikan log terstruktur ke tabel `diagnostic_logs`.
