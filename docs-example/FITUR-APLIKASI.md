# Tahura Djuanda Geo-Intelligence Dashboard
## Daftar Fitur Aplikasi & Urutan Pengembangan

**Pemilik:** UPTD Taman Hutan Raya Ir. H. Djuanda Bandung, Dinas Kehutanan Provinsi Jawa Barat
**Jenis Aplikasi:** Aplikasi Web Sistem Informasi Geografis dengan kemampuan pengawasan kawasan

**Dokumen rujukan:** [ABOUT-APPS.md](ABOUT-APPS.md) — spesifikasi dan aturan bisnis · [ARCHITECTURE.md](ARCHITECTURE.md) — desain teknis

---

## Cara Membaca Dokumen Ini

Dokumen ini terdiri dari dua bagian:

1. **Daftar fitur** — 59 fitur yang dikelompokkan berdasarkan area fungsional
2. **Urutan pengembangan** — tiga tahap yang mengikuti **lapisan sistem**, bukan pengelompokan fitur

Pengembangan dilaksanakan **per lapis, bukan per fase fitur**: seluruh API diselesaikan lebih dulu, kemudian Backend (BFF), kemudian Frontend.

### Kolom Lapis

Setiap fitur ditandai lapisan yang mengerjakannya:

| Tanda | Arti |
|---|---|
| **A** | API — logika domain dan data |
| **B** | Backend (BFF) — perantara antara browser dan API |
| **F** | Frontend — antarmuka pengguna |

Fitur bertanda **A** saja selesai sepenuhnya pada Tahap 1 dan tidak memerlukan pekerjaan lanjutan.

---

# Bagian I — Daftar Fitur

## Fitur Umum Lintas Halaman

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F01 | A · B · F | Autentikasi & Manajemen Sesi | Login, logout, dan pengelolaan sesi pengguna yang aman |
| F02 | A · B · F | Kontrol Akses Berbasis Peran | Lima peran: System Administrator, Staff, Petugas Keamanan, Viewer, dan Publik — dilengkapi mekanisme pemberian akses peta kepada pengguna atau kelompok tertentu. Data merupakan aset institusi: kepemilikan tidak membatasi wewenang, dan akuntabilitas ditegakkan melalui audit log |
| F03 | F | Pilihan Bahasa Antarmuka | Bahasa Indonesia (baku), Inggris, dan Sunda. Istilah teknis dipertahankan dalam bentuk aslinya bila penerjemahan menimbulkan kerancuan |
| F04 | F | Mode Tampilan Terang / Gelap | Pilihan tema antarmuka sesuai preferensi pengguna |
| F05 | A · B · F | Keamanan Sesi Lanjutan | Perpanjangan sesi otomatis selama pengguna aktif; logout dari satu perangkat mengakhiri seluruh sesi aktif |

## Manajemen Dataset

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F06 | A · B · F | Unggah Dataset Raster | Pengunggahan GeoTIFF (`.tif`) hingga 20 GB dengan nama dan deskripsi. Subtipe: Ortofoto, DEM, dan Lainnya. Raster DEM dilengkapi **color ramp beserta hillshade** dari satu layer yang sama, dengan elevasi minimum dan maksimum dihitung otomatis sebagai dasar pewarnaannya |
| F07 | **A** | Konversi Raster ke Format Teroptimasi | Konversi otomatis di latar belakang ke Cloud-Optimized GeoTIFF, agar raster berukuran besar dapat ditampilkan dengan cepat |
| F08 | A · B · F | Unggah Dataset Vektor | Pengunggahan Shapefile dalam kemasan ZIP hingga 512 MB. Satu berkas menghasilkan satu layer |
| F09 | **A** | Konversi Vektor ke Basis Data Spasial | Konversi otomatis ke basis data spasial dengan perbaikan geometri, sehingga data dapat dikueri dan disunting |
| F10 | **A** | Konversi Sistem Proyeksi Otomatis | Seluruh data yang masuk dikonversi otomatis ke sistem koordinat WGS84 |
| F11 | **A** | Publikasi Data ke Layanan Peta Standar | Data yang berhasil diproses langsung dipublikasikan sebagai layanan peta standar (OGC), sehingga dapat digunakan di dalam aplikasi maupun oleh perangkat lunak GIS lain seperti QGIS dan ArcGIS |
| F12 | A · B · F | Unggah Berpotongan & Dapat Dilanjutkan | Berkas besar dikirim secara berpotongan; unggahan yang terputus dapat dilanjutkan tanpa mengulang dari awal |
| F13 | A · B · F | Pemantauan Status Pemrosesan | Status setiap dataset ditampilkan secara langsung: diunggah, sedang diproses, selesai, atau gagal. Kegagalan disertai pesan teknis yang dapat diteruskan kepada administrator |
| F14 | A · B · F | Verifikasi Hasil Ingest | Halaman detail dataset menampilkan sistem koordinat asal yang terdeteksi, cakupan wilayah hasil, jumlah fitur, dan contoh nilai atribut — agar pengunggah dapat mengenali bila data mendarat di lokasi yang keliru atau teksnya rusak |
| F15 | **A** | Pencegahan Duplikasi Unggahan | Berkas identik dengan yang sudah pernah berhasil diunggah akan ditolak, dengan jalur khusus untuk mengunggah revisi sebagai versi baru |
| F21 | A · B · F | Daftar Dataset dengan Pencarian & Filter | Tampilan daftar dengan pagination, pencarian nama, filter tipe dan status, serta nama pembuat setiap dataset |
| F22 | A · B · F | Proteksi Penghapusan Dataset | Penghapusan diblokir bila dataset masih digunakan oleh peta; sistem menampilkan daftar peta yang terdampak. Penghapusan yang diizinkan bersifat langsung tanpa masa tenggang, dan dicatat di audit log |

