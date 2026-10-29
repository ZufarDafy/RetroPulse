# RestoPulse: Offline-Resilient Restaurant POS, KDS & Field Diagnostic Sandbox
## Spesifikasi Aplikasi & Aturan Bisnis

**Nama Sistem:** RestoPulse (Restaurant Pulse)  
**Kategori:** Point-of-Sale (POS) & Kitchen Display System (KDS) Tangguh Lapangan dengan Sandbox Simulasi Gangguan (Field Chaos Engineering)  
**Dokumen Pendamping:** [ARCHITECTURE.md](ARCHITECTURE.md) — desain teknis, skema data, dan kontrak antarmuka · [FITUR-APLIKASI.md](FITUR-APLIKASI.md) — matriks rincian fitur

---

## 1. Tentang Dokumen Ini

Dokumen ini adalah **sumber kebenaran tunggal (Single Source of Truth)** untuk aturan bisnis, alur transaksi POS, penanganan kegagalan perangkat keras (hardware resilience), toleransi latensi jaringan, logika antrian sinkronisasi offline (offline sync queue), serta sistem diagnosis akar masalah (root-cause diagnostics) pada aplikasi **RestoPulse**.

Aplikasi ini dirancang khusus untuk memecahkan dilema klasik industri Food & Beverage (F&B) di negara berkembang dan area dengan infrastruktur terbatas:
1. **WiFi Restoran Tidak Stabil:** Sambungan internet kasir sering putus-nyambung di jam sibuk (*rush hour*).
2. **Sindrom "Tapping Tanpa Respon" (Double-Tap Duplicate Order):** Kasir atau pelanggan menekan tombol Bayar berulang kali karena antarmuka tidak memberi respon instan, berujung pada double transaksi di bank dan double cetak tiket di dapur.
3. **Macetnya Printer Kasir (Bluetooth/Thermal Jam):** Kertas habis atau printer Bluetooth terputus menyebabkan transaksi menggantung dan kasir panik.
4. **Kelemahan Diagnostik:** Engineer lapangan kesulitan membedakan apakah komplain kasir disebabkan oleh jaringan seluler/WiFi yang drop, printer mati, bug backend, atau friksi perilaku pengguna (user panic double-clicking).

---

## 2. Desain Antarmuka Ramah (Warm Orange-White) & Dua Mode Tampilan Terpisah

Antarmuka dirancang dengan estetika ramah dan hangat (*warm friendly orange & white palette* — kanvas krem hangat `#fffaf5`, kartu putih bersih, dan tombol oranye cerah `#ea580c`), serta dibagi ke dalam **2 Tampilan Utama Terpisah** agar operasional kasir dan dapur tetap rapi dan tidak bercampur dengan perkakas insinyur:

### 2.1 Tampilan 1: Operasional Restoran (Client View)
Tampilan khusus staf kasir dan tim dapur:
- **POS & QR Ordering (Kiri):** Pemilih bahasa, 6 item menu makanan & minuman, keranjang belanja, kalkulasi pajak PB1 10%, tombol *"Checkout & Cetak Struk (QRIS)"* ber-animasi optimistik (<50ms), generator Idempotency Key, dan pencegah double-tap.
- **Kitchen Display System / KDS (Kanan):** Tiket pesanan masuk secara live (FIFO), checklist bahan masakan, timer memasak, tombol transisi status (*Mulai Masak* -> *Sajikan*), serta bilah status printer Bluetooth dan gateway QRIS.

### 2.2 Tampilan 2: Konfigurasi Sandbox & Log Diagnostik (Field Engineer View)
Tampilan khusus pengujian keandalan sistem lapangan:
- **4 Sakelar Gangguan Lapangan:** WiFi Drop (Offline), Bad Network Latency (2500ms), Printer Disconnected, dan Backend 500 DB Lock Contention.
- **Kartu Metrik KPI:** Total pesanan, double-tap yang berhasil dicegah, antrian offline yang tersimpan, dan latensi aktif.
- **Pemeriksa Log Diagnostik Real-Time:** Filter kategori `[NETWORK]`, `[HARDWARE]`, `[UX_BEHAVIOR]`, dan `[BACKEND]`, pencarian log, tombol ekspor JSON, serta diagnosa otomatis akar masalah (*Automated Root-Cause Diagnosis*).

