# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox

> **A mission-critical Fullstack Restaurant POS, Kitchen Display System (KDS), and Field Chaos Engineering Sandbox** designed to conquer flaky restaurant WiFi, double-tap transaction panics, thermal printer jams, and backend database lock contention.

---

## Arsitektur Selayang Pandang (3-Column Interactive Dashboard)

RestoPulse menyajikan sebuah dashboard interaktif terintegrasi yang terbagi menjadi **3 kolom berdampingan** tanpa keharusan login, dirancang untuk memudahkan staf F&B dan Field Reliability Engineer menguji skenario lapangan secara *real-time*:
RestoPulse kini hadir dengan tampilan **Warm & Friendly (Orange & White)** yang ramah dan segar, serta dilengkapi **2 Tampilan Utama Terpisah** agar operasional kasir/dapur rapi dan tidak terdistraksi oleh log teknis:

1. **Tampilan Operasional Restoran (Client View):** Kolom 1 (POS / QR Ordering) dan Kolom 2 (Kitchen Display System / KDS) berdampingan secara fokus untuk staf kasir dan koki.
2. **Tampilan Konfigurasi Sandbox & Log Insinyur (Field Sandbox View):** Halaman khusus kontrol 4 sakelar gangguan lapangan (*chaos switches*) dan penampil log diagnostik ber-analisis akar masalah (*Root-Cause Diagnosis*).
*(Tersedia opsi tombol **"3 Kolom Sekaligus"** untuk pengujian menyeluruh pada layar lebar).*

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│  TAMPILAN 1: OPERASIONAL RESTORAN     │  TAMPILAN 2: SANDBOX & LOGS           │
│  (Kasir POS & Kitchen KDS Display)    │  (Field Chaos Toggles & Root-Cause)   │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ • POS Menu Grid & Keranjang Belanja   │ • 4 Chaos Toggles (WiFi, Latency,     │
│ • Idempotency Key & Optimistic UI     │   Printer Disconnect, DB 500 Lock)    │
│ • Rapid Double-Tap Blocker            │ • Live KPI Resiliency Metrics         │
│ • KDS Live Tickets (Pending->Cook)    │ • Structured Log Inspector            │
│ • Hardware Status (Printer, QRIS)     │ • Automated Root-Cause Diagnosis      │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## Peta Dokumen Teknis (Documentation Map)

| Dokumen | Deskripsi | Status |
|---|---|---|
| [docs/ABOUT-APPS.md](docs/ABOUT-APPS.md) | **Spesifikasi Aplikasi & Aturan Bisnis**: Penjelasan mendalam tentang problem statement industri F&B, aturan bisnis idempotensi, toleransi kegagalan printer, dan antrian offline. | **Otoritatif** untuk Aturan Bisnis |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | **Desain Teknis & Arsitektur Sistem**: Topologi service, skema database DDL relasional, desain mesin idempotensi, interseptor chaos, dan kontrak RESTful API. | **Otoritatif** untuk Arsitektur |
| [docs/FITUR-APLIKASI.md](docs/FITUR-APLIKASI.md) | **Daftar Fitur & Matriks Spesifikasi**: 36 fitur fungsional dan teknis (F01–F36) terbagi dalam 4 area operasional lengkap dengan kriteria verifikasi. | Lengkap |

---

## Tumpukan Teknologi (Tech Stack)

- **Backend:** Go 1.21+ dengan framework **Gin**, **GORM**, dan **SQLite3** (default zero-config portable database) dengan arsitektur siap alih ke **PostgreSQL**.
- **Frontend:** **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, dan ikon **Lucide React**.
- **Kontainerisasi:** **Dockerfile** multi-stage dan **docker-compose.yml** siap pakai.

---

## Fitur Utama