> Fitur pembuatan dataset vektor baru (F16–F20) berada di menu **Manajemen Peta**, karena menggambar membutuhkan kanvas peta. Dataset yang dihasilkan tetap masuk ke katalog ini dan dapat diimpor ke peta mana pun.

## Manajemen Peta

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F23 | A · B · F | Manajemen Peta | Pembuatan, penyuntingan, dan penghapusan peta dengan nama, deskripsi, dan URL slug |
| F24 | A · B · F | Publikasi Peta | Peta yang dipublikasikan dapat diakses publik tanpa login melalui URL khusus, dan dapat disematkan di situs lain melalui iframe |
| F25 | A · B · F | Pemberian Akses Peta | Peta yang tidak dipublikasikan dapat diberikan aksesnya kepada pengguna atau kelompok tertentu |
| F26 | A · B · F | Penambahan Layer ke Peta | Layer raster dan vektor dari Manajemen Dataset ditambahkan ke dalam peta, dilengkapi kontrol zoom dan navigasi ke cakupan data |
| F16 | A · B · F | Pembuatan Dataset Vektor Baru | Alur serupa perangkat lunak GIS desktop: buat layer, tetapkan tipe geometri (titik/garis/poligon), lalu gambar fitur di atas peta. Dataset yang dihasilkan masuk ke katalog dan dapat dipakai peta lain |
| F17 | A · B · F | Pembuatan Struktur Atribut | Pengguna mendefinisikan sendiri field atribut dengan tipe teks, angka bulat, angka desimal, atau tanggal — tanpa batas panjang karakter maupun lebar kolom |
| F18 | A · B · F | Vektor Multimedia | Data vektor yang memuat gambar, video, gambar 360°, dan video 360°; batas ukuran berkas media 6 GB |
| F19 | A · B · F | Registry Kamera CCTV | Penambahan kamera dengan geotagging wajib pada formulir yang sama. Seluruh titik berada dalam satu layer sistem tunggal. Kredensial disimpan terenkripsi pada penyimpanan terpisah yang tidak pernah dipublikasikan, dan **hanya dapat ditulis oleh System Administrator**; Staff tetap dapat menambah dan memindahkan kamera |
| F20 | A · B · F | Penyuntingan Data Vektor | Seluruh data vektor — hasil unggahan maupun hasil penggambaran — dapat disunting geometri, nilai atribut, dan struktur fieldnya. Penyuntingan berlangsung dalam sesi: banyak perubahan, sekali simpan. Satu layer hanya dapat disunting satu orang pada satu waktu, dan pengguna kedua diberi tahu siapa yang sedang menyuntingnya |
| F27 | F | Pilihan Basemap | Peta dasar terrain, satelit, dan topografi |
| F28 | A · B · F | Pengaturan Layer Peta | Pengaturan urutan, visibilitas, dan transparansi setiap layer |
| F29 | B · F | Legenda Layer | Tampilan legenda simbol dan warna setiap layer di panel samping |
| F30 | A · B · F | Panel Detail Fitur | Menampilkan atribut, field dinamis, dan konten multimedia saat fitur peta diklik |
| F31 | F | Alat Pengukuran | Pengukuran jarak dan luas area langsung di atas peta |
| F32 | A · B · F | Pencarian Lokasi / Zona | Pencarian zona bernama yang berlaku di seluruh peta; memilih zona langsung menggerakkan peta ke lokasi tersebut |
| F33 | F | Cetak & Ekspor Peta | Ekspor tampilan peta ke format PNG atau PDF |
| F45 | F | Viewer 360° | Tampilan gambar dan video 360° dengan kontrol pan, rotate, dan zoom di dalam panel peta |