*(Tersedia pula opsi **"3 Kolom Sekaligus" (Split View)** untuk pengujian komparatif berdampingan pada layar lebar).*

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

## 3. Aturan Bisnis & Spesifikasi Kolom 1 (POS & QR Ordering)

### 3.1 Lokalisasi & Bahasa (Multilingual Support)
Sistem mendukung 3 bahasa utama untuk memfasilitasi staf lokal, ekspatriat, dan wisatawan:
- **Bahasa Indonesia (`id`)** — Bahasa baku operasional harian.
- **English (`en`)** — Bahasa internasional.
- **Chinese Simplified / 简体中文 (`zh`)** — Bahasa turis dan jaringan F&B multinasional.

Setiap item menu memiliki data terjemahan untuk `name`, `category`, dan `description`. Label UI (keranjang, checkout, status sinkronisasi, pesan kesalahan) berubah secara dinamis saat tombol pemilih bahasa di bagian atas kolom 1 ditekan.

### 3.2 Katalog Menu Contoh (6 Sample Items)
Katalog menu terdiri dari 6 menu makanan dan minuman khas:
1. **Nasi Goreng Spesial RestoPulse** (Kategori: Makanan Utama / Mains)
2. **Ayam Bakar Madu Pedas** (Kategori: Makanan Utama / Mains)
3. **Mie Goreng Seafood Wok** (Kategori: Makanan Utama / Mains)
4. **Es Teh Manis Melati** (Kategori: Minuman / Beverage)
5. **Kopi Susu Gula Aren** (Kategori: Minuman / Beverage)
6. **Pisang Goreng Keju Karamel** (Kategori: Camilan / Dessert)

### 3.3 Kunci Idempotensi Klien (Client-Side Idempotency Key)
- Setiap kali pengguna memasukkan item ke keranjang dan membuka *intent* pemesanan, sistem secara deterministik atau reaktif menautkan sebuah `UUID v4` unik sebagai `Idempotency Key`.
- Kunci ini dikirimkan pada header `X-Idempotency-Key` atau di dalam *payload* transaksi pemesanan.
- Jika permintaan HTTP gagal karena *timeout*, terputus di tengah jalan, atau di-retry otomatis oleh mesin antrian, `Idempotency Key` yang sama **tetap dipertahankan**.
- Backend memeriksa apakah `Idempotency Key` tersebut telah tersimpan di basis data:
  - Jika **belum pernah ada**: Backend membuat pesanan baru, menyimpan transaksi, dan mengembalikan `201 Created`.
  - Jika **sudah ada**: Backend menolak pembuatan entitas duplikat, langsung mengembalikan pesanan yang sudah ada dengan respons `200 OK` (atau `409 Conflict / 200 Idempotent Replay`) tanpa menambah pesanan baru ke KDS atau merusak stok.

### 3.4 Umpan Balik Antarmuka Optimistik (Optimistic UI Feedback <50ms)
- Saat tombol **"Checkout & Print Receipt (QRIS)"** ditekan, antarmuka pengguna **tidak menunggu** respons HTTP dari server sebelum memberikan respon visual.
- Dalam tempo **< 50 milidetik**, antarmuka langsung:
  1. Menampilkan animasi transisi sukses/proses (*order accepted / staged*).
  2. Mengosongkan keranjang belanja.
  3. Memasukkan pesanan ke daftar pesanan lokal dengan status `PROCESSING` atau `QUEUED_OFFLINE`.
  4. Memicu bunyi atau haptic visual mikro.
