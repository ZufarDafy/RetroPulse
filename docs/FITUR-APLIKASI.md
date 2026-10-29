# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox
## Daftar Fitur Aplikasi & Matriks Spesifikasi

**Dokumen Rujukan:** [ABOUT-APPS.md](ABOUT-APPS.md) — spesifikasi aplikasi dan aturan bisnis · [ARCHITECTURE.md](ARCHITECTURE.md) — desain teknis

---

## 1. Cara Membaca Dokumen Ini

Dokumen ini memuat seluruh fitur fungsional dan teknis aplikasi **RestoPulse**, dikelompokkan ke dalam 4 domain operasional:
1. **POS / QR Ordering (Kolom 1)**
2. **Kitchen Display System & Hardware Engine (Kolom 2)**
3. **Field Engineer Chaos Simulator & Diagnostic Sandbox (Kolom 3)**
4. **Data Persistence, Offline Sync & Cross-Cutting Architecture**

### Kode Lapisan Sistem:
- **B**: Backend (Go + Gin Framework + GORM)
- **F**: Frontend (React 18 + TypeScript + Vite + Tailwind CSS)
- **DB**: Lapisan Penyimpanan (GORM SQLite/PostgreSQL & LocalStorage)

---

## 2. Bagian I — Matriks Fitur Fungsional

### Area 1: POS & QR Ordering (Customer & Staff View - Kolom 1)

| Kode | Lapis | Nama Fitur | Deskripsi Fungsional | Kriteria Keberhasilan / Verifikasi |
|---|---|---|---|---|
| **F01** | F | Pemilih Bahasa Dinamis (Multilingual Switcher) | Pilihan 3 bahasa di bagian atas: Bahasa Indonesia (ID), English (EN), dan Chinese (ZH 简体中文). | Mengubah label tombol, kategori, dan deskripsi 6 menu seketika tanpa me-refresh halaman. |
| **F02** | F · DB | Katalog 6 Menu Restoran Pilihan | 6 item menu makanan/minuman dengan foto, harga rupiah, lencana kategori, dan tombol tambah cepat. | Pengguna dapat menambahkan item dengan kuantitas dan catatan khusus. |
| **F03** | F | Ringkasan Keranjang Belanja Interaktif | Menghitung subtotal, pajak (PB1 10%), dan total akhir secara reaktif. | Kuantitas dapat dinaik-turunkan; item dapat dihapus seketika. |
| **F04** | F | Generator Idempotency Key Mandiri | Menghasilkan UUID v4 unik pada setiap inisiasi pesanan. | Kunci dipertahankan di memori/storage selama pesanan belum tuntas atau saat retry. |
| **F05** | F | Umpan Balik Optimistik (<50ms Optimistic UI) | Respon antarmuka visual instan (<50ms) saat tombol checkout ditekan, sebelum ada respon HTTP server. | Keranjang langsung kosong, animasi order terkirim muncul tanpa menunggu roundtrip server. |
| **F06** | F | Deteksi & Pencegahan Double-Tap Cepat | Mencegah kasir menekan tombol bayar berulang kali dalam jendela 1500ms saat latensi tinggi. | Tombol dikunci (disabled); log `[UX_FRICTION: Rapid Double-Tap Prevented]` tercatat. |
| **F07** | F · DB | Antrian Penyimpanan Luring (Offline Queue) | Menyimpan pesanan ke LocalStorage saat WiFi mati (`wifi_offline = true`). | Pesanan diberi status "Queued Offline"; lencana "Unsynced Orders" menyala. |
| **F08** | B · F | Otomatisasi Sinkronisasi Batch (Batch Sync) | Mengirimkan seluruh pesanan offline ke endpoint batch sync saat koneksi pulih. | Semua pesanan offline beralih status ke "Synced"; tiket otomatis masuk ke KDS. |
| **F09** | F | Pemilihan Nomor Meja & Metode Pembayaran | Mendukung input Meja (misal: T-01 s/d T-20) dan pilihan QRIS / Tunai. | Validasi form sederhana sebelum checkout diaktifkan. |
| **F10** | F | Modal Tampilan Struk Digital (Digital Receipt) | Menampilkan preview struk pembayaran kasir lengkap dengan nomor transaksi dan QR code mock. | Dapat dipicu manual atau otomatis setelah checkout sukses. |

---

### Area 2: Kitchen Display System (KDS) & Hardware Engine (Kolom 2)