## Pointcloud Viewer

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F38 | A · B · F | Unggah Dataset Pointcloud | Pengunggahan berkas LAZ hingga 5 GB |
| F39 | **A** | Konversi ke Format Pointcloud Tiles | Konversi otomatis di latar belakang, dengan status pemrosesan yang ditampilkan langsung |
| F40 | B · F | Viewer Pointcloud | Visualisasi dengan kontrol standar: pewarnaan berdasarkan elevasi, intensitas, atau RGB; pengaturan ukuran titik; alat ukur jarak dan tinggi; cross-section; serta mode kamera orbit dan first-person |

## CCTV

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F41 | **A** | Transcoding Stream CCTV | Konversi stream kamera ke format yang dapat ditayangkan di browser |
| F42 | B · F | Tampilan Live Stream CCTV | Penayangan video langsung dari seluruh kamera terdaftar dalam tampilan grid |
| F43 | A · B · F | Peta Lokasi & Status CCTV | Peta interaktif yang menampilkan posisi dan status online/offline setiap kamera |
| F44 | A · B · F | Live Stream CCTV di Panel Peta | Stream kamera dapat dilihat langsung dari panel detail fitur di peta, terbatas untuk System Administrator, Staff, dan Petugas Keamanan |

## Pemantauan Kepadatan & Peringatan

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F47 | **A** | Pengambilan Tangkapan Kamera Otomatis | Server mengambil tangkapan gambar dari setiap kamera setiap 30 detik secara mandiri, tanpa memerlukan aplikasi tambahan di sisi kamera |
| F48 | **A** | Integrasi Layanan Analisis Kepadatan | Tangkapan gambar dikirim ke layanan analisis yang alamatnya dapat dikonfigurasi, dan hasil hitungan jumlah orang diterima kembali. Layanan analisis berada di luar sistem ini, sehingga model yang digunakan dapat diganti tanpa mengubah aplikasi |
| F49 | **A** | Pencatatan & Pemeliharaan Data Kepadatan | Hasil hitungan disimpan permanen sebagai bahan analisis jangka panjang. Tangkapan gambar yang tidak terkait peringatan dibersihkan otomatis setelah masa simpan tertentu |
| F50 | A · B · F | Peta Kepadatan Waktu Nyata | Peta heatmap yang menampilkan tingkat kepadatan pengunjung per lokasi kamera dan diperbarui secara langsung |
| F51 | **A** | Pembuatan Peringatan Otomatis | Peringatan dibuat otomatis saat jumlah orang di suatu lokasi melampaui ambang batas yang dikonfigurasi. Satu kejadian menghasilkan satu peringatan: selama peringatan sebuah kamera belum ditangani, deteksi berikutnya memperbaruinya tanpa membuat peringatan baru dan tanpa notifikasi ulang |
| F52 | A · B · F | Notifikasi Dalam Aplikasi | Popup peringatan yang muncul langsung kepada pengguna yang sedang aktif, satu popup per lokasi kamera |
| F53 | **A** | Notifikasi WhatsApp | Pengiriman pesan peringatan ke nomor WhatsApp petugas melalui layanan pengiriman yang alamatnya dapat dikonfigurasi |
| F54 | A · B · F | Manajemen Nomor Penerima Notifikasi | System Administrator mengelola daftar nomor WhatsApp yang menerima peringatan |
| F55 | A · B · F | Halaman Detail Peringatan | Menampilkan nama lokasi, tangkapan gambar, jumlah orang terdeteksi, waktu kejadian, dan live stream kamera lokasi tersebut |
| F56 | A · B · F | Log & Penanganan Peringatan | Tabel riwayat seluruh peringatan dengan status penanganan, filter berdasarkan kamera dan tanggal, serta tombol untuk menandai peringatan telah ditangani beserta pencatatan penangannya |