- Hal ini secara drastis menghilangkan persepsi kasir bahwa aplikasi "macet/hang", yang umumnya menjadi biang keladi kasir melakukan *spam click*.

### 3.5 Pencegahan & Deteksi Ketukan Ganda Cepat (Rapid Double-Tap Debounce)
- Jika pengguna menekan tombol Checkout lebih dari sekali dalam selang waktu **≤ 1500 milidetik**:
  1. Tombol checkout secara otomatis dinonaktifkan (*debounced/locked*).
  2. Percobaan ketukan berikutnya dibatalkan di sisi peramban sebelum membuat *network request* baru.
  3. Sistem memancarkan log diagnostik berkategori khusus:  
     `[UX_BEHAVIOR] [UX_FRICTION: Rapid Double-Tap Prevented] Kasir melakukan klik ganda (selang: 240ms). Klik duplikat dicegah demi menghindari transaksi kembar.`

### 3.6 Antrian Sinkronisasi Luring (Offline Sync Queue)
- Jika simulator atau status browser berada dalam **"Offline Mode" (WiFi Drop)**:
  1. Pesanan tidak dibatalkan.
  2. Data pesanan disimpan ke penyimpanan persisten lokal browser (`LocalStorage` / `IndexedDB`) lengkap dengan `Idempotency Key`, rincian item, dan stempel waktu lokal.
  3. Status pesanan diberi label **"Queued Offline"** (kuning/amber).
  4. Indikator jumlah antrian *badge* "Unsynced Orders: N" menyala di bagian atas POS.
- Ketika konektivitas kembali pulih (*online event* terdeteksi atau tombol chaos dinonaktifkan):
  1. Worker sinkronisasi otomatis mengirimkan seluruh pesanan yang tertunda melalui endpoint batch sync `POST /api/v1/orders/batch-sync`.
  2. Status pesanan diubah menjadi **"Synced"** setelah dikonfirmasi oleh backend.
  3. Log diagnostik `[NETWORK] Offline queue flushed: N orders successfully synchronized to backend` diterbitkan.

---

## 4. Aturan Bisnis & Spesifikasi Kolom 2 (KDS & Hardware Status)

### 4.1 Kitchen Display System (KDS)
KDS menyajikan pesanan masuk secara langsung (*live*) yang diurutkan dari yang terlama ke yang terbaru (FIFO - First In, First Out).

#### Mesin Status Pesanan KDS
Setiap tiket pesanan melalui siklus hidup berikut:

```
[ PENDING ] ──(Tombol: Mulai Masak)──> [ PREPARING ] ──(Tombol: Sajikan)──> [ SERVED ]
     │                                       │
     └─────────────(Tombol: Batalkan)────────┴─────────────> [ CANCELLED ]
```

| Status | Warna Visual | Definisi Operasional |
|---|---|---|
| `PENDING` | Merah / Amber Berkedip | Pesanan baru diterima dari kasir/QR; belum disentuh oleh koki. |
| `PREPARING` | Biru / Ungu Dinamis | Koki sedang memasak pesanan di dapur. Timer durasi berjalan. |
| `SERVED` | Hijau / Selesai | Seluruh hidangan telah disajikan kepada pramusaji/tamu. Tiket diarsipkan. |
| `CANCELLED`| Abu-abu Coret | Pesanan dibatalkan sebelum diproses. |

- Setiap tiket memuat nomor meja, nomor pesanan (misal: `#RP-1042`), daftar item + kuantitas, catatan khusus (misal: "tanpa cabai"), stempel waktu, dan indikator status cetak struk.

### 4.2 Bilah Status Perangkat Keras (Mock Hardware Status Bar)
Menampilkan kondisi dua perangkat keras kritis restoran:
1. **Bluetooth Thermal Printer (58mm/80mm):**
   - `CONNECTED` (Hijau): Printer siap mencetak struk secara instan.
   - `PAPER_OUT` (Kuning): Kertas termal habis; printer menolak tugas cetak fisik.
   - `DISCONNECTED` (Merah): Sambungan Bluetooth terputus atau printer mati.
