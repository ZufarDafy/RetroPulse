# Tahura Djuanda Geo-Intelligence Dashboard
## Spesifikasi Aplikasi

**Pemilik:** UPTD Taman Hutan Raya Ir. H. Djuanda Bandung, Dinas Kehutanan Provinsi Jawa Barat
**Jenis:** Aplikasi Web Sistem Informasi Geografis dengan kemampuan pengawasan kawasan
**Dokumen pendamping:** [ARCHITECTURE.md](ARCHITECTURE.md) — desain teknis, skema data, dan kontrak antarmuka

---

## Tentang Dokumen Ini

Dokumen ini adalah **sumber kebenaran tunggal** untuk aturan bisnis, batasan data, dan matriks izin. Ketika dokumen lain bertentangan dengan dokumen ini, dokumen ini yang berlaku.

Bersama `ARCHITECTURE.md`, keduanya menjadi fondasi bagi seluruh komponen sistem. Ketiga komponen diturunkan dari dua dokumen ini, bukan sebaliknya.

### Tiga komponen sistem

| Komponen | Peran |
|---|---|
| **API** | Layanan inti di sisi server: ingest data, katalog, data spasial, publikasi, dan pemantauan kepadatan. **Tidak pernah diakses langsung oleh pengguna.** |
| **Backend (BFF)** | Lapis pendukung frontend. Menjadi satu-satunya pintu masuk dari browser, sehingga alamat dan kredensial API maupun layanan internal lainnya tidak pernah terekspos |
| **Frontend** | Antarmuka pengguna |

### Urutan pengembangan

Pengembangan dilaksanakan **mengikuti lapisan sistem**, bukan bertahap per kelompok fitur:

```
Tahap 1: API   →   Tahap 2: Backend (BFF)   →   Tahap 3: Frontend
```

Setiap tahap diselesaikan sepenuhnya sebelum tahap berikutnya dimulai. Rincian urutannya ada di [FITUR-APLIKASI.md](FITUR-APLIKASI.md).

Karena itu dokumen ini mendeskripsikan sistem secara **utuh** sejak awal, meskipun yang dikerjakan saat ini baru lapis API. Seluruh aturan bisnis di sini harus sudah terwujud pada Tahap 1 — lapis BFF dan frontend tidak menambahkan aturan baru, hanya menyalurkan dan menampilkannya.

---

## Ringkasan Aplikasi

Aplikasi ini adalah pengembangan lanjutan dari WebGIS konvensional. Kata **"Intelligence"** merujuk pada kemampuan pengawasan kawasan — khususnya pemantauan kepadatan pengunjung yang datanya berasal dari kamera CCTV yang ditempatkan di berbagai lokasi dalam kawasan.

Sistem terdiri dari tiga kemampuan utama:

1. **Manajemen data geospasial** — unggah, konversi, katalogisasi, dan publikasi data raster, vektor, dan pointcloud
2. **Penyajian peta** — pembuatan peta interaktif dari data terkatalog, dapat dipublikasikan ke publik
3. **Pengawasan kawasan** — live stream CCTV, pemantauan kepadatan pengunjung, dan sistem peringatan

---

## 1. Dashboard

Halaman utama yang menampilkan ringkasan kondisi kawasan.

### Kartu KPI