## Dashboard

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F34 | A · B · F | Ringkasan Status Dataset | Jumlah dataset menurut status pemrosesan, dipisah berdasarkan tipe data |
| F46 | A · B · F | Kartu KPI Status CCTV | Jumlah kamera yang aktif dibanding yang tidak aktif |
| F57 | A · B · F | Kartu KPI Kepadatan & Peringatan | Kepadatan saat ini — dijumlahkan antar kamera dari satu hasil deteksi termuda tiap kamera, tidak pernah antar waktu — puncak angka gabungan itu sepanjang hari, dan jumlah peringatan yang belum ditangani |
| F58 | A · B · F | Mini-Heatmap Kepadatan | Tampilan ringkas peta kepadatan, dihasilkan dari titik kamera beserta hitungan terbarunya |
| F59 | A · B · F | Feed Peringatan Terbaru | Daftar 10 peringatan terakhir beserta statusnya |

## Administrasi

| Kode | Lapis | Fitur | Keterangan |
|---|---|---|---|
| F35 | A · B · F | Manajemen Zona / Lokasi Pencarian | Staff menambah, menyunting, dan menghapus zona bernama yang berlaku di seluruh peta |
| F36 | A · B · F | Manajemen API Key | System Administrator membuat, memberi label, menonaktifkan, dan memantau API key untuk konsumen eksternal, serta menghibahkan akses baca ke peta tertentu yang tidak dipublikasikan. Peta yang sudah dipublikasikan tidak memerlukan kunci karena dapat diakses tanpa login |
| F37 | A · B · F | Audit Log Aktivitas | Pencatatan seluruh aktivitas pengubahan data yang dapat ditinjau oleh System Administrator |

---

# Bagian II — Urutan Pengembangan

Pengembangan mengikuti **lapisan sistem**, bukan pengelompokan fitur. Setiap tahap diselesaikan sepenuhnya sebelum tahap berikutnya dimulai.

```
Tahap 1: API   →   Tahap 2: Backend (BFF)   →   Tahap 3: Frontend
```

> **Konsekuensi yang perlu disadari.** Dengan urutan ini, **tidak ada hasil yang dapat digunakan pengguna akhir sampai Tahap 3 selesai**. Berbeda dengan pengembangan bertahap per fitur, yang setiap fasenya menghasilkan sistem yang langsung dapat dioperasikan.
>
> Agar kemajuan tetap dapat diverifikasi sepanjang Tahap 1 dan 2, setiap tahap memiliki hasil yang dapat diuji secara mandiri — lihat "Hasil yang Dapat Diverifikasi" pada setiap tahap.

---

## Tahap 1 — API

Layanan inti di sisi server. Seluruh logika domain, seluruh aturan bisnis, dan seluruh akses data berada di sini.

### 1.1 Fondasi

Struktur proyek, konfigurasi berbasis variabel lingkungan, migrasi SQL bernomor beserta runner-nya, skema basis data lengkap untuk kedua schema, verifikasi token dan ekstraksi peran beserta klaim keanggotaan grup, penanganan masa berlaku token dan back-channel logout, pencatatan audit, antrian pekerjaan berbasis PostgreSQL dengan mekanisme lease, serta kerangka pekerjaan berkala.

*Fitur:* F01, F02, F05, F37

### 1.2 Penyimpanan & Unggahan

Integrasi MinIO beserta ketiga service account dan seluruh bucket, penerbitan presigned URL, endpoint unggahan berpotongan ke direktori spool beserta sesi unggah yang dapat dilanjutkan, pemeriksaan keamanan arsip, dan pencegahan duplikasi berbasis SHA-256 beserta jalur "unggah sebagai versi baru".

*Fitur:* F12, F15

### 1.3 Pipeline Ingest Raster

Inspeksi berkas, reproyeksi ke EPSG:4326, konversi ke COG beserta overview, perhitungan elevasi minimum dan maksimum untuk DEM, unggahan ke MinIO, penghapusan berkas asli, dan pencatatan metadata.

*Fitur:* F06, F07, F10, F13, F14

### 1.4 Pipeline Ingest Vektor