2. **QRIS Gateway Status:**
   - `OPERATIONAL` (Hijau): Transaksi pembayaran QRIS nasional normal.
   - `DEGRADED / DOWNTIME` (Kuning/Merah): Gateway perbankan lambat merespon callback.

### 4.3 Kebijakan Kegagalan Printer (Printer Disconnection Graceful Fallback)
- **Aturan Emas:** *Kegagalan printer tidak boleh membatalkan pesanan atau menghalangi koki memasak!*
- Jika printer dalam kondisi `DISCONNECTED` atau `PAPER_OUT` saat transaksi checkout dilakukan:
  1. Transaksi di basis data **tetap berhasil disimpan** (`status = SUCCESS`).
  2. Tiket dapur di KDS **tetap muncul** agar koki langsung mulai menyiapkan makanan.
  3. Pesanan diberi lencana peringatan **"Receipt Queued for Reprint"** (Kuning Berkedip).
  4. Tombol **"Reprint Receipt"** muncul di tiket pesanan kasir dan KDS.
  5. Log diagnostik `[HARDWARE] [PRINTER_OFFLINE] Struk pesanan #RP-XXXX gagal dicetak secara fisik. Tugas cetak dialihkan ke antrian cetak ulang lokal.` dicatat.
  6. Ketika printer disambungkan kembali (`CONNECTED`), kasir dapat menekan tombol "Reprint All Queued" untuk mencetak seluruh struk yang tertunda.

---

## 5. Aturan Bisnis & Spesifikasi Kolom 3 (Field Chaos Simulator & Diagnostic Logs)

### 5.1 Empat Sakelar Simulasi Gangguan (Chaos Toggles)
Insinyur lapangan (Field Reliability Engineer) dapat mengaktifkan kondisi ekstrem restoran secara independen maupun bersamaan:

1. **Simulate Restaurant WiFi Drop (Offline Mode):**
   - Memutus peramban dari komunikasi jaringan backend secara lokal.
   - Seluruh pemanggilan API akan segera gagal (*NetworkError / offline interception*).
   - Memaksa POS masuk ke mode penyimpanan luring (Offline Queue).
2. **Simulate Peak-Hour Bad Network (2500ms API Latency):**
   - Menginjeksikan penundaan buatan sebesar 2500 milidetik pada setiap permintaan dan respon API.
   - Membantu menguji ketahanan Optimistic UI dan menguji apakah kasir tergoda menekan tombol berulang kali saat layar menunggu.
3. **Simulate Bluetooth Printer Disconnected:**
   - Mematikan status printer virtual ke `DISCONNECTED`.
   - Menguji apakah sistem sanggup melanjutkan pencatatan pesanan tanpa panik macet (*hardware fault isolation*).
4. **Simulate Backend 500 Database Lock:**
   - Memerintahkan backend (atau proxy interseptor) untuk sengaja melempar status HTTP `500 Internal Server Error` bertema `pq: deadlock detected / sqlite3: database is locked`.
   - Menguji apakah klien sanggup menangani kesalahan server dengan pesan manusiawi tanpa kehilangan isi keranjang belanja pengguna.

### 5.2 Pemeriksa Log Diagnostik Terstruktur Real-Time (Structured Root-Cause Log Inspector)
Setiap kejadian di seluruh sistem dicatat dan diklasifikasikan ke dalam 4 kategori akar masalah:

| Kategori | Tag | Contoh Kejadian | Diagnosis Otomatis |
|---|---|---|---|
| **[NETWORK]** | `net` | WiFi terputus, timeout 2500ms, socket drop, batch sync | *Konektivitas ISP restoran terganggu. Antrian offline diaktifkan otomatis.* |
| **[HARDWARE]** | `hw` | Bluetooth printer disconnected, paper out, printer restored | *Kabel/baterai printer terlepas. Pesanan dialihkan ke antrian cetak ulang.* |
| **[UX_BEHAVIOR]** | `ux` | Rapid double-tap, tombol spamming, cart abandoned | *Pengguna gelisah menekan tombol 2x dalam 300ms. Idempotensi mencegah double order.* |
| **[BACKEND]** | `srv` | HTTP 500 DB Lock, Idempotency hit, SQLite mutex contention | *Database contention di server kasir utama. Klien disarankan melakukan retry dengan backoff.* |

Setiap baris log menampilkan:
- **Timestamp** (format `HH:mm:ss.SSS`)
- **Category Badge** dengan kode warna khas
- **Payload Latency** (misal: `42ms`, `2518ms`)
- **Message & Automated Diagnosis** (penjelasan teknis yang mudah dipahami pemilik restoran)
- Opsi filter per kategori dan tombol **"Clear Logs"** serta **"Export JSON"**.

---

## 6. Target Metrik & SLA Kualitas Sistem

| Metrik | Ambang Batas Target | Catatan |
|---|---|---|
| **Optimistic Feedback Latency** | ≤ 50 ms | Feedback visual tombol dan keranjang seketika. |
| **Idempotency Collision Rate** | 0% Transaksi Duplikat | Pengujian klik beruntun 10x hanya menghasilkan tepat 1 pesanan. |
| **Offline Data Retention** | 100% Pesanan Terselamatkan | Refresh browser saat offline tidak menghilangkan pesanan yang belum tersinkronisasi. |
| **Recovery Sync Time** | < 1000 ms setelah online | Sinkronisasi batch instan saat koneksi pulih. |

---

## 7. Onboarding & Panduan Interaktif (Baby Steps Guide)

Untuk memudahkan pengguna baru, evaluator teknis, maupun pemilik restoran memahami konteks dan tujuan platform ini tanpa membaca kode sumber, RestoPulse menyertakan **Modal Onboarding Interaktif** yang muncul secara otomatis pada kunjungan pertama:

### 7.1 Tab "Tentang RestoPulse & Konteks Sistem"
- Memaparkan realitas operasional restoran yang keras (WiFi drop, printer habis kertas, kasir panik double-tap, DB lock jam sibuk).
- Menjelaskan 3 pilar solusi teknis RestoPulse: **Idempotency & Optimistic UI**, **Offline Sync Queue**, dan **Hardware Fault Isolation**.

### 7.2 Tab "Baby Steps (Panduan 5 Langkah Praktis)"
Menyediakan alur eksplorasi langkah demi langkah dengan tombol **"Coba Skenario Ini"** yang langsung mengarahkan tampilan antarmuka:
1. **Langkah 1 (Simulasi Pesanan Normal):** Checkout di POS dengan Optimistic UI <50ms dan amati tiket mengalir ke KDS.
2. **Langkah 2 (Uji Ketahanan Double-Tap):** Spam tombol checkout berkali-kali untuk melihat proteksi debounce dan deduplikasi idempotency.
3. **Langkah 3 (Simulasi WiFi Drop & Antrian Offline):** Aktifkan offline mode di Sandbox, buat pesanan lokal, dan lihat rekonsiliasi batch otomatis saat koneksi pulih.
4. **Langkah 4 (Simulasi Printer Bluetooth Mati):** Putus koneksi printer dan buktikan transaksi tetap sukses dengan badge *"Struk Antri Cetak Ulang"*.
5. **Langkah 5 (Inspeksi Root-Cause Log):** Bedah audit log diagnostik secara real-time dengan klasifikasi akar masalah otomatis.

Pengguna dapat membuka kembali panduan ini kapan saja melalui tombol **"📖 Panduan & Konteks"** di Navbar atas. Opsi *"Jangan tampilkan lagi saat membuka web"* disimpan di `localStorage` peramban.