| Kode | Lapis | Nama Fitur | Deskripsi Fungsional | Kriteria Keberhasilan / Verifikasi |
|---|---|---|---|---|
| **F11** | B · F | Antrian Tiket Dapur Real-Time (Live KDS Board) | Menampilkan pesanan masuk terurut FIFO dengan indikator waktu tunggu. | Tiket baru dari POS langsung muncul di kolom dapur tanpa reload. |
| **F12** | B · F | Transisi Status Tiket KDS Bertahap | Siklus perubahan status: `PENDING` -> `PREPARING` -> `SERVED` (dengan tombol aksi). | Perubahan status tersimpan di backend dan memperbarui warna visual kartu. |
| **F13** | F | Bilah Status Hardware Bluetooth Thermal Printer | Indikator visual status printer: `CONNECTED` (Hijau), `PAPER_OUT` (Kuning), `DISCONNECTED` (Merah). | Status berubah reaktif mengikuti toggle di Kolom 3. |
| **F14** | F | Bilah Status QRIS Payment Gateway | Menampilkan status konektivitas payment gateway: `OPERATIONAL` atau `DEGRADED`. | Berfungsi sebagai indikator visual kesiapan transaksi kasir. |
| **F15** | B · F | Toleransi Kegagalan Printer (Reprint Warning Badge) | Jika printer `DISCONNECTED`, pesanan tetap sukses di DB, namun muncul badge "Receipt Queued for Reprint". | Pesanan dapur tidak macet; badge berkedip kuning; ada opsi tombol reprint. |
| **F16** | F | Tombol Cetak Ulang Struk (Reprint Receipt) | Tombol pada tiket pesanan untuk mencetak ulang struk setelah printer terhubung kembali. | Memancarkan log `[HARDWARE] Receipt reprinted successfully` dan menghilangkan peringatan. |
| **F17** | F | Penghitung Durasi Pesanan (Cooking Duration Timer) | Menghitung elapsed time pesanan sejak dibuat dalam format mm:ss. | Memberi peringatan visual (merah) jika pesanan belum disajikan > 10 menit. |
| **F18** | B · F | Filter Tampilan Tiket KDS | Filter tiket berdasarkan status: Semua, Aktif (Pending + Preparing), atau Selesai (Served). | Membantu koki fokus pada pesanan yang sedang dimasak. |

---

### Area 3: Field Engineer Chaos Simulator & Diagnostic Sandbox (Kolom 3)

| Kode | Lapis | Nama Fitur | Deskripsi Fungsional | Kriteria Keberhasilan / Verifikasi |
|---|---|---|---|---|
| **F19** | F | Sakelar Gangguan 1: WiFi Drop (Offline Mode) | Memutus komunikasi jaringan client ke server seketika via interseptor. | Menguji ketahanan offline queue dan graceful fallback kasir. |
| **F20** | B · F | Sakelar Gangguan 2: Bad Network Latency (2500ms) | Menginjeksi delay 2500ms pada setiap request API ke backend. | Menguji efektivitas Optimistic UI dan ketahanan terhadap kepanikan user. |
| **F21** | F | Sakelar Gangguan 3: Bluetooth Printer Disconnected | Memutus printer Bluetooth virtual secara sengaja. | Menguji pemisahan kegagalan hardware (hardware fault isolation). |
| **F22** | B · F | Sakelar Gangguan 4: Backend 500 DB Lock Contention | Memerintahkan backend untuk melempar error HTTP 500 SQLite/Postgres DB Lock. | Klien menangani error dengan elegan tanpa crash atau merusak keranjang. |
| **F23** | F | Streaming Log Diagnostik Terstruktur Real-Time | Menampilkan log sistem dengan 4 kategori tag: `[NETWORK]`, `[HARDWARE]`, `[UX_BEHAVIOR]`, `[BACKEND]`. | Log baru muncul di posisi teratas dengan warna badge sesuai kategori. |
| **F24** | F | Mesin Diagnosis Otomatis Akar Masalah (Root-Cause) | Memberikan teks analisis otomatis penyebab insiden (misal: "Koneksi drop -> data dialihkan ke antrian lokal"). | Membantu field engineer memahami solusi insiden seketika. |
| **F25** | F | Filter Kategori & Pencarian Log | Memungkinkan filter log per kategori (`NETWORK`, `HARDWARE`, dll.) dan pencarian kata kunci. | Engineer dapat mengisolasi log yang relevan dalam 1 klik. |
| **F26** | F | Ekspor & Pembersihan Log Diagnostik | Tombol "Clear Logs" dan "Export JSON" untuk mengunduh riwayat audit. | Mengunduh file JSON terformat rapi untuk analisis pasca-insiden. |
| **F27** | B · F | Metrik Ringkasan Sandbox (Chaos KPI Cards) | Menampilkan ringkasan: Total Orders, Duplicates Blocked, Queued Offline, Failed Requests. | Memberikan gambaran kuantitatif dampak gangguan dan ketahanan sistem. |
| **F28** | F | Tombol Reset Seluruh Gangguan (Reset All Chaos) | Mengembalikan seluruh sakelar gangguan ke kondisi normal (Online, Latency 0, Printer Connected, DB Normal). | Mengembalikan sistem ke performa optimal dalam 1 ketukan. |