Pemeriksaan isi arsip, pembuatan nama layer, pembuatan tabel spasial, pemuatan melalui `ogr2ogr`, perbaikan geometri, pembacaan metadata, dan pengarsipan berkas sumber.

*Fitur:* F08, F09, F10, F13, F14

### 1.5 Pipeline Ingest Pointcloud

Pembacaan metadata, konversi ke pointcloud tiles, dan unggahan hasilnya ke MinIO.

*Fitur:* F38, F39

### 1.6 Publikasi GeoServer

Bootstrap idempoten sebagai tugas startup API — workspace, datastore PostGIS, tiga named style baku, dan publikasi layer lokasi CCTV — dijaga advisory lock agar replika tidak saling berlomba. Publikasi otomatis pasca-ingest untuk raster dan vektor, pencatatan status publikasi, serta pekerjaan publikasi ulang yang dapat diulang.

> **Sudah dibuktikan, tidak lagi menjadi risiko.** Pembacaan COG dari MinIO melalui S3 telah diuji ujung ke ujung dengan data survei Tahura yang sebenarnya, beserta styling DEM color ramp dan hillshade dari satu layer. Konfigurasi yang berhasil — termasuk empat ketentuan yang mudah meleset — tercatat di `ARCHITECTURE.md` §6.4 dan §6.6, dan image GeoServer-nya di `app-requirement/geoserver/Dockerfile`.

*Fitur:* F11

### 1.7 Katalog & Kontrol Akses

CRUD dataset dengan pagination dan filter, model hak akses dua lapis, resolusi hak akses layer, proteksi penghapusan, dan penghapusan dua tahap yang melintasi empat sistem.

*Fitur:* F21, F22, F25

### 1.8 Data Vektor Interaktif

Pembuatan layer dari definisi atribut dinamis, CRUD fitur, penyuntingan struktur field, kunci sesi sunting per layer, pemuatan ulang definisi layer dan pembersihan cache pada setiap penyimpanan, serta penanganan vektor multimedia beserta katalog media yang mencatat berkas mana milik fitur mana.

*Fitur:* F16, F17, F18, F20

### 1.9 Peta

CRUD peta beserta slug dan publikasi, pengelolaan layer di dalam peta, pengelolaan zona, dan endpoint atribut fitur yang menyaring kolom sensitif serta menyisipkan presigned URL multimedia.

*Fitur:* F23, F24, F26, F28, F30, F32, F35

### 1.10 CCTV

Registry kamera beserta layer lokasi sistem, integrasi MediaMTX, pembuatan path stream dengan dekripsi kredensial, dan deteksi status online/offline kamera.

*Fitur:* F19, F41, F43, F44

### 1.11 Kepadatan & Peringatan

Worker pengambil tangkapan gambar, klien endpoint inferensi beserta mekanisme pengulangan dan keadaan terminalnya, pencatatan data kepadatan, evaluasi ambang batas dan pembuatan peringatan dengan aturan satu kejadian satu peringatan, klien endpoint notifikasi, pengelolaan daftar penerima, penanganan peringatan, serta pekerjaan pembersih tangkapan gambar.

*Fitur:* F47, F48, F49, F51, F53, F54, F55, F56

### 1.12 Agregasi & Peristiwa Real-Time

Endpoint agregasi untuk seluruh kartu Dashboard, dan penerbitan peristiwa real-time melalui Redis.

*Fitur:* F34, F46, F50, F52, F57, F58, F59

### 1.13 API Key

Pembuatan, pelabelan, penonaktifan, dan pemantauan penggunaan API key, beserta hibah akses baca per-peta untuk konsumen eksternal.

*Fitur:* F36

### Hasil yang Dapat Diverifikasi

- Dokumentasi OpenAPI yang lengkap untuk seluruh endpoint
- Seluruh pipeline ingest dapat dijalankan dan diverifikasi menggunakan berkas nyata
- Layer hasil ingest dapat dibuka langsung di **QGIS** melalui layanan OGC — bukti nyata bahwa jalur data berfungsi tanpa memerlukan frontend
- Aturan hak akses dapat diuji melalui pemanggilan langsung

---

## Tahap 2 — Backend (BFF)

Lapis perantara. Tidak memuat logika domain; seluruh aturan bisnis tetap berada di API.

### 2.1 Fondasi

Validasi token Keycloak dari browser, perpanjangan sesi dan back-channel logout, autentikasi API key untuk konsumen eksternal, pengelolaan kredensial layanan menuju API, klien API, dan penanganan galat yang tidak membocorkan detail internal.