### 1. POS / QR Ordering (Customer & Staff View)
- **Multilingual Support:** Sakelar bahasa instan di baris atas untuk **Bahasa Indonesia (ID)**, **English (EN)**, dan **Chinese Simplified (ZH 简体中文)**.
- **6 Pilihan Menu Restoran:** Dilengkapi foto, harga IDR, kategori, dan opsi catatan khusus (misal: "tanpa pedas").
- **Client-Side Idempotency Keys:** Setiap intent pemesanan menghasilkan UUID unik yang dikirim via header `X-Idempotency-Key` dan payload, menjamin transaksi ganda tidak pernah tercipta meskipun terjadi retry otomatis.
- **Optimistic UI Feedback (<50ms):** Umpan balik visual instan di bawah 50 milidetik saat tombol Checkout ditekan, memecahkan masalah *"nothing happens when I tap"*.
- **Pencegahan Double-Tap Cepat:** Mendeteksi klik ganda kasir yang panik dalam selang 1500ms, memblokir pengiriman network berulang, dan memancarkan log `[UX_FRICTION: Rapid Double-Tap Prevented]`.
- **Offline Sync Queue:** Jika WiFi drop, pesanan otomatis disimpan di LocalStorage dengan status `Queued Offline`, dan di-flush otomatis via batch sync endpoint `POST /api/v1/orders/batch-sync` saat online kembali.

### 2. Kitchen Display System (KDS) & Hardware Status
- **Live Ticket Board:** Tiket pesanan dapur masuk seketika dengan alur status: `Pending` -> `Preparing` -> `Served`.
- **Bilah Status Perangkat Keras:** Menampilkan status langsung *Bluetooth Thermal Printer* (`Connected`, `Paper Out`, `Disconnected`) dan *QRIS Payment Gateway*.
- **Graceful Printer Fallback:** Jika printer mati/terputus, transaksi tetap sukses di database dan tiket dapur tetap berjalan, disertai lencana peringatan **"Receipt Queued for Reprint"** dan tombol cetak ulang saat printer normal kembali.

### 3. Field Engineer Chaos Simulator & Diagnostic Sandbox
- **4 Sakelar Gangguan Lapangan:**
  1. *Simulate Restaurant WiFi Drop (Offline Mode)*
  2. *Simulate Peak-Hour Bad Network (2500ms API Latency)*
  3. *Simulate Bluetooth Printer Disconnected*
  4. *Simulate Backend 500 Database Lock (`pq: deadlock detected / sqlite3: locked`)*
- **Structured Root-Cause Log Inspector:** Menampilkan log real-time dengan kategori:
  - `[NETWORK]`
  - `[HARDWARE]`
  - `[UX_BEHAVIOR]`
  - `[BACKEND]`
  Lengkap dengan stempel waktu, payload latency, dan diagnosa otomatis solusi insiden.

---

## Panduan Menjalankan Aplikasi (Quickstart)

### Opsi 1: Menjalankan dengan Docker Compose (Satu Perintah)

```bash
docker compose up --build
```
Aplikasi akan tersedia di:
- **Frontend Dashboard:** `http://localhost:5173`
- **Backend API:** `http://localhost:8080/api/v1`
- **Healthcheck:** `http://localhost:8080/api/v1/health`

---

### Opsi 2: Menjalankan Secara Lokal (Development Mode)

#### 1. Menjalankan Backend (Go)
```bash
cd backend
go run main.go
# Server berjalan di port :8080 dengan database SQLite otomatis (restopulse.db)
```

#### 2. Menjalankan Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Dashboard berjalan di http://localhost:5173
```

---

## Kontrak Endpoint RESTful API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/health` | Pemeriksaan kesehatan backend dan database |
| `GET` | `/api/v1/menu` | Mengambil data 6 menu makanan & minuman |
| `POST` | `/api/v1/orders` | Checkout pesanan baru (dengan `X-Idempotency-Key`) |
| `POST` | `/api/v1/orders/batch-sync` | Sinkronisasi pesanan offline secara massal |
| `GET` | `/api/v1/orders` | Mengambil seluruh daftar pesanan dapur & kasir |
| `PATCH` | `/api/v1/orders/:id/status` | Mengubah status tiket dapur (`PENDING`/`PREPARING`/`SERVED`) |
| `POST` | `/api/v1/orders/:id/reprint` | Memproses cetak ulang struk tiket |
| `GET` | `/api/v1/chaos/config` | Mengambil konfigurasi sakelar simulasi |
| `POST` | `/api/v1/chaos/config` | Memperbarui parameter gangguan di backend |
| `GET` | `/api/v1/logs` | Mengambil riwayat log diagnostik terstruktur |
| `POST` | `/api/v1/logs` | Mengirim log diagnostik baru dari client |

---

## Lisensi & Hak Cipta
Dikembangkan untuk komunitas F&B Tech dan Reliabilitas Sistem Lapangan (Field SRE).