| Kartu | Definisi |
|---|---|
| **Kepadatan Saat Ini** | Untuk setiap kamera aktif diambil **satu** hasil deteksi termuda di dalam jendela waktu yang dapat dikonfigurasi, lalu angka-angka itu dijumlahkan antar kamera |
| **Puncak Kepadatan Hari Ini** | Nilai tertinggi yang pernah dicapai angka gabungan di atas sepanjang hari berjalan (batas hari mengikuti zona waktu Asia/Jakarta) |
| **Alert Aktif** | Jumlah alert kerumunan berstatus belum ditangani. Satu kejadian dihitung sekali, bukan sekali per tangkapan gambar — lihat [5.3](#53-satu-kejadian-satu-alert) |
| **Status CCTV** | Jumlah kamera online dibanding offline |

> **Catatan metodologis.** Metrik ini mengukur **kepadatan (okupansi)**, bukan jumlah kunjungan. Hasil deteksi kamera menghitung jumlah orang yang terlihat dalam satu tangkapan; menjumlahkannya antar waktu akan menghitung orang yang sama berkali-kali. Metrik "Total Kunjungan" **tidak digunakan** dalam sistem ini.
>
> Dari situlah bentuk kedua kartu di atas: penjumlahan hanya dilakukan **antar kamera pada satu titik waktu**, tidak pernah antar waktu. Satu kamera menyumbang tepat satu angka. Hasil deteksi yang belum atau gagal diproses layanan analisis **tidak dihitung sebagai nol** — memperlakukannya begitu akan menurunkan angka kepadatan justru ketika layanan analisis sedang bermasalah, yaitu saat pengawasan paling dibutuhkan.

### Komponen lain

- **Mini-heatmap kepadatan** — versi ringkas dari Crowd Map, dihasilkan langsung dari titik kamera beserta hitungan terbarunya. Zona tidak digunakan di sini: zona berlaku untuk pencarian lokasi, dan tidak ada kamera yang ditugaskan ke zona mana pun
- **Ringkasan status dataset** — jumlah dataset per status (`diunggah`, `sedang diproses`, `selesai`, `gagal`), dipisah per tipe data
- **Feed alert terbaru** — 10 alert terakhir beserta statusnya

---

## 2. Manajemen Dataset

### 2.1 Tipe dan Batasan Data

Sistem menerima **tiga tipe dataset**, masing-masing dengan format tunggal yang ditetapkan secara ketat:

| Tipe | Format diterima | Batas ukuran | Catatan |
|---|---|---|---|
| **Raster** | GeoTIFF (`.tif`) | 20 GB | Subtipe: Ortofoto, DEM, Lainnya |
| **Vektor** | Shapefile dalam ZIP (`.zip`) | 512 MB | Tepat satu `.shp` per ZIP |
| **Pointcloud** | LAZ (`.laz`) | 5 GB | — |

Format lain tidak diterima. Keputusan ini disengaja: satu format per tipe menghilangkan seluruh kelas ketidakpastian pada tahap konversi.

**Atribut wajib saat unggah:** nama dataset dan deskripsi. Keduanya diisi pengguna, tidak diturunkan dari isi berkas.

#### Aturan khusus vektor

Satu ZIP harus memuat **tepat satu** shapefile. ZIP yang memuat lebih dari satu `.shp` **ditolak** dengan pesan eksplisit — sistem tidak akan diam-diam mengambil yang pertama. Konsekuensinya: satu unggahan menghasilkan tepat satu dataset dan satu layer.

Berkas pendamping berikut wajib ada: `.shx`, `.dbf`, dan `.prj`. Ketiadaan `.prj` menghentikan proses, karena tanpanya reproyeksi ke WGS84 tidak dapat dilakukan dengan benar.

#### Aturan khusus raster

Subtipe **DEM** wajib menampilkan **color ramp beserta hillshade**, dengan nilai elevasi minimum dan maksimum yang dihitung otomatis saat ingest sebagai dasar pewarnaannya.

Keduanya dihasilkan dari **satu layer yang sama**, tanpa layer turunan maupun berkas praproses — pewarnaan dan bayangan relief dihitung bersamaan saat peta dirender. Konsekuensinya: mengubah tampilan DEM tidak menambah penyimpanan sedikit pun, dan tidak ada data yang perlu diproses ulang.

### 2.2 Alur Pemrosesan

Seluruh unggahan diproses secara **asinkron**. Pengguna menerima respons segera, lalu memantau status dataset:

```
diunggah → sedang diproses → selesai
                           ↘ gagal
```

Ringkasan alur per tipe (rincian teknis di `ARCHITECTURE.md`):

| Tipe | Alur | Berkas asli |
|---|---|---|
| **Raster** | Unggah → spool → konversi ke Cloud-Optimized GeoTIFF → unggah ke object storage → publikasi | Dihapus; hasil konversi menjadi rujukan |
| **Vektor** | Unggah → spool → catat di katalog → buat tabel spasial → muat ke PostGIS → publikasi | Diarsipkan |
| **Pointcloud** | Unggah → spool → konversi ke pointcloud tiles → unggah ke object storage | Dihapus; hasil konversi menjadi rujukan |

Berkas asli vektor diarsipkan karena kegagalan vektor kerap berasal dari pilihan konversi dan bukan dari datanya, sehingga berkas itu menjadi bahan percobaan berikutnya — dan ukurannya murah. Raster dan pointcloud tidak: berkas 20 GB yang disimpan berdampingan dengan hasil konversinya menghabiskan sekitar 45 GB permanen tanpa memuat informasi yang belum ada di hasil konversinya.

Seluruh data direproyeksi otomatis ke **WGS84 (EPSG:4326)** saat ingest.

Berkas di spool dihapus setelah unggahan ke object storage terkonfirmasi berhasil.

### 2.3 Penanganan Kegagalan

Verdict bersifat **biner**: dataset berhasil atau gagal, tidak ada status peringatan yang lolos.

Ketika konversi gagal, pesan teknis dari perkakas konversi disimpan dan ditampilkan **apa adanya**, didahului kalimat pengantar berbahasa Indonesia yang menjelaskan bahwa pesan tersebut ditujukan untuk diteruskan ke administrator — bukan sesuatu yang harus dipecahkan sendiri oleh pengguna.

### 2.4 Verifikasi Pasca-Ingest

Sebagian kesalahan data tidak menghasilkan error apa pun — data masuk dengan sukses namun isinya keliru. Tiga kasus yang diketahui:

- Berkas `.prj` ada namun isinya salah, sehingga data mendarat di lokasi yang keliru
- Encoding tabel atribut salah, sehingga teks berbahasa Indonesia menjadi rusak
- Koordinat di luar jangkauan yang wajar

Untuk itu, halaman detail dataset **wajib menampilkan**: sistem koordinat sumber yang terdeteksi, bounding box hasil ingest, jumlah fitur, dan beberapa baris contoh atribut. Pengguna yang mengunggah dapat langsung mengenali jika petanya mendarat di tempat yang salah atau namanya menjadi karakter aneh.

### 2.5 Pencegahan Duplikasi

Setiap unggahan dihitung sidik jari SHA-256-nya. Unggahan yang identik dengan berkas yang sudah pernah berhasil diimpor akan **ditolak**.

Sidik jari didaftarkan **hanya setelah** impor berhasil, sehingga unggahan yang gagal tetap dapat diulang dengan berkas yang sama.

Tersedia jalur eksplisit **"unggah sebagai versi baru"** yang melewati pemeriksaan ini, untuk kasus revisi data yang kebetulan identik dengan versi sebelumnya.

### 2.6 Dataset Vektor Buatan Sendiri

Selain unggahan, dataset vektor dapat dibuat sendiri dengan menggambar di atas peta. **Titik masuknya berada di menu Manajemen Peta**, karena menggambar membutuhkan kanvas peta — rincian alurnya di bagian [6.2](#62-pembuatan-dataset-vektor-baru).

Yang perlu ditegaskan di sini: dataset yang dibuat dengan cara itu adalah **entri katalog kelas satu**, bukan anak dari peta tempat ia dibuat. Ia muncul di menu Dataset seperti dataset lain, menempati struktur penyimpanan yang sama persis dengan data hasil unggahan, dipublikasikan dengan mekanisme yang sama, dan **dapat diimpor ke peta lain**.

### 2.7 Penyuntingan Data

Seluruh data vektor — baik hasil unggahan maupun hasil penggambaran — dapat disunting setelahnya, mencakup geometri, nilai atribut, dan struktur field.

Penyuntingan berlangsung dalam **sesi**: pengguna masuk ke mode sunting, melakukan sejumlah perubahan, lalu menyimpannya sekaligus. Pada saat penyimpanan, sistem menyegarkan layanan publikasi agar peta tidak menampilkan data lama.

**Satu layer hanya dapat disunting satu orang pada satu waktu.** Pengguna kedua yang membuka layer yang sama diberi tahu siapa yang sedang menyuntingnya dan sejak kapan, lalu dapat menunggu atau mengambil alih setelah sesi itu ditinggalkan. Ini tidak mengurangi wewenang siapa pun — setiap Staff tetap berhak menyunting layer mana pun ([2.8](#28-kepemilikan-data)) — melainkan mengantre, agar dua orang tidak menghabiskan setengah jam menggambar hal yang saling menimpa.

### 2.8 Kepemilikan Data

Dataset adalah **aset institusi, bukan milik perorangan**. Setiap pengguna berperan Staff atau System Administrator dapat menyunting dan menghapus dataset mana pun, termasuk yang diunggah atau dibuat oleh pengguna lain.

Keputusan ini disengaja: mengunci penyuntingan pada pembuatnya akan menghasilkan data yang membeku ketika pegawai bersangkutan mutasi, cuti, atau pensiun, dan menuntut mekanisme alih kepemilikan hanya untuk menutup masalah yang diciptakan sendiri.

Akuntabilitas ditegakkan melalui **audit log**, bukan melalui penguncian — setiap penyuntingan dan penghapusan mencatat siapa pelakunya dan kapan. Nama pembuat dataset ditampilkan di daftar dan halaman detail.

Satu pengecualian: **penulisan kredensial CCTV dibatasi untuk System Administrator** (lihat [6.3](#63-registry-kamera-cctv)).

### 2.9 Penghapusan Dataset

Penghapusan **diblokir** jika dataset masih digunakan oleh satu atau lebih peta. Pengguna ditampilkan daftar peta yang terdampak.

Jika diizinkan, penghapusan bersifat **langsung** — tidak ada masa tenggang. Karena penghapusan melintasi empat sistem (basis data spasial, layanan publikasi, object storage, dan cache tile), pelaksanaannya dijalankan dalam dua tahap: dataset ditandai terhapus dan langsung hilang dari seluruh tampilan, lalu pembersihan lintas sistem dijalankan sebagai pekerjaan latar yang dapat diulang bila sebagian gagal.

Penghapusan dicatat di audit log.

---

## 3. Pointcloud Viewer

- Unggah dan hapus dataset pointcloud (`.laz`, maksimal 5 GB)
- Konversi ke format pointcloud tiles dijalankan di latar belakang, dengan status yang sama dengan dataset lain
- Viewer menyediakan kontrol standar:
  - Pewarnaan berdasarkan elevasi, intensitas, RGB, atau warna solid
  - Pengaturan ukuran titik
  - Alat pengukuran jarak dan tinggi
  - Cross-section / clipping plane
  - Mode kamera orbit dan first-person
  - Informasi metadata: jumlah titik, extent, sistem koordinat

---

## 4. CCTV Dashboard

- Menampilkan live streaming dari seluruh CCTV terdaftar dalam tampilan grid
- Stream RTSP ditranscode ke HLS/WebRTC oleh layanan transcoding terpisah
- Playback di browser menggunakan pustaka HLS; Safari memakai dukungan HLS native
- Peta lokasi CCTV beserta status online/offline setiap kamera
- Sumber data adalah registry kamera beserta layer lokasinya — lihat [6.3](#63-registry-kamera-cctv)

**Akses live stream dibatasi untuk peran System Administrator, Staff, dan Security.** Pembatasan ini bersifat mutlak dan tidak dapat diberikan melalui mekanisme hibah akses per-peta.

---

## 5. Crowd Map

### 5.1 Mekanisme Deteksi

Kamera CCTV dapat dijangkau langsung oleh server melalui RTSP/RTMP. Karena itu pengambilan tangkapan gambar dilakukan **oleh server sendiri**, tanpa aplikasi klien terpisah.

Alurnya:

1. Server mengambil satu tangkapan gambar dari setiap kamera setiap **30 detik**
2. Tangkapan disimpan, lalu dikirim ke **endpoint inferensi eksternal** yang alamatnya merupakan variabel konfigurasi
3. Endpoint mengembalikan jumlah orang terdeteksi
4. Hasil disimpan dengan atribut: waktu, ID kamera, jumlah, dan rujukan ke tangkapan gambar
5. Jika jumlah melampaui ambang batas, alert dibuat

**Model deteksi tidak menjadi bagian dari sistem ini.** Sistem hanya mengenal sebuah endpoint yang menerima gambar dan mengembalikan angka. Kontrak antarmukanya didefinisikan di `ARCHITECTURE.md`.

Jika endpoint tidak tersedia, tangkapan gambar tetap tersimpan dan pekerjaan masuk antrian pengulangan — data mentah tidak hilang karena layanan inferensi sedang tidak aktif.

**Ambang batas kepadatan** merupakan variabel konfigurasi. Nilainya ditentukan kemudian oleh pemangku kepentingan.

### 5.2 Fitur Halaman

- Peta heatmap kepadatan pengunjung, diperbarui secara real-time
- Tangkapan gambar dari kamera terdekat
- Tabel log alert dengan filter berdasarkan kamera dan tanggal
- Popup notifikasi saat kepadatan terdeteksi, satu popup per lokasi kamera
- Klik popup membuka halaman detail alert yang memuat nama lokasi, tangkapan gambar, jumlah terdeteksi, waktu, dan live stream CCTV lokasi tersebut
- Tombol **"Tandai Sudah Ditangani"** yang mencatat penangan dan waktu penanganan

### 5.3 Satu Kejadian, Satu Alert

Kamera mengambil tangkapan gambar setiap 30 detik. Kerumunan yang bertahan sepuluh menit di atas ambang karenanya terdeteksi dua puluh kali — tetapi itu **satu kejadian**, bukan dua puluh.

Karena itu: selama sebuah kamera masih memiliki alert yang belum ditangani, deteksi berikutnya di atas ambang **memperbarui alert yang sama** — mencatat jumlah tertinggi yang pernah tercapai dan waktu terakhir kerumunan masih terpantau — tanpa membuat alert baru dan **tanpa mengirim notifikasi ulang**.

Alert baru untuk kamera tersebut hanya lahir setelah alert sebelumnya ditandai sudah ditangani. Bila kerumunan masih berlangsung saat itu, deteksi berikutnya akan membuat alert baru — dan itu memang benar, karena petugas menyatakan kejadian sebelumnya selesai.

Tanpa aturan ini tabel log alert menjadi tidak terbaca, penerima notifikasi WhatsApp akan mematikan pemberitahuannya, dan kartu KPI "Alert Aktif" menghitung tangkapan gambar alih-alih kejadian.

### 5.4 Notifikasi

**Di dalam aplikasi:** popup real-time kepada pengguna yang sedang aktif.

**WhatsApp:** pesan dikirim melalui **endpoint notifikasi eksternal** yang alamatnya merupakan variabel konfigurasi. Sistem tidak mengelola sesi WhatsApp, tidak memindai QR code, dan tidak menyimpan status koneksi.

**Daftar nomor penerima** dikelola di dalam aplikasi oleh System Administrator, disimpan pada tabel lokal — tidak diambil dari profil pengguna di sistem identitas.

### 5.5 Retensi Data

| Data | Kebijakan |
|---|---|
| Baris hasil deteksi | **Disimpan permanen** sebagai bahan analisis jangka panjang |
| Tangkapan gambar yang terkait alert | Disimpan permanen |
| Tangkapan gambar lainnya | Dihapus otomatis setelah masa simpan yang dikonfigurasi (baku: 30 hari) |

> **Catatan kapasitas.** Dengan 10 kamera pada interval 30 detik, sistem menghasilkan sekitar 28.800 tangkapan gambar dan baris data per hari. Baris data yang disimpan permanen mencapai sekitar 10,5 juta baris per tahun — masih ringan untuk PostgreSQL. Tangkapan gambar tanpa kebijakan pembersihan akan mencapai sekitar 2 TB per tahun, dan itulah alasan pembersihan otomatis diterapkan.

---

## 6. Manajemen Peta

### 6.1 CRUD dan Publikasi

- Buat, sunting, dan hapus peta dengan atribut nama, deskripsi, dan slug URL
- **Peta yang dipublikasikan** dapat diakses publik tanpa login melalui `/map/public/<slug>`, dengan hak akses setara Viewer, dan dapat disematkan di situs lain melalui iframe
- **Peta yang tidak dipublikasikan** hanya dapat diakses oleh pengguna yang diberi akses secara eksplisit

### 6.2 Pembuatan Dataset Vektor Baru

Selain mengimpor layer dari katalog, pengguna dapat membuat dataset vektor baru dengan menggambar langsung di atas peta. Alurnya mengikuti pola yang lazim di perangkat lunak GIS desktop seperti QGIS:

1. **Buat layer baru** — masukkan nama dan deskripsi dataset
2. **Pilih tipe geometri** — titik, garis, atau poligon. Ditetapkan di muka dan tidak dapat diubah setelahnya
3. **Definisikan struktur atribut** — daftar field beserta tipenya: teks, angka bulat, angka desimal, atau tanggal
4. **Masuk mode sunting** — gambar fitur di peta, isi nilai atributnya, lalu simpan

Berbeda dengan shapefile, struktur atribut di sini tidak dibatasi panjang karakter maupun lebar kolom. Nama field bebas dari batas 10 karakter, dan field teks tidak perlu ditentukan panjangnya di muka.

Alat menggambar yang tersedia mengikuti tipe geometri layer — layer bertipe titik hanya menawarkan alat titik.

Dataset hasil pembuatan ini masuk ke katalog seperti dataset lain dan dapat diimpor ke peta mana pun (lihat [2.6](#26-dataset-vektor-buatan-sendiri)).

#### Tipe dataset vektor yang dapat dibuat

| Tipe | Atribut wajib | Batas ukuran media |
|---|---|---|
| Titik / Garis / Poligon umum | — (atribut bebas) | — |
| Titik Gambar | berkas gambar | — |
| Titik Gambar 360 | berkas gambar 360 | — |
| Titik Video | berkas video | 6 GB |
| Titik Video 360 | berkas video 360 | 6 GB |
| Garis Video | berkas video | 6 GB |
| Garis Video 360 | berkas video 360 | 6 GB |

Atribut tambahan di luar yang wajib bersifat dinamis untuk seluruh tipe.

> **Titik CCTV tidak termasuk di sini.** Kamera bukan layer yang digambar pengguna melainkan registry sistem yang kebetulan spasial — lihat [6.3](#63-registry-kamera-cctv).

### 6.3 Registry Kamera CCTV

Kamera dikelola sebagai **registry**, bukan sebagai dataset vektor yang digambar. Menambahkan kamera adalah satu aksi: pengguna mengisi atribut kamera dan **menandai lokasinya di peta pada formulir yang sama**. Geotagging bersifat wajib — tidak ada kamera tanpa titik.

Datanya tersebar di **tiga tempat** dengan umur dan kewenangan yang berbeda:

| Tempat | Isi | Dipublikasikan | Ditulis oleh |
|---|---|---|---|
| **Registry kamera** | identitas, nama, status online/offline | Tidak | Staff dan System Administrator |
| **Tabel lokasi** | geometri dan atribut non-sensitif | Ya, seperti layer lain | Staff dan System Administrator |
| **Tabel kredensial** | username, password, port | **Tidak pernah** | **Hanya System Administrator** |

Seluruh titik kamera berada dalam **satu layer sistem tunggal** yang berlaku system-wide, bukan satu layer per kelompok kamera. Layer ini dibuat sekali saat sistem disiapkan dan tidak dapat dihapus pengguna, namun dapat ditambahkan ke peta mana pun seperti layer biasa.

Kredensial disimpan **terenkripsi at rest**. Alamat IP publik klien disimpan sebagai variabel lingkungan. URL stream RTSP bersifat opsional.

Pemisahan kredensial bersifat wajib, bukan preferensi: jika kredensial berada di tabel yang dipublikasikan, layanan peta akan membocorkannya melalui operasi kueri fitur standar.

**Penulisan kredensial dibatasi untuk System Administrator.** Staff tetap dapat menambahkan kamera, memindahkan titiknya, dan menyunting atribut non-sensitifnya, tetapi tidak dapat mengisi maupun mengubah username, password, dan port. Wewenang atas akses kamera kawasan lebih berat daripada wewenang atas data peta biasa, dan pemisahan tabel membuat pembatasan ini mudah ditegakkan.

Kamera yang sudah ditandai Staff tetapi belum berkredensial **tetap tampil di peta dan terhitung di kartu KPI** — ia hanya belum diambil tangkapan gambarnya. Dengan demikian pembagian wewenang di atas tidak menghasilkan kamera yang tak berwujud selama menunggu System Administrator.

**Kamera dipensiunkan, bukan dihapus.** Titiknya lenyap dari peta, sementara riwayat kepadatan dan seluruh alert lamanya tetap utuh dan tetap dapat dibaca lengkap dengan nama lokasinya.

### 6.4 Penyusunan Peta

- Layer bersumber dari dataset raster atau vektor yang sudah terkatalog
- **Basemap:** OpenStreetMap dengan pilihan terrain, satelit, dan topografi
- **Sidebar detail layer** menampilkan atribut, field dinamis, dan konten multimedia
  - Multimedia ditampilkan dalam viewer dengan kontrol sesuai jenisnya: play/pause untuk video, zoom untuk gambar, pan/rotate untuk konten 360
  - **Live stream CCTV di sidebar hanya dapat dilihat oleh System Administrator, Staff, dan Security** — tidak termasuk Viewer, meskipun Viewer memiliki akses ke peta tersebut
- **Legenda layer** ditampilkan di sidebar, dihasilkan otomatis dari style layer

### 6.5 Alat Peta

- **Pengukuran** jarak dan luas area
- **Pencarian lokasi** dari daftar zona bernama yang dikelola secara system-wide; memilih zona menggerakkan peta ke lokasi tersebut
- **Cetak dan ekspor** tampilan peta ke PNG atau PDF
- **Kontrol peta:** zoom in, zoom out, zoom ke extent data

### 6.6 Pengaturan Layer

- Urutan layer (depan/belakang)
- Visibilitas layer
- Transparansi layer

### 6.7 Simbologi

Pada tahap ini seluruh layer ditampilkan menggunakan **style baku** yang ditetapkan sistem berdasarkan tipe geometri (titik, garis, poligon). Simbologi kustom per layer akan dikembangkan secara terpisah di kemudian hari; struktur data sudah menyediakan tempatnya sehingga penambahan nanti tidak memerlukan perubahan skema.

---

## 7. Administrasi

### 7.1 Manajemen API Key

CRUD API key untuk konsumen eksternal. Setiap kunci memiliki label, tanggal dibuat, tanggal terakhir digunakan, dan status aktif/nonaktif. Nilai penuh kunci hanya ditampilkan sekali saat dibuat; setelahnya sistem hanya menyimpan hash-nya.

**Untuk apa API key dipakai.** Peta yang dipublikasikan sudah dapat dibuka tanpa login sama sekali, termasuk dari QGIS dan ArcGIS. API key karenanya tidak diperlukan untuk data publik — **kegunaannya semata memberi konsumen eksternal akses ke peta yang tidak dipublikasikan.**

Hibah diberikan **per peta**, satuan yang sama dengan hibah kepada pengguna dan kelompok. Tiga batasan melekat padanya:

- API key **tidak pernah memberi hak tulis** — seluruh operasi pengubahan data tetap menuntut login
- API key **tidak pernah membuka live stream CCTV**, yang sepenuhnya ditentukan peran
- Pemakaian tercatat, sehingga kunci yang menganggur dapat dikenali dan dinonaktifkan

### 7.2 Manajemen Nomor Penerima Notifikasi

CRUD daftar nomor WhatsApp yang menerima notifikasi alert kerumunan.

### 7.3 Manajemen Zona / Lokasi Pencarian

CRUD zona bernama yang berlaku system-wide untuk fitur pencarian lokasi di seluruh peta. Dikelola oleh Staff.

### 7.4 Audit Log

Seluruh aksi create, update, dan delete pada dataset, peta, kamera, dan alert dicatat dan dapat ditinjau oleh System Administrator.

**Penulisan kredensial CCTV selalu dicatat** — siapa yang mengisinya dan kapan, tanpa pernah mencatat nilainya. Inilah satu-satunya wewenang yang dibatasi pada satu peran, sehingga justru yang paling perlu berjejak.

### 7.5 Manajemen Pengguna

Manajemen pengguna **didelegasikan sepenuhnya ke konsol administrasi sistem identitas (Keycloak)**. Tidak ada antarmuka manajemen pengguna yang dibangun di dalam aplikasi ini. System Administrator diberi akses ke konsol tersebut.

---

## 8. Identitas, Peran, dan Kontrol Akses

### 8.1 Sistem Identitas

**Keycloak**, dengan konfigurasi:

- Dua client: `tahura-backend` dan `tahura-frontend`
- Masa berlaku access token: **15 menit**
- Masa berlaku refresh token: **7 hari**
- **Silent refresh** — token diperbarui otomatis selama pengguna aktif
- **Global logout** — logout dari satu tab otomatis mengakhiri sesi di seluruh tab melalui back-channel logout

### 8.2 Peran

| Peran | Deskripsi |
|---|---|
| **System Administrator** | Akses penuh; mengelola API key, nomor penerima notifikasi, dan audit log |
| **Staff** | Mengelola dataset dan peta; mengelola zona pencarian |
| **Security** | Memantau CCTV dan Crowd Map, serta menangani alert |
| **Viewer** | Melihat peta dan multimedia yang diberi akses, kecuali live stream CCTV |
| **Public** | Melihat peta yang dipublikasikan, tanpa login |

### 8.3 Model Kontrol Akses

Kontrol akses bekerja dalam **dua lapis**.

**Lapis 1 — kapabilitas berbasis peran.** Peran menentukan apa yang boleh dilakukan secara global: mengunggah dataset, mempublikasikan peta, melihat stream CCTV, dan seterusnya. Lapis ini menutup sebagian besar matriks izin.

**Lapis 2 — hibah akses per-peta.** Hanya **peta** yang memiliki hibah akses eksplisit. Aturan penentuannya, berurutan:

1. Peta dipublikasikan → dapat diakses siapa pun, termasuk tanpa login, dengan hak setara Viewer
2. Pengguna berperan System Administrator atau Staff → akses penuh
3. Pemanggil membawa API key yang diberi hibah ke peta tersebut → akses baca (lihat [7.1](#71-manajemen-api-key))
4. Selain itu → pengguna harus memiliki hibah akses eksplisit ke peta tersebut

**Enam ketentuan yang membatasi model ini secara sengaja:**

- **Dataset tidak memiliki hibah akses.** Staff mengelola seluruh dataset; Viewer tidak pernah mengakses halaman dataset.
- **Multimedia mewarisi akses dari peta yang memuatnya.** Tidak ada hibah terpisah untuk gambar atau video.
- **Tidak ada hibah per-layer.** Akses diberikan pada tingkat peta, bukan lapisan di dalamnya.
- **Live stream CCTV tidak pernah tunduk pada hibah akses.** Ia sepenuhnya ditentukan oleh peran.
- **Layer lokasi CCTV juga tidak tunduk pada hibah akses.** Karena seluruh titik kamera berada dalam satu layer sistem, satu peta yang dipublikasikan akan cukup untuk menyingkap posisi seluruh kamera di kawasan. Layer ini hanya tampil bagi System Administrator, Staff, dan Security — peta publik yang memuatnya tetap dapat dipublikasikan, hanya titik kameranya yang tidak tampil bagi pengunjung.
- **Kepemilikan bukan bagian dari kontrol akses.** Pembuat dataset atau peta dicatat sebagai keterangan, bukan sebagai pembatas wewenang — lihat [2.8](#28-kepemilikan-data).

### 8.4 Matriks Izin

| Fitur | Sys Admin | Staff | Security | Viewer | Public |
|---|---|---|---|---|---|
| Unggah / Sunting / Hapus Dataset | ✅ † | ✅ † | ❌ | ❌ | ❌ |
| Tambah / Sunting / Pensiunkan Kamera | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tulis Kredensial CCTV | ✅ | ❌ | ❌ | ❌ | ❌ |
| Lihat Layer Lokasi CCTV | ✅ | ✅ | ✅ | ❌ | ❌ |
| Buat / Sunting / Hapus Peta | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publikasi Peta | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat Peta Dipublikasikan | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lihat Peta + Multimedia (diberi akses) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lihat Live Stream CCTV | ✅ | ✅ | ✅ | ❌ | ❌ |
| CCTV Dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crowd Map & Tangani Alert | ✅ | ✅ | ✅ | ❌ | ❌ |
| Kelola Zona / Lokasi Pencarian | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kelola API Key | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kelola Nomor Penerima Notifikasi | ✅ | ❌ | ❌ | ❌ | ❌ |
| Lihat Audit Log | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manajemen Pengguna | ✅ * | ❌ | ❌ | ❌ | ❌ |

> \* Melalui konsol administrasi Keycloak, bukan melalui antarmuka aplikasi ini.
>
> † Berlaku untuk **seluruh** dataset tanpa memandang siapa pembuatnya — lihat [2.8](#28-kepemilikan-data). Kepemilikan tidak pernah membatasi wewenang; akuntabilitas ditegakkan melalui audit log.
>
> ‡ Matriks ini mengatur **pengguna**. Konsumen eksternal yang membawa API key bukan pengguna dan tidak memiliki peran: ia hanya memperoleh akses **baca** ke peta yang secara eksplisit dihibahkan kepadanya — lihat [7.1](#71-manajemen-api-key).

---

## 9. Antarmuka Pengguna

### 9.1 Ketentuan Umum

- **Light / Dark mode**
- **Responsive design (WAJIB)** — mendukung Chrome, Firefox, Safari, serta browser mobile iOS Safari dan Android Chrome
- Seluruh tampilan daftar menggunakan **pagination sisi server**

### 9.2 Bahasa

Tiga pilihan bahasa: **Bahasa Indonesia** (baku), **English (EN-US)**, dan **Bahasa Sunda (SU)**.

**Kebijakan penerjemahan** berlaku sama untuk ketiganya: istilah yang lazim diterjemahkan secara wajar; **istilah teknis tidak dipaksakan diterjemahkan** apabila hasilnya menimbulkan kerancuan tata bahasa atau makna. Istilah seperti *shapefile*, *raster*, *pointcloud*, *layer*, dan *basemap* dipertahankan dalam bentuk aslinya.

Setiap teks yang belum tersedia terjemahannya jatuh kembali ke Bahasa Indonesia.

---

## 10. Teknologi

### API (layanan inti)
- **Kerangka kerja:** FastAPI (Python)
- **Basis data:** PostgreSQL dengan ekstensi PostGIS
- **Antrian pekerjaan:** PostgreSQL sebagai antrian untuk pekerjaan ingest; Redis untuk fan-out notifikasi real-time dan pekerjaan berfrekuensi tinggi
- **Konversi geospasial:** GDAL / OGR

### Backend (BFF)
- Pintu masuk tunggal dari browser; memvalidasi identitas dan meneruskan permintaan ke API
- Mem-proxy layanan peta sehingga GeoServer tidak perlu terekspos
- Tidak memuat logika domain — seluruh aturan bisnis tetap berada di API

### Penyajian Data
- **Publikasi dan penyajian (raster & vektor):** GeoServer — layanan OGC yang sama melayani konsumen internal maupun eksternal
- **Object storage:** MinIO

### Frontend
- **Kerangka kerja:** Vue.js
- **Peta:** Leaflet
- **Viewer 360:** Three.js atau Pannellum
- **Pointcloud:** Potree
- **Pemutar HLS:** hls.js, dengan HLS native pada Safari

### Layanan Pendukung
- **MediaMTX** — transcoding RTSP menjadi HLS/WebRTC
- **Keycloak** — sistem identitas

### Layanan Eksternal (di luar lingkup sistem ini)
- **Endpoint inferensi** — menerima gambar, mengembalikan jumlah orang terdeteksi
- **Endpoint notifikasi** — menerima pesan, meneruskan ke WhatsApp

---

## 11. Penyimpanan Data

- **Seluruh berkas** — raster hasil konversi, pointcloud tiles, dan seluruh konten multimedia — disimpan di **MinIO**
- **Setiap berkas multimedia didaftarkan** di katalog media, sehingga sistem selalu tahu berkas mana milik fitur mana — tanpa itu, berkas yatim tidak dapat dikenali dan penghapusan dataset tidak dapat dipastikan bersih
- **Spool** hanya bersifat sementara selama pemrosesan, dan dibersihkan setelah unggahan ke MinIO terkonfirmasi
- **Data vektor** disimpan sebagai tabel spasial di PostGIS
- **Metadata dataset** disimpan di PostgreSQL
- **Kredensial CCTV** disimpan terenkripsi at rest, terpisah dari tabel yang dipublikasikan
- Akses berkas dari browser menggunakan **presigned URL** berjangka waktu

---

## 12. Tata Kelola

- **Zona waktu:** seluruh perhitungan berbasis hari menggunakan **Asia/Jakarta**
- **Audit log:** seluruh aksi mutasi pada dataset, peta, dan alert dicatat
- **Pagination sisi server** pada seluruh tampilan daftar
- **Penghapusan dataset** diblokir bila masih digunakan peta

---

## 13. Infrastruktur dan Penyebaran

- **Seluruh lapis sistem berbentuk container.** API, Backend (BFF), dan Frontend — beserta seluruh layanan pendukung — dijalankan melalui `docker compose`. Tidak ada komponen yang dipasang langsung di host, karena pemisahan zona jaringan yang menjaga keamanan sistem hanya berlaku bila semuanya berada di dalam jaringan Docker
- **HTTPS** ditangani oleh aaPanel (Nginx reverse proxy + Let's Encrypt) di luar Docker Compose — satu-satunya komponen yang berada di luar
- **Backup** basis data PostgreSQL dan seluruh bucket MinIO dilakukan berkala ke NAS
- **Seluruh variabel lingkungan** disimpan di berkas `.env` dan tidak pernah di-commit ke repository. Repositori menyertakan `.env.example` berisi seluruh kunci beserta penjelasannya, tanpa nilai rahasia
- **Tidak ada nilai konfigurasi yang di-hardcode**
- **Dokumentasi tidak ditulis di dalam kode.** Kode tidak memuat docstring maupun komentar inline; seluruh penjelasan berada di dokumen terpisah

---

## 14. Keputusan yang Masih Terbuka

Dua hal berikut belum ditetapkan dan tidak menghalangi dimulainya pengembangan API, namun perlu diputuskan sebelum pekerjaan frontend dan sebelum penetapan kapasitas server:

| Keputusan | Diperlukan untuk | Dampak bila tertunda |
|---|---|---|
| **Pustaka komponen UI frontend** | Pengembangan frontend | Tidak berdampak pada API |
| **Jumlah kamera CCTV yang akan dipasang** | Penetapan kapasitas storage dan beban inferensi | Perkiraan kapasitas tidak dapat difinalkan |

**Ambang batas kepadatan** juga belum ditetapkan, namun sudah dirancang sebagai variabel konfigurasi sehingga dapat ditentukan kapan saja tanpa perubahan kode.