*Fitur:* F05, F36

### 2.2 Proxy Layanan Peta

Proxy GeoServer beserta pemeriksaan hak akses layer dan cache hasil pemeriksaan, serta penerusan `GetLegendGraphic`.

*Fitur:* F29

### 2.3 Otorisasi Live Stream

Penerbitan token stream berjangka pendek per kamera dan auth hook untuk MediaMTX.

*Fitur:* F42, F44

### 2.4 Peristiwa Real-Time

Endpoint SSE tunggal yang memultipleks seluruh jenis peristiwa, dengan penyaringan berdasarkan hak akses penerima.

*Fitur:* F52

### 2.5 Unggahan & Berkas

Penerusan unggahan berpotongan menuju API, dan relay presigned URL untuk konten multimedia dan pointcloud tiles.

*Fitur:* F12, F18, F40

### 2.6 Penyusunan Respons

Penggabungan dan penyesuaian bentuk respons sesuai kebutuhan setiap halaman, agar frontend tidak perlu melakukan banyak pemanggilan.

### Hasil yang Dapat Diverifikasi

- Seluruh endpoint dapat dipanggil dari luar jaringan internal, sementara API dan GeoServer terbukti **tidak dapat dijangkau langsung**
- Peta dapat dirender melalui proxy dengan aturan hak akses yang berfungsi, termasuk akses anonim untuk peta yang dipublikasikan
- Aliran peristiwa real-time dapat diamati

---

## Tahap 3 — Frontend

Antarmuka pengguna.

### 3.1 Fondasi
Struktur proyek, routing, manajemen state, i18n untuk tiga bahasa, tema terang/gelap, desain responsif, dan alur login beserta perpanjangan sesi otomatis.

*Fitur:* F03, F04, F05

### 3.2 Manajemen Dataset
Unggahan berpotongan dengan indikator kemajuan, daftar dataset, pemantauan status, halaman detail beserta verifikasi hasil ingest.

*Fitur:* F06, F08, F12, F13, F14, F21, F22, F38

### 3.3 Peta
Kanvas peta, basemap, pengaturan layer, legenda, panel detail fitur, alat pengukuran, pencarian zona, cetak dan ekspor, alat menggambar, pembuat atribut dinamis, serta viewer multimedia dan 360°.

*Fitur:* F16, F17, F18, F19, F20, F23, F24, F25, F26, F27, F28, F29, F30, F31, F32, F33, F35, F45

### 3.4 Pointcloud Viewer
*Fitur:* F40

### 3.5 CCTV Dashboard
*Fitur:* F42, F43, F44

### 3.6 Crowd Map
Heatmap waktu nyata, popup peringatan, halaman detail peringatan, dan tabel log penanganan.

*Fitur:* F50, F52, F55, F56

### 3.7 Dashboard
*Fitur:* F34, F46, F57, F58, F59

### 3.8 Administrasi
*Fitur:* F36, F37, F54

### Hasil yang Dapat Diverifikasi

Sistem lengkap yang dapat dioperasikan pengguna akhir.

---

## Ringkasan

| Tahap | Lapis | Cakupan | Hasil |
|---|---|---|---|
| **1** | API | 13 sub-tahap; seluruh logika domain dan pipeline data | Layanan inti lengkap, terdokumentasi OpenAPI, layer dapat dibuka di QGIS |
| **2** | Backend (BFF) | 6 sub-tahap; perisai dan perantara | Seluruh layanan internal terlindung; hanya BFF yang terekspos |
| **3** | Frontend | 8 sub-tahap; antarmuka pengguna | Sistem lengkap yang dapat dioperasikan |

**Total: 59 fitur.** Sebanyak **12 fitur selesai sepenuhnya pada Tahap 1** karena tidak memerlukan antarmuka — seluruh pipeline konversi, publikasi, integrasi layanan analisis, dan notifikasi WhatsApp: F07, F09, F10, F11, F15, F39, F41, F47, F48, F49, F51, dan F53.

---

## Catatan Perubahan dari Versi Sebelumnya

### Kamera menjadi registry, bukan dataset vektor gambaran

Titik CCTV sebelumnya terdaftar sebagai salah satu tipe dataset vektor yang dibuat dengan menggambar di peta. Kini kamera adalah **entitas tersendiri**: pengguna menambahkan kamera dan menandai lokasinya pada formulir yang sama, dan seluruh titik berada dalam satu layer sistem tunggal.