---

### Area 4: Data Persistence, Backend Engine & Docker

| Kode | Lapis | Nama Fitur | Deskripsi Fungsional | Kriteria Keberhasilan / Verifikasi |
|---|---|---|---|---|
| **F29** | B · DB | Endpoint Pembuatan Pesanan Idempoten (`POST /api/v1/orders`) | Menerima pesanan dan memeriksa kunci `X-Idempotency-Key` secara atomik di database. | Jika request dikirim 5 kali berturut-turut, DB hanya menyimpan 1 baris. |
| **F30** | B · DB | Endpoint Sinkronisasi Massal (`POST /api/v1/orders/batch-sync`) | Menerima array pesanan offline dan menyimpannya secara transaksional. | Mengembalikan jumlah pesanan yang berhasil disinkronkan dan yang diskip. |
| **F31** | B · DB | Endpoint Pengambilan Pesanan (`GET /api/v1/orders`) | Mengambil seluruh daftar pesanan aktif untuk KDS dan riwayat kasir. | Respon JSON terformat dengan rincian item pesanan. |
| **F32** | B · DB | Endpoint Update Status KDS (`PATCH /api/v1/orders/:id/status`) | Memperbarui kolom `kds_status` dengan validasi transisi status yang sah. | Status terupdate di database dengan stempel waktu `updated_at`. |
| **F33** | B · DB | Ingest & Audit Log Endpoint (`POST /api/v1/logs` & `GET /api/v1/logs`) | Menyimpan log diagnostik dari peramban ke tabel `diagnostic_logs`. | Log tersimpan persisten di basis data server. |
| **F34** | B · DB | Auto-Migration Basis Data SQLite/GORM | Menjalankan migrasi DDL otomatis saat aplikasi backend pertama kali menyala. | Tabel `orders`, `order_items`, `idempotency_records`, `diagnostic_logs` tercipta otomatis. |
| **F35** | B · F | Dockerfile Multi-Stage Terpadu | Dockerfile untuk membangun backend Go dan frontend Vite dalam kontainer ramping. | Image berukuran kecil (<50MB untuk Go binary) dan siap dijalankan. |
| **F36** | B · F | Docker Compose Orchestration (`docker-compose.yml`) | Menjalankan seluruh stack aplikasi dengan satu perintah `docker compose up`. | Layanan frontend dan backend dapat saling berkomunikasi di jaringan bridge. |
| **F37** | F · UX | Onboarding Modal & Context Explainer | Dialog pengenalan otomatis saat pertama kali membuka web yang menjelaskan latar belakang, masalah restoran nyata, dan 3 pilar arsitektur. | Dialog modal informatif dengan opsi *"Jangan tampilkan lagi"* dan tombol pemicu manual di Navbar. |
| **F38** | F · UX | Interactive Baby Steps Guide (5 Langkah) | Panduan terstruktur langkah demi langkah (Normal POS, Double-Tap, WiFi Drop, Printer Disconnect, Root Cause Logs) dengan tombol aksi langsung. | Pengguna baru memahami cara mengoperasikan dan menguji sandbox secara mandiri dalam hitungan menit. |

---

## 3. Bagian II — Urutan Pengembangan Terpadu

Pengembangan dilaksanakan secara sistematis mengikuti tahapan berikut:

```
Tahap 1: Backend Go Engine & Persistence (Gin + GORM + SQLite + Idempotency Guard)
       │
       ▼
Tahap 2: Frontend Control Plane (React + Vite + Tailwind + Multilingual POS + KDS)
       │
       ▼
Tahap 3: Field Chaos Simulator & Structured Root-Cause Diagnostic Inspector
       │
       ▼
Tahap 4: Dockerization & End-to-End Field Resilience Verification
```