Alasannya menyangkut umur data. Riwayat kepadatan disimpan permanen dan tumbuh sekitar 10,5 juta baris per tahun, sementara titik peta dapat disunting dan dihapus, dan tabel layernya ikut hilang bila datasetnya dihapus. Identitas kamera harus hidup lebih lama daripada keduanya. Konsekuensi lainnya: kamera yang titiknya sudah ditandai Staff tetapi kredensialnya belum diisi System Administrator kini tetap berwujud di peta dan di kartu KPI.

### Kegunaan API key dipersempit

Peta yang dipublikasikan sudah dapat dibuka tanpa login, termasuk dari QGIS dan ArcGIS. API key karenanya **tidak lagi diposisikan sebagai jalur akses data publik**, melainkan semata sebagai hibah akses baca ke peta yang tidak dipublikasikan.

### Metrik dan peringatan dipertegas rumusannya

Definisi "Kepadatan Saat Ini" sebelumnya terbuka pada dua tafsir yang menghasilkan angka berbeda. Kini ditetapkan: **satu hasil deteksi termuda per kamera, dijumlahkan antar kamera** — tidak pernah antar waktu. "Puncak Hari Ini" adalah nilai tertinggi angka gabungan itu sepanjang hari.

Pembuatan peringatan juga dibatasi menjadi **satu kejadian satu peringatan**. Sebelumnya tiap deteksi di atas ambang menghasilkan peringatan sendiri, sehingga kerumunan sepuluh menit menjadi dua puluh baris dan dua puluh pesan WhatsApp.

### Lokasi kamera tidak ikut terbuka bersama peta publik

Konsekuensi dari satu layer sistem: satu peta yang dipublikasikan akan cukup menyingkap posisi seluruh kamera. Layer lokasi CCTV karenanya **selalu menuntut peran**, mengikuti preseden yang sudah berlaku pada live stream.

### Empat kelengkapan yang sebelumnya tidak tercatat

| Kelengkapan | Alasan |
|---|---|
| Katalog media | Berkas multimedia sebelumnya hanya dikenali dari pola penamaan objek; berkas yatim tidak dapat dikenali dan penghapusan dataset tidak dapat dipastikan bersih |
| Sesi unggah | Unggahan yang dapat dilanjutkan menuntut catatan potongan mana yang sudah diterima |
| Pekerjaan berkala | Pembersihan snapshot, pemeriksaan status kamera, pengembalian pekerjaan yatim, dan pengulangan publikasi tidak memiliki tempat menjalankannya |
| Hitungan kepadatan yang belum terisi | Tangkapan gambar disimpan sebelum inferensi, sehingga hasil hitungan harus boleh kosong sementara |

### Urutan pengembangan berubah dari per-fase menjadi per-lapis

Versi sebelumnya membagi pekerjaan menjadi tiga fase fitur, yang masing-masing menghasilkan sistem siap pakai. Versi ini membaginya mengikuti lapisan sistem: API, lalu Backend, lalu Frontend.

Konsekuensinya sudah dicatat di atas: hasil yang dapat digunakan pengguna baru muncul di akhir. Sebagai gantinya, setiap tahap memiliki bukti kemajuan yang dapat diverifikasi secara mandiri.

### Metrik pengunjung diperbaiki

Metrik **"Total Kunjungan Hari Ini" dibatalkan** dan digantikan metrik **kepadatan**: kepadatan saat ini dan puncak kepadatan hari ini.

Alasannya bersifat metodologis. Analisis tangkapan kamera menghitung jumlah orang yang **terlihat pada satu waktu**, bukan jumlah orang yang datang. Menjumlahkan hasil hitungan antar waktu akan menghitung orang yang sama berulang kali — seorang pengunjung yang berada di depan kamera selama satu jam akan terhitung 120 kali. Angka yang dihasilkan akan jauh melampaui kenyataan.

Metrik kepadatan mengukur apa yang memang dapat diukur oleh kamera, dan justru lebih relevan untuk pengawasan kawasan.

### Layanan analisis dan notifikasi dipisahkan dari aplikasi

Model analisis kepadatan dan layanan pengiriman WhatsApp **tidak lagi menjadi bagian dari aplikasi ini**. Keduanya diakses melalui alamat layanan yang dapat dikonfigurasi.

Manfaatnya: model analisis dapat diganti atau ditingkatkan tanpa mengubah aplikasi, dan persoalan lisensi perangkat lunak maupun risiko operasional layanan pesan berada di luar tanggung jawab sistem ini.

Sebagai konsekuensi, fitur manajemen sesi WhatsApp melalui pemindaian QR code dihapus. Yang dikelola di dalam aplikasi kini adalah **daftar nomor penerima** peringatan.

### Aplikasi klien deteksi dihapus

Kamera CCTV dapat dijangkau langsung oleh server, sehingga **aplikasi klien terpisah yang sebelumnya direncanakan tidak diperlukan**. Server mengambil tangkapan gambar secara mandiri. Manajemen API Key tetap dipertahankan untuk kebutuhan konsumen eksternal lainnya.

### Format berkas dipersempit

Satu format untuk setiap tipe data: **GeoTIFF** untuk raster, **Shapefile dalam kemasan ZIP** untuk vektor, dan **LAZ** untuk pointcloud. Dukungan KML, GeoJSON, dan LAS ditiadakan.

Penyempitan ini disengaja. Setiap format tambahan membawa perilaku dan kegagalannya sendiri pada tahap konversi; membatasinya pada satu format per tipe menghasilkan proses yang jauh lebih dapat diandalkan.

### Data dipublikasikan sebagai layanan peta standar

Seluruh data yang berhasil diproses kini otomatis tersedia sebagai **layanan peta standar (OGC)**. Artinya data Tahura dapat langsung dibuka di QGIS, ArcGIS, atau aplikasi pihak lain — tidak hanya di dalam aplikasi ini. Ini kemampuan baru yang sebelumnya tidak ada.

### Fitur baru yang sebelumnya tidak tercantum

| Fitur | Alasan penambahan |
|---|---|
| F12 — Unggah berpotongan dan dapat dilanjutkan | Berkas 20 GB tidak dapat dikirim dalam satu kali unggahan yang utuh |
| F14 — Verifikasi hasil ingest | Sebagian kesalahan data tidak menghasilkan pesan error; data masuk dengan sukses namun isinya keliru. Verifikasi visual adalah satu-satunya cara mendeteksinya |
| F15 — Pencegahan duplikasi unggahan | Mencegah data yang sama terunggah berkali-kali |
| F20 — Penyuntingan data vektor | Sudah disebut dalam spesifikasi namun belum pernah tercantum sebagai fitur |
| F25 — Pemberian akses peta | Peran "Viewer dengan akses" sudah ada dalam matriks izin namun mekanismenya belum pernah didefinisikan |

---

## Spesifikasi Teknis Ringkas

| Komponen | Teknologi |
|---|---|
| API | FastAPI (Python), PostgreSQL + PostGIS, Redis |
| Backend (BFF) | Lapis perantara; tidak memuat logika domain |
| Frontend | Vue.js, Leaflet |
| Publikasi & penyajian layanan peta | GeoServer |
| Penyimpanan berkas | MinIO |
| Konversi geospasial | GDAL / OGR, PotreeConverter |
| Viewer 360° | Three.js / Pannellum |
| Viewer pointcloud | Potree |
| Streaming CCTV | MediaMTX |
| Autentikasi & otorisasi | Keycloak |
| Analisis kepadatan | Layanan eksternal, alamat dapat dikonfigurasi |
| Notifikasi WhatsApp | Layanan eksternal, alamat dapat dikonfigurasi |
| Penyebaran | Docker Compose |
| HTTPS | Nginx Reverse Proxy + Let's Encrypt (via aaPanel) |
| Zona waktu | Asia/Jakarta |

---

## Hal yang Masih Menunggu Keputusan

| Keputusan | Diperlukan pada | Dampak bila tertunda |
|---|---|---|
| **Ambang batas kepadatan** | Tahap 1, sub-tahap 1.11 | Tidak menghalangi. Sudah dirancang sebagai variabel konfigurasi dan dapat ditentukan kapan saja tanpa perubahan aplikasi |
| **Jumlah kamera CCTV yang akan dipasang** | Penetapan kapasitas | Perkiraan kapasitas penyimpanan dan beban layanan analisis tidak dapat difinalkan |
| **Pustaka komponen antarmuka** | Tahap 3 | Tidak menghalangi Tahap 1 maupun Tahap 2 |
