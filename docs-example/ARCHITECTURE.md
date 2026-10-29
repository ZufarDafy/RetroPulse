# Tahura Djuanda Geo-Intelligence Dashboard
## Arsitektur Teknis

**Dokumen pendamping:** [ABOUT-APPS.md](ABOUT-APPS.md) — spesifikasi aplikasi dan aturan bisnis

Dokumen ini mendefinisikan **bagaimana** sistem dibangun. Untuk **apa** yang dibangun dan mengapa, lihat `ABOUT-APPS.md`. Ketika keduanya bertentangan mengenai aturan bisnis, `ABOUT-APPS.md` yang berlaku.

---

## 1. Topologi Layanan

### 1.1 Tiga Lapis

Sistem terdiri dari tiga lapis dengan tanggung jawab yang berbeda. Pemisahan ini adalah **kontrol keamanan**, bukan sekadar penataan.

| Lapis | Peran | Dijangkau browser |
|---|---|---|
| **Frontend** | Antarmuka pengguna (Vue) | — |
| **Backend (BFF)** | Satu-satunya pintu masuk dari browser. Menyimpan alamat dan kredensial seluruh layanan internal, memvalidasi identitas, meneruskan permintaan yang berhak | Ya |
| **API** | Layanan inti: ingest, katalog, data spasial, publikasi, pemantauan kepadatan | **Tidak** |

Browser tidak pernah mengetahui alamat maupun kredensial API, GeoServer, atau layanan internal lainnya.

```
┌─ BROWSER ───────────────────────────────────────────────────┐
│   Frontend (Vue)                                             │
└───┬───────────────┬──────────────────┬──────────────────────┘
    │ seluruh       │ login OIDC       │ objek via presigned URL
    │ permintaan    │                  │ (satu-satunya akses langsung)
    ▼               ▼                  ▼
┌─ TEREKSPOS (Nginx / aaPanel, HTTPS) ────────────────────────┐
│   Backend (BFF)         Keycloak          MinIO              │
└───┬──────────────────────────────────────────────────────────┘
    │ kredensial layanan; hanya dari jaringan internal
┌───▼─ INTERNAL (Docker network) ──────────────────────────────┐
│   API (FastAPI)               GeoServer + GeoWebCache        │
│   PostgreSQL + PostGIS        MediaMTX                        │
│   Redis                       Worker ingest                   │
│   Worker snapshot             Worker scheduler                │
└───────────────────────────────────────────────────────────────┘
```

### 1.2 Pembagian Tanggung Jawab

**API** memegang seluruh logika domain dan seluruh kredensial data:

- Pipeline ingest untuk ketiga tipe dataset
- Katalog dataset dan layer
- Akses ke PostGIS, MinIO, dan GeoServer REST API
- Penerbitan presigned URL
- Pengambilan snapshot CCTV dan integrasi endpoint inferensi
- Penegakan aturan hak akses (§7)

**Backend (BFF)** tidak memegang logika domain. Tugasnya semata menjadi perisai dan penyesuai:

- Memvalidasi token Keycloak yang datang dari browser
- Meneruskan permintaan ke API menggunakan kredensial layanan yang tidak pernah terlihat browser
- Mem-proxy GeoServer, sehingga ia tidak perlu terekspos sama sekali
- Menerbitkan token stream berjangka pendek untuk MediaMTX
- Menyusun bentuk respons sesuai kebutuhan tampilan

**Aturan mutlak: API dan GeoServer tidak pernah dapat dijangkau langsung oleh browser.** Untuk GeoServer konsekuensi pelanggarannya paling konkret — operasi `GetCapabilities` akan membocorkan seluruh daftar layer, dan model kontrol akses menjadi tidak berarti.

MinIO adalah **pengecualian yang disengaja**: browser mengambil objeknya secara langsung, tetapi hanya melalui presigned URL berjangka waktu yang diterbitkan API dan diteruskan BFF. Memproksikan video 6 GB melalui BFF akan memboroskan sumber daya tanpa menambah keamanan, karena presigned URL sudah merupakan kapabilitas berbatas waktu, bukan kredensial.

### 1.3 Urutan Pengembangan

Sistem dibangun **mengikuti lapisan**, bukan bertahap per kelompok fitur:

```
Tahap 1: API   →   Tahap 2: Backend (BFF)   →   Tahap 3: Frontend
```

Tiga konsekuensi yang mengikat desain API:

- **Seluruh aturan bisnis harus terwujud di Tahap 1.** BFF dan frontend tidak menambahkan aturan baru — keduanya hanya menyalurkan dan menampilkan. API tidak boleh mengandalkan lapis di atasnya untuk menegakkan apa pun.
- **Kontrak API adalah hasil kerja Tahap 1**, bukan produk sampingan. Dokumentasi OpenAPI yang lengkap merupakan syarat dimulainya Tahap 2, karena BFF dibangun sepenuhnya di atasnya.
- **Kemajuan Tahap 1 harus dapat diverifikasi tanpa antarmuka.** Bukti terkuatnya adalah membuka layer hasil ingest langsung di QGIS melalui layanan OGC — yang membuktikan jalur data berfungsi ujung ke ujung tanpa satu baris pun kode frontend.

### 1.4 Daftar Layanan

| Layanan | Peran | Terekspos ke browser |
|---|---|---|
| **Backend (BFF)** | Pintu masuk tunggal; proxy API dan GeoServer | Ya, via Nginx |
| **API (FastAPI)** | Logika domain, ingest, katalog, hak akses | **Tidak** |
| **PostgreSQL + PostGIS** | Metadata aplikasi, tabel spasial, antrian pekerjaan | Tidak |
| **Redis** | Fan-out notifikasi real-time, antrian snapshot | Tidak |
| **MinIO** | Object storage seluruh berkas | Hanya via presigned URL |
| **GeoServer + GeoWebCache** | Publikasi OGC (WMS/WFS/WMTS) dan penyajian tile raster maupun vektor | Tidak — hanya via proxy BFF |
| **MediaMTX** | Transcoding RTSP → HLS/WebRTC | Ya, dengan token stream |
| **Keycloak** | Sistem identitas | Ya, via Nginx |
| **Worker ingest** | Pemrosesan unggahan asinkron | Tidak |
| **Worker snapshot** | Pengambilan tangkapan CCTV berkala | Tidak |

---

## 2. Object Storage (MinIO)

### 2.1 Tata Letak Bucket

```
tahura-cog/         <dataset_id>/<nama>.tif          COG hasil konversi
tahura-pointcloud/  <dataset_id>/metadata.json       keluaran PotreeConverter 2.x
                    <dataset_id>/hierarchy.bin
                    <dataset_id>/octree.bin
tahura-media/       <dataset_id>/<feature_id>/<berkas>   gambar, video, konten 360
tahura-snapshot/    <camera_id>/<YYYY-MM-DD>/<timestamp>.jpg
tahura-source/      <dataset_id>/<berkas asli>       arsip ZIP shapefile — vektor saja
```

Bucket `tahura-source` **hanya memuat berkas sumber vektor**. Raster dan pointcloud tidak diarsipkan: hasil konversinya menjadi berkas rujukan dataset seterusnya, dan berkas aslinya dihapus setelah konversi terkonfirmasi berhasil (§4.3, §4.5).

Seluruh bucket bersifat **private**. Tidak ada kebijakan anonymous read.

### 2.2 Kredensial

Dua service account terpisah, masing-masing dengan hak paling minimal:

| Akun | Hak | Dipakai oleh |
|---|---|---|
| `tahura-app` | baca-tulis seluruh bucket | FastAPI, worker |
| `geoserver-ro` | `s3:GetObject` terbatas pada `tahura-cog/` | GeoServer |

Kebijakan `geoserver-ro` yang sudah terbukti pada pembuktian konsep §6.4:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::tahura-cog/*"] },
    { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::tahura-cog"] }
  ]
}
```

Diverifikasi bahwa akun ini **dapat membaca**, **ditolak saat menulis**, dan **tidak melihat bucket lain**.

Kedua akun disemai otomatis oleh service one-shot `minio-init` di `app-requirement/minio/` — idempoten, dengan kunci akses dan secret diambil dari `.env`. Jalankan ulang **mengonvergenkan** policy dan secret ke nilai `.env`, sehingga rotasi kredensial cukup mengubah `.env` lalu menjalankan ulang init; secret lama mati seketika (teruji). Policy `tahura-app` juga bukan wildcard: `s3:*` yang dibatasi pada ARN kelima bucket — akun aplikasi pun ditolak membuat bucket di luar itu.

### 2.3 Akses dari Browser

Presigned URL diterbitkan API setelah pemeriksaan hak akses, lalu diteruskan BFF. Presigned URL mendukung HTTP Range request, sehingga pemutaran video berukuran besar berjalan tanpa membebani API maupun BFF.

Presigned URL dipakai **hanya untuk konten yang diambil browser secara langsung** — multimedia di `tahura-media/` dan pointcloud tiles di `tahura-pointcloud/`. Untuk pointcloud, `GET /datasets/{id}/pointcloud/tiles` (Sysadmin/Staff; 409 selama dataset belum `completed`) menerbitkan presigned URL ketiga berkas Potree format 2 — `metadata.json`, `hierarchy.bin`, `octree.bin` — beserta `expires_in`; viewer frontend mengarahkan loader potree-core ke ketiganya dan meminta URL baru ketika kedaluwarsa.

Bucket `tahura-cog/` **tidak** memakai presigned URL sama sekali. GeoServer membacanya dengan kredensial statis `geoserver-ro` (§6.4), dan browser tidak pernah menyentuhnya — raster selalu sampai ke browser sebagai gambar hasil render WMS, bukan sebagai berkas.

**Masa berlaku baku: 12 jam.** Frontend meminta URL baru ketika menerima respons 403.

> **Presigned URL tidak dapat dicabut.** Pemeriksaan hak akses terjadi **sekali**, saat URL diterbitkan. Mencabut akses seseorang ke sebuah peta tidak mematikan URL yang sudah terlanjur ia pegang — objeknya tetap dapat diambil sampai tanda tangannya kedaluwarsa. Inilah harga yang dibayar untuk melayani video 6 GB tanpa memproksikannya, dan `PRESIGNED_URL_TTL_SECONDS` adalah satu-satunya kendali atas lebar jendela itu. Perpendek nilainya bila pencabutan akses perlu berlaku lebih cepat, dengan konsekuensi frontend lebih sering meminta URL baru di tengah sesi yang panjang.

**Ketentuan hostname.** Tanda tangan presigned URL terikat pada hostname. Karena itu MinIO **wajib** dapat dijangkau dengan hostname yang sama dari dalam jaringan Docker maupun dari internet. Ketidaksesuaian hostname adalah penyebab kegagalan paling umum pada pola ini.

**CORS** wajib aktif karena Potree viewer membaca objek `tahura-pointcloud` langsung dari browser. Diberlakukan pada tingkat server melalui `MINIO_API_CORS_ALLOW_ORIGIN`, dengan origin dibatasi `PUBLIC_BASE_URL` — origin lain tidak menerima header pengizin (teruji). Pembatasan per-bucket tidak digunakan karena dukungannya bergantung versi, sementara daftar origin-nya toh identik.

---

## 3. Skema Basis Data

### 3.1 Pemisahan Schema

| Schema | Isi |
|---|---|
| `app` | Seluruh tabel aplikasi |
| `gis` | Tabel spasial per-layer, satu tabel per layer vektor |

Pemisahan ini membuat datastore GeoServer dapat diarahkan **hanya** ke schema `gis`, sehingga tabel aplikasi — termasuk kredensial CCTV — secara struktural berada di luar jangkauan layanan publikasi.

### 3.2 Tabel Inti

Seluruh DDL pada bagian ini dan §3.3 terwujud sebagai baseline `001` di `app-requirement/pgsql/sql/`, yang diimpor saat deployment PostgreSQL (§11, §12.1). Keduanya tidak boleh berbeda; perubahan skema selalu melalui migrasi bernomor (§11).

#### `app.datasets` — entitas yang dilihat pengguna

```sql
CREATE TABLE app.datasets (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    description   text NOT NULL,
    kind          text NOT NULL CHECK (kind IN ('raster','vector','pointcloud')),
    status        text NOT NULL DEFAULT 'uploaded'
                      CHECK (status IN ('uploaded','processing','completed','failed')),
    origin        text NOT NULL DEFAULT 'upload'
                      CHECK (origin IN ('upload','drawn','system')),
    source_sha256 text,                   -- sidik jari berkas sumber; lihat app.upload_hashes
    owner_sub     text NOT NULL,          -- subject dari Keycloak
    owner_username text,                  -- preferred_username saat dibuat; migrasi 004
    deleted_at    timestamptz,            -- soft delete; pembersihan dijalankan job
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
```

Inilah satu-satunya identitas yang dikenal frontend. Tidak ada `task_id` yang diekspos.

#### `app.ingest_jobs` — catatan eksekusi

```sql
CREATE TABLE app.ingest_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      uuid NOT NULL REFERENCES app.datasets(id),
    job_type        text NOT NULL CHECK (job_type IN ('ingest','publish','cleanup')),
    status          text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','processing','succeeded','failed')),
    stored_path     text,                 -- lokasi di spool
    error           text,                 -- pesan mentah dari perkakas konversi
    attempts        int NOT NULL DEFAULT 0,
    lease_until     timestamptz,          -- lihat §5.2
    worker_id       text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    finished_at     timestamptz
);
CREATE INDEX ON app.ingest_jobs (status, created_at);
CREATE INDEX ON app.ingest_jobs (dataset_id);
```

Satu dataset dapat memiliki **banyak** job sepanjang hidupnya: ingest awal, publikasi ulang setelah GeoServer sempat tidak aktif, dan pembersihan saat dihapus.

Migrasi `002` (runner API, §11) menambahkan kolom `params jsonb` pada tabel ini dan pada `app.upload_sessions` — pembawa opsi per-unggahan. Subtipe raster yang dipilih pengguna saat unggah disimpan di sesi, lalu berpindah ke pekerjaan ketika unggahan diselesaikan, sehingga worker menerima parameter tanpa menuntut kolom baru untuk setiap kasus.

Migrasi `003` menambahkan `media_kind` pada `app.vector_layers` (NULL untuk layer umum; `image`/`image360`/`video`/`video360` menandai layer bertipe media §6.2 ABOUT-APPS, dengan kesesuaian geometri ditegakkan API) dan memperluas CHECK `kind` pada `app.upload_sessions` dengan nilai `media` — unggahan berkas media per fitur memakai mesin sesi berpotongan yang sama dengan unggahan dataset.

#### Tabel detail per tipe (relasi 1:1 dengan `datasets`)

```sql
CREATE TABLE app.vector_layers (
    dataset_id          uuid PRIMARY KEY REFERENCES app.datasets(id),
    layer_name          text NOT NULL UNIQUE,   -- nama acak 12 karakter, = nama tabel
    source_layer_name   text,                   -- nama asli dari berkas sumber
    geometry_type       text NOT NULL,
    srid                integer NOT NULL DEFAULT 4326,
    source_srid         integer,                -- CRS asal, ditampilkan untuk verifikasi
    attribute_schema    jsonb NOT NULL DEFAULT '[]',
    bbox                jsonb,
    feature_count       integer NOT NULL DEFAULT 0,
    style_name          text,                   -- NULL = pakai style baku per tipe geometri
    sld_body            text,                   -- disiapkan untuk simbologi kustom
    publication_status  text NOT NULL DEFAULT 'pending'
                            CHECK (publication_status IN ('pending','published','failed'))
);

CREATE TABLE app.raster_layers (
    dataset_id          uuid PRIMARY KEY REFERENCES app.datasets(id),
    raster_type         text NOT NULL CHECK (raster_type IN ('ortofoto','dem','lainnya')),
    minio_key           text NOT NULL,
    source_srid         integer,
    bbox                jsonb,
    band_count          integer,
    elevation_min       double precision,       -- DEM
    elevation_max       double precision,       -- DEM
    colormap            text,                   -- DEM
    coveragestore       text,
    publication_status  text NOT NULL DEFAULT 'pending'
                            CHECK (publication_status IN ('pending','published','failed'))
);

CREATE TABLE app.pointcloud_layers (
    dataset_id     uuid PRIMARY KEY REFERENCES app.datasets(id),
    minio_prefix   text NOT NULL,
    point_count    bigint,
    bbox           jsonb,
    source_srid    integer
);
```

Pointcloud **tidak dipublikasikan ke GeoServer** — GeoServer tidak melayani data pointcloud.

#### Peta dan kontrol akses

```sql
CREATE TABLE app.maps (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    description   text,
    slug          text NOT NULL UNIQUE,
    is_published  boolean NOT NULL DEFAULT false,
    owner_sub     text NOT NULL,
    owner_username text,                  -- migrasi 004
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.map_layers (
    map_id       uuid NOT NULL REFERENCES app.maps(id) ON DELETE CASCADE,
    dataset_id   uuid NOT NULL REFERENCES app.datasets(id),
    z_order      integer NOT NULL DEFAULT 0,
    is_visible   boolean NOT NULL DEFAULT true,
    opacity      real NOT NULL DEFAULT 1.0,
    PRIMARY KEY (map_id, dataset_id)
);
CREATE INDEX ON app.map_layers (dataset_id);   -- untuk resolusi akses layer
-- Hanya raster dan vektor; pointcloud ditolak API. Lihat catatan di bawah.

-- Hanya dataset bertipe raster dan vector yang dapat menjadi layer peta.
-- Pointcloud dirender Potree di viewer tersendiri, bukan sebagai layer Leaflet,
-- sehingga API menolak penambahannya dengan 422 — bukan membiarkannya masuk
-- lalu gagal dirender tanpa penjelasan.

CREATE TABLE app.map_access (
    map_id        uuid NOT NULL REFERENCES app.maps(id) ON DELETE CASCADE,
    subject_type  text NOT NULL CHECK (subject_type IN ('user','group')),
    subject_id    text NOT NULL,
    granted_by    text NOT NULL,
    granted_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (map_id, subject_type, subject_id)
);
```

#### CCTV — registry dan pemisahan wajib

Kamera adalah **entitas tersendiri**, bukan turunan dari fitur peta maupun dari barisan kredensialnya. Identitasnya dicetak sekali di `app.cameras`, lalu disalin ke dua tabel lain yang masing-masing punya umur dan kewenangan berbeda.

```sql
-- Registry: identitas kamera. Umurnya melampaui titik peta dan kredensialnya.
CREATE TABLE app.cameras (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    description   text,
    is_active     boolean NOT NULL DEFAULT true,
    is_online     boolean,
    last_check_at timestamptz,
    stream_path   text UNIQUE,
    extra         jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Lokasi: layer terpublikasi di schema gis, nama tabel tetap (lihat §3.3).
CREATE TABLE gis.cctv_location (
    id          bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    camera_id   uuid NOT NULL UNIQUE REFERENCES app.cameras(id),
    geom        geometry(MultiPoint, 4326),
    name        text,
    extra       jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gis.cctv_location USING GIST (geom);

-- Kredensial: schema app, di luar jangkauan datastore GeoServer secara struktural.
CREATE TABLE app.cctv_credentials (
    camera_id     uuid PRIMARY KEY REFERENCES app.cameras(id) ON DELETE CASCADE,
    port          integer NOT NULL,
    username_enc  bytea NOT NULL,
    password_enc  bytea NOT NULL,
    rtsp_url_enc  bytea,
    updated_by    text NOT NULL,
    updated_at    timestamptz NOT NULL DEFAULT now()
);
```

**Geotagging bersifat wajib saat kamera dimasukkan.** Baris `app.cameras` dan `gis.cctv_location` dibuat dalam **satu transaksi**, sehingga tidak pernah ada kamera tanpa lokasi. Kredensial menyusul terpisah, ditulis oleh peran System Administrator, kapan pun setelahnya — kamera yang belum berkredensial tetap tampil di peta dan terhitung di kartu KPI, hanya belum masuk rotasi snapshot.

Tiga alasan identitas kamera tidak boleh menumpang di salah satu dari kedua tabel lainnya:

| Alasan | Akibat bila ditumpangkan |
|---|---|
| Riwayat kepadatan permanen (~10,5 juta baris/tahun) | FK menunjuk ke baris yang dapat disunting dan dihapus pengguna |
| Kamera ada sebelum kredensialnya diisi | Identitas lahir dari `cctv_credentials` berarti kamera Staff tak berwujud sampai sysadmin datang |
| Kewenangan terbelah: Staff atas lokasi, sysadmin atas kredensial | Identitas jadi bergantung pada siapa yang terakhir menyentuhnya |

`is_online` dan `last_check_at` berada di registry, **bukan** di tabel lokasi maupun kredensial. Di tabel lokasi, tulisan worker status tiap `CCTV_STATUS_CHECK_INTERVAL_SECONDS` akan memaksa purge GeoWebCache terus-menerus (§6.8); di tabel kredensial, data non-sensitif akan tercampur dengan rahasia yang penulisannya dibatasi satu peran.

**Kamera dipensiunkan, bukan dihapus.** `is_active = false` disertai penghapusan barisnya dari `gis.cctv_location`, sehingga titiknya lenyap dari peta sementara registry dan seluruh `crowd_records`-nya utuh. Nama lokasi tersimpan di registry justru agar halaman detail alert lama tetap terbaca setelah titiknya tiada.

#### Kepadatan dan alert

```sql
CREATE TABLE app.crowd_records (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    camera_id     uuid NOT NULL REFERENCES app.cameras(id),
    recorded_at   timestamptz NOT NULL,
    count         integer,                 -- NULL sampai inferensi selesai; lihat §9.1
    snapshot_key  text,                    -- objek MinIO; di-NULL-kan saat dibersihkan
    model         text,
    inference_status   text NOT NULL DEFAULT 'pending'
                           CHECK (inference_status IN ('pending','succeeded','failed')),
    inference_attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX ON app.crowd_records (camera_id, recorded_at DESC);
CREATE INDEX ON app.crowd_records (recorded_at);
CREATE INDEX ON app.crowd_records (recorded_at) WHERE inference_status = 'pending';

CREATE TABLE app.alerts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_id     uuid NOT NULL REFERENCES app.cameras(id),
    crowd_record_id bigint NOT NULL REFERENCES app.crowd_records(id),
    count         integer NOT NULL,        -- jumlah saat alert dibuat
    peak_count    integer NOT NULL,        -- jumlah tertinggi selama alert terbuka
    threshold     integer NOT NULL,        -- nilai ambang saat alert dibuat
    status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','handled')),
    last_seen_at  timestamptz NOT NULL DEFAULT now(),
    handled_by    text,
    handled_at    timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.alerts (status, created_at DESC);
CREATE UNIQUE INDEX ON app.alerts (camera_id) WHERE status = 'open';
```

Baris `crowd_records` **tidak pernah dihapus**. Yang dibersihkan hanyalah objek snapshot di MinIO; kolom `snapshot_key` di-NULL-kan agar riwayat numerik tetap utuh sebagai bahan analisis.

**`count` boleh NULL, dan itu disengaja.** Baris ditulis saat tangkapan gambar tersimpan, sebelum inferensi dijalankan (§9.1), sehingga ketidaktersediaan layanan inferensi tidak menghilangkan data mentah. Baris ber-`count` NULL berarti "menunggu inferensi", bukan "nol orang" — seluruh agregasi kepadatan wajib menyaringnya. Indeks parsial di atas melayani pekerjaan pengulangan yang mencari baris tertunda.

#### Media multimedia

```sql
CREATE TABLE app.media_assets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id  uuid NOT NULL REFERENCES app.datasets(id),
    feature_id  bigint NOT NULL,
    kind        text NOT NULL CHECK (kind IN ('image','image360','video','video360')),
    minio_key   text NOT NULL UNIQUE,
    mime_type   text NOT NULL,
    size_bytes  bigint NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.media_assets (dataset_id, feature_id);
```

Konvensi penamaan objek di MinIO (`tahura-media/<dataset_id>/<feature_id>/<berkas>`) tetap berlaku, tetapi **bukan sebagai sumber kebenaran**. Tabel inilah yang menjawab berkas mana milik fitur mana, sehingga endpoint atribut fitur (§7.4) cukup melakukan JOIN untuk menyisipkan presigned URL, pipeline penghapusan dataset tahu persis objek mana yang harus dibersihkan, dan berkas yatim dapat diaudit tanpa memindai seluruh bucket.

#### Tabel pendukung

```sql
app.upload_hashes        (sha256, dataset_id, created_at, PRIMARY KEY (sha256, dataset_id))
app.upload_sessions      (id, dataset_id, kind, filename, total_size, chunk_size,
                          received_chunks, spool_path, expires_at, created_at)
app.zones                (id, name, description, geom geometry(MultiPolygon,4326), created_at)
app.notification_recipients (id, label, phone_number, is_active)
app.api_keys             (id, label, key_hash, is_active, last_used_at, created_at)
app.api_key_maps         (api_key_id, map_id, granted_by, granted_at,
                          PRIMARY KEY (api_key_id, map_id))
app.layer_edit_locks     (dataset_id PRIMARY KEY, user_sub, acquired_at, expires_at)
app.activity_logs        (id, user_sub, user_username, action, resource_type, resource_id, metadata, created_at)
app.schema_migrations    (version PRIMARY KEY, applied_at)
```

Empat catatan atas tabel-tabel di atas:

- **Username pelaku disimpan di samping `sub`** (migrasi `004_actor_usernames.sql`): `owner_username` pada `datasets` dan `maps`, `user_username` pada `activity_logs` — seluruhnya nullable, baris lama tetap hanya ber-`sub`. Token hanya memberi `sub`, sementara UUID itu tidak bermakna bagi pengguna yang membaca daftar dataset, daftar peta, atau audit log; API mengisinya dari `preferred_username` saat baris dibuat dan mengembalikannya di daftar/detail. `sub` tetap menjadi kunci identitas — username dapat berganti di Keycloak.

- **`upload_hashes` berkunci majemuk.** Sidik jari yang sama boleh tercatat lebih dari sekali, karena `ABOUT-APPS.md` §2.5 menyediakan jalur eksplisit "unggah sebagai versi baru". Pemeriksaan duplikasi adalah `EXISTS` atas `sha256`, bukan pelanggaran kunci — dan jalur versi baru melewatinya.
- **`upload_sessions` menopang unggahan yang dapat dilanjutkan** (§4.1). Tanpa state yang persisten, unggahan 20 GB yang terputus di menit ke-90 tidak punya cara mengetahui potongan mana yang sudah diterima. Sesi kedaluwarsa dibersihkan penjadwal beserta berkas spool-nya.
- **`app.zones.geom` bertipe MultiPolygon** dan berindeks GIST. Ini satu-satunya kolom spasial di schema `app`; ia sengaja tidak berada di `gis` karena zona pencarian bukan layer yang dipublikasikan.

### 3.3 Tabel Spasial (`gis`)

Satu tabel per layer vektor, dengan nama **acak 12 karakter** (huruf kecil, diawali huruf) yang dihasilkan sistem — bukan diturunkan dari nama layer sumber.

Tiga alasan:

1. Nama layer sumber dapat mengandung karakter apa pun; nama acak menghilangkan seluruh persoalan sanitasi
2. Tidak ada risiko tabrakan nama antar unggahan
3. Karena nama dijamin alfanumerik, interpolasinya ke dalam pernyataan SQL menjadi **aman secara konstruksi** — sebuah invarian yang harus dipertahankan

> **Invarian yang wajib dijaga.** Nama tabel diinterpolasikan langsung ke dalam SQL karena selalu dihasilkan sistem. Bila suatu saat pengguna diizinkan menentukan nama tabel, jaminan ini runtuh dan seluruh kueri harus ditinjau ulang.

**Satu pengecualian: `gis.cctv_location`.** Tabel ini bernama tetap, dibuat sekali oleh baseline basis data (§11), dan dipublikasikan sekali — bukan hasil unggahan maupun penggambaran pengguna, melainkan layer sistem yang menampung seluruh titik kamera. Pengecualian ini tidak melanggar invarian di atas, karena namanya tetap ditentukan sistem dan tetap alfanumerik.

Baseline itu juga menyemai baris `app.datasets` (dengan `origin = 'system'`) dan `app.vector_layers` untuknya, supaya layer CCTV dapat ditambahkan ke peta, dipublikasikan, dan diselesaikan hak aksesnya melalui jalur yang persis sama dengan layer lain — tanpa satu pun kasus khusus di §7.3. Yang membedakannya hanya dua: tabelnya tidak pernah di-`DROP` oleh pipeline penghapusan dataset, dan datasetnya tidak dapat dihapus pengguna.

Struktur baku setiap tabel:

```sql
CREATE TABLE gis.<layer_name> (
    id          bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    geom        geometry(<TIPE>, 4326),
    <atribut dari sumber, atau didefinisikan pengguna>,
    extra       jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gis.<layer_name> USING GIST (geom);
```

**Tipe geometri selalu MULTI** — `MultiPoint`, `MultiLineString`, atau `MultiPolygon` — untuk kedua asal-usul layer:

- Layer hasil unggahan otomatis dipromosikan lewat `-nlt PROMOTE_TO_MULTI`, karena shapefile lazim mencampur bentuk tunggal dan jamak dalam satu berkas
- Layer yang digambar pengguna dibuat MULTI sejak awal, agar satu aturan berlaku untuk keduanya dan pengguna tetap dapat membuat fitur berbagian banyak — misalnya satu zona yang terdiri dari dua poligon terpisah — tanpa memerlukan layer baru

Untuk layer yang digambar, **tipe geometri dan struktur atribut ditetapkan saat layer didefinisikan**, bukan disimpulkan dari fitur pertama. Tabel dibuat pada saat itu juga, dengan typmod tetap.

Tipe field yang ditawarkan kepada pengguna dipetakan ke PostGIS sebagai berikut:

| Pilihan pengguna | Tipe kolom |
|---|---|
| Teks | `text` |
| Angka bulat | `integer` |
| Angka desimal | `double precision` |
| Tanggal | `date` |

Tidak ada batas panjang karakter maupun lebar kolom yang perlu ditentukan di muka — batasan yang melekat pada shapefile tidak berlaku di sini.

---

## 4. Pipeline Ingest

### 4.1 Unggahan

Berkas dikirim **berpotongan (chunked)** dari frontend ke API. Setiap potongan berukuran sekitar 50 MB; API merangkainya di direktori spool. Unggahan yang terputus dapat dilanjutkan tanpa mengulang dari awal.

Kemampuan melanjutkan itu bertumpu pada `app.upload_sessions` (§3.2), yang menyimpan potongan mana saja yang sudah diterima. Tanpa state yang persisten, unggahan yang putus di menit ke-90 tidak punya cara mengetahui dari mana harus dilanjutkan. Sesi yang melewati `UPLOAD_SESSION_TTL_HOURS` dibersihkan penjadwal beserta berkas spool-nya — termasuk baris dataset yang belum pernah diproses (masih `uploaded` tanpa satu pun pekerjaan), cangkang yang tersisa dari unggahan yang ditinggalkan.

Baris dataset dan sesinya lahir bersama dalam satu transaksi saat unggahan dimulai; berkas dirakit dari potongan yang boleh tiba tak berurutan, masing-masing ditulis pada offset `indeks × ukuran_potongan`. Pemeriksaan duplikasi §2.5 ditegakkan pada langkah penyelesaian unggahan — setelah seluruh potongan diterima dan sidik jari dihitung — dan jalur "unggah sebagai versi baru" adalah parameter eksplisit pada langkah itu, bukan sesi terpisah.

Pemotongan ini wajib untuk raster 20 GB dan video 6 GB: satu request HTTP tunggal sebesar itu akan gugur oleh timeout, dan satu gangguan jaringan di menit ke-90 berarti mengulang seluruhnya.

Dari API ke MinIO tidak diperlukan pemotongan tambahan — keduanya berada dalam jaringan yang sama.

### 4.2 Pemeriksaan Keamanan Pra-Ingest

Sistem **tidak** menjalankan validasi kualitas data yang menyeluruh. Berkas yang bermasalah dibiarkan gagal pada tahap konversi, dan pesan errornya diteruskan apa adanya.

Namun empat pemeriksaan berikut **tetap dijalankan sebelum pemrosesan**, karena ketiadaannya tidak menghasilkan pesan error melainkan kerusakan:

| Pemeriksaan | Alasan |
|---|---|
| Ekstensi dan ukuran berkas | Pemeriksaan sepersekian detik yang mencegah pemrosesan sia-sia berjam-jam |
| **Zip bomb** — rasio kompresi, total ukuran terekstrak, jumlah entri | GDAL membuka arsip secara on-demand; arsip berasio 200:1 akan menghabiskan disk atau memori **selama** konversi, bukan menghasilkan error |
| **Path traversal** pada nama entri | Nama entri yang absolut atau mengandung `..` berbahaya begitu ada ekstraksi ke disk |
| **Tepat satu `.shp`** beserta `.shx`, `.dbf`, `.prj` | Menegakkan aturan satu berkas satu layer. Tanpa ini, ZIP berisi dua shapefile akan terimpor dua-duanya secara diam-diam |

Seluruhnya berupa pemeriksaan arsip yang murah, bukan inspeksi isi data.

### 4.3 Pipeline Raster

```
spool/<dataset_id>.tif
   │
   ├─ 1. gdalinfo         → baca CRS, jumlah band, extent
   ├─ 2. gdalwarp         → reproyeksi ke EPSG:4326 bila perlu
   ├─ 3. gdal_translate   → konversi ke COG
   │        -of COG -co COMPRESS=DEFLATE -co OVERVIEWS=AUTO
   ├─ 4. DEM: hitung elevasi min/max, tetapkan colormap
   ├─ 5. unggah ke MinIO  → tahura-cog/<dataset_id>/<nama>.tif
   ├─ 6. catat di app.raster_layers
   ├─ 7. bersihkan spool  (setelah unggahan MinIO terkonfirmasi)
   └─ 8. publikasi ke GeoServer                          → lihat §6
```

**Berkas asli tidak diarsipkan.** Setelah konversi berhasil dan unggahannya terkonfirmasi, **COG menjadi berkas rujukan dataset seterusnya** dan GeoTIFF aslinya dihapus bersama isi spool. Menyimpan keduanya berarti satu raster 20 GB menghabiskan sekitar 45 GB permanen, sementara COG memuat seluruh isi data aslinya — yang berbeda hanya tata letak internal dan kehadiran overview.

> **Overview bersifat wajib, bukan optimasi.** COG tanpa internal overview memaksa satu permintaan WMS pada zoom rendah menarik seluruh raster 20 GB melalui range request. Ini membuat layer raster praktis tidak dapat digunakan.

**Kapasitas spool.** Satu berkas 20 GB ditambah keluaran COG-nya membutuhkan ruang sekitar 45 GB. Dua pekerjaan bersamaan membutuhkan dua kali lipat. Spool harus disiapkan dengan kelonggaran yang memadai.

### 4.4 Pipeline Vektor

```
spool/<dataset_id>.zip
   │
   ├─ 1. periksa isi arsip                              → §4.2
   ├─ 2. buat nama layer acak 12 karakter, pastikan unik
   ├─ 3. catat di app.vector_layers  (publication_status = 'pending')
   ├─ 4. ogr2ogr → gis.<layer_name>
   ├─ 5. perbaikan geometri
   ├─ 6. baca metadata: tipe geometri, SRID sumber, skema atribut, bbox, jumlah fitur
   ├─ 6b. bila sesi unggah membawa media_kind: validasi layer media (di bawah)
   ├─ 7. arsipkan berkas sumber ke tahura-source/, bersihkan spool
   └─ 8. publikasi ke GeoServer                          → lihat §6
```

**Layer media dari unggahan.** `POST /uploads` untuk vektor boleh membawa `media_kind` (`image`, `image360`, `video`, `video360`), disimpan di `params` sesi. Setelah metadata terbaca, pipeline memeriksa dua syarat sebelum menetapkan `vector_layers.media_kind`: tipe geometri sesuai (`image*` → titik; `video*` → titik atau garis) dan tabel memuat kolom `media_ref` — kolom yang nilainya menjadi nama berkas media tiap fitur. Pelanggaran menggagalkan ingest dengan sebab yang tercatat di `latest_error`, bukan membiarkan layer "bermedia" yang tidak pernah bisa menerima berkas. Pencocokan berkas ke fitur dilakukan frontend setelah ingest (tab *Media* pada detail dataset): nama berkas — dengan atau tanpa ekstensi — dibandingkan dengan `media_ref`, lalu tiap berkas diunggah lewat jalur media per fitur yang sudah ada (§3.2 `media_assets`). Layer `video`/`video360` bergeometri garis juga menerima `time_data {start_at, step_seconds}` pada sisip/ubah fitur, disimpan di `extra.time_data` dan dikembalikan `features` serta `feature-info`, untuk menggerakkan penanda posisi di peta seiring waktu putar video.

**Perintah `ogr2ogr`:**

```
ogr2ogr -f PostgreSQL "PG:...active_schema=gis" /vsizip/<zip> <layer> \
  -nln <layer_name> \
  -nlt PROMOTE_TO_MULTI -nlt CONVERT_TO_LINEAR \
  -t_srs EPSG:4326 \
  -dim XY \
  -lco GEOMETRY_NAME=geom -lco FID=id \
  -lco SPATIAL_INDEX=GIST -lco LAUNDER=YES -lco PRECISION=NO
```

Penjelasan pilihan yang tidak jelas dengan sendirinya:

| Opsi | Alasan |
|---|---|
| `-nlt PROMOTE_TO_MULTI` | Shapefile lazim mencampur Polygon dan MultiPolygon dalam satu berkas; tanpa ini impor gagal di tengah jalan |
| `-nlt CONVERT_TO_LINEAR` | Melinearkan geometri melengkung yang tidak didukung PostGIS |
| `-dim XY` | Membuang dimensi Z/M sehingga perbaikan geometri tidak berbenturan dengan typmod |
| `-lco PRECISION=NO` | Mencegah kegagalan akibat lebar field numerik pada tabel atribut shapefile |
| `-lco LAUNDER=YES` | Menormalkan nama kolom menjadi huruf kecil |

**Berkas sumber vektor diarsipkan — dan hanya vektor.** ZIP shapefile berukuran ratusan megabita murah disimpan, dan berguna ketika ingest perlu diulang dengan opsi `ogr2ogr` yang berbeda: kegagalan vektor kerap berasal dari pilihan konversi, bukan dari datanya, sehingga berkas asli menjadi bahan percobaan berikutnya. Raster dan pointcloud tidak diarsipkan karena hasil konversinya sudah menjadi rujukan dan ukurannya puluhan kali lipat — lihat §4.3 dan §4.5.

**`-skipfailures` tidak digunakan.** Kegagalan harus terlihat, bukan disembunyikan dengan kehilangan fitur secara diam-diam.

**Encoding.** Berkas `.cpg` dihormati bila ada. Bila tidak ada, gunakan UTF-8. Encoding yang keliru merusak teks berbahasa Indonesia tanpa menghasilkan error — inilah alasan CRS sumber dan contoh atribut wajib ditampilkan di halaman detail dataset.

**Perbaikan geometri.** Baris normal diperbaiki di tempat dengan `ST_MakeValid(geom, 'method=structure')`. Baris **berat** — melampaui ambang jumlah vertex atau jumlah bagian — dipecah lebih dulu dengan `ST_Subdivide`, karena `ST_MakeValid` bersifat super-linear terhadap keduanya dan akan menggantung pada geometri besar.

### 4.5 Pipeline Pointcloud

```
spool/<dataset_id>.laz
   │
   ├─ 1. baca metadata: jumlah titik, extent, CRS
   ├─ 2. PotreeConverter 2.x → metadata.json, hierarchy.bin, octree.bin
   ├─ 3. unggah ketiganya ke tahura-pointcloud/<dataset_id>/
   ├─ 4. catat di app.pointcloud_layers
   └─ 5. bersihkan spool
```

Seperti raster, **berkas LAZ asli tidak diarsipkan** — pointcloud tiles menjadi berkas rujukan dataset seterusnya.

**PotreeConverter versi 2.x bersifat wajib.** Versi 1.x menghasilkan puluhan ribu berkas kecil, yang berarti puluhan ribu permintaan unggah ke MinIO — proses yang memakan waktu berjam-jam. Versi 2.x menghasilkan tiga berkas.

Potree viewer membaca objek ini langsung dari browser, sehingga **CORS wajib diaktifkan** pada bucket tersebut.

---

## 5. Antrian Pekerjaan

### 5.1 Mekanisme

Antrian ingest menggunakan **PostgreSQL**, bukan broker terpisah.

```sql
UPDATE app.ingest_jobs
   SET status = 'processing', started_at = now(), attempts = attempts + 1,
       lease_until = now() + interval '5 minutes', worker_id = $1
 WHERE id = (
       SELECT id FROM app.ingest_jobs
        WHERE status = 'queued'
        ORDER BY created_at
          FOR UPDATE SKIP LOCKED
        LIMIT 1)
RETURNING *;
```

Alasan memilih PostgreSQL daripada broker terpisah:

- Status pekerjaan dan data bisnis berada dalam satu basis data, sehingga keduanya dapat diperbarui dalam satu transaksi — tidak ada risiko penulisan ganda yang tidak sinkron
- Riwayat pekerjaan tersimpan permanen dan dapat dikueri, bukan sekadar pesan yang hilang setelah dikonsumsi
- Satu komponen infrastruktur lebih sedikit untuk dioperasikan dan dicadangkan

Redis tetap digunakan untuk **fan-out notifikasi real-time** dan **antrian snapshot berfrekuensi tinggi**, yang sifat bebannya berbeda: banyak pesan kecil dan cepat, tanpa kebutuhan riwayat.

### 5.2 Lease, Bukan Deteksi Saat Startup

Pekerjaan yang sedang berjalan memegang **lease** yang diperpanjang berkala oleh worker yang mengerjakannya. Pekerjaan berstatus `processing` yang lease-nya kedaluwarsa dianggap yatim dan dikembalikan ke antrian.

Pendekatan alternatif — mengembalikan seluruh pekerjaan `processing` ke antrian saat worker start — **tidak boleh digunakan**. Pola itu hanya benar bila worker berjumlah tepat satu; begitu worker kedua ditambahkan, restart worker A akan merebut pekerjaan yang sedang dikerjakan worker B, dan keduanya akan menulis ke tabel yang sama.

### 5.3 Anggaran Waktu

Setiap pekerjaan konversi memiliki batas waktu:

```
anggaran = LOAD_TIMEOUT_BASE_SECONDS
         + LOAD_TIMEOUT_PER_MILLION_FEATURES × (jumlah_fitur / 1.000.000)
```

Melewati batas ini, proses anak dihentikan dan pekerjaan ditandai gagal.

> **Konsekuensi yang perlu disadari.** Karena tidak ada validasi kualitas pra-ingest, berkas bermasalah baru ketahuan setelah worker memprosesnya. Shapefile dengan indeks FID rusak akan menahan worker sampai anggaran waktu habis. Setel `LOAD_TIMEOUT_BASE_SECONDS` dengan sadar akan hal ini.

---

## 6. Publikasi ke GeoServer

### 6.1 Prinsip

Publikasi dilakukan **otomatis setelah ingest berhasil**, melalui GeoServer REST API.

**Publikasi ke GeoServer tidak berarti terbuka untuk publik.** Ia hanya berarti layer siap dirender. Kontrol akses sepenuhnya ditegakkan oleh proxy di §7, bukan oleh GeoServer.

### 6.2 Publikasi Dijalankan Setelah Commit

Publikasi ke GeoServer adalah efek samping yang **tidak dapat dibatalkan oleh transaksi basis data**. Karena itu ia tidak pernah dijalankan di dalam transaksi.

Urutannya: commit data terlebih dahulu, baru publikasikan.

Bila publikasi gagal, **pekerjaan ingest tetap dinyatakan berhasil** — datanya memang sudah aman di PostGIS atau MinIO. Yang ditandai gagal adalah `publication_status`, dan pekerjaan publikasi terpisah dapat diulang kemudian.

Menggabungkan keberhasilan publikasi ke dalam kriteria keberhasilan ingest berarti satu GeoServer yang sedang restart akan menggagalkan unggahan 20 GB yang sebenarnya sudah berhasil.

### 6.3 Vektor

Datastore PostGIS bersama, diarahkan ke schema `gis`, disiapkan sekali oleh bootstrap (§6.9). Setiap layer dipublikasikan sebagai featuretype di dalam datastore tersebut.

### 6.4 Raster — COG dibaca langsung dari MinIO

GeoServer membaca COG **langsung dari MinIO melalui S3**. Berkas hanya ada di satu tempat, dan tidak pernah disalin ke dalam GeoServer.

**Sudah dibuktikan.** Pengujian dijalankan dengan data survei Tahura yang sebenarnya — ortofoto RGBA dan DSM Float32, keduanya 15.000 × 14.000 piksel pada resolusi 5 cm. Seluruh rantai berfungsi: coveragestore terbuat, bbox terbaca dari MinIO, WMS GetMap mengembalikan gambar, dan render extent penuh hanya menarik ~1,3 MB dari 854 MB COG — bukti overview terpakai.

#### Empat ketentuan yang wajib tepat

Keempatnya saling menutupi kegagalan satu sama lain; salah satu meleset menghasilkan pesan galat yang menyesatkan.

| # | Ketentuan | Bila salah |
|---|---|---|
| 1 | Plugin berasal dari **repositori community**, bernama **`cog-s3`** | Unduhan 404; image dasar hanya punya pembaca format COG tanpa transport apa pun |
| 2 | Coveragestore bertipe **`GeoTIFF`**, bukan `COG` | `Could not find the raster plugin for format COG` |
| 3 | Kunci metadata **`CogSettings.Key`**, bukan `cogSettings` | Setelan diabaikan diam-diam, GeoServer jatuh ke range reader HTTP, lalu `Expected URL scheme 'http' or 'https' but was 's3'` |
| 4 | Variabel lingkungan berawalan **`IIO_`** | `No input stream for the provided source` — penyebab aslinya tertelan di `InvocationTargetException` yang dicatat tanpa nested cause |

#### Bentuk coveragestore

```xml
<coverageStore>
  <name>...</name>
  <type>GeoTIFF</type>
  <url>cog://s3://tahura-cog/&lt;dataset_id&gt;/&lt;nama&gt;.tif</url>
  <metadata>
    <entry key="CogSettings.Key">
      <cogSettings>
        <useCachingStream>false</useCachingStream>
        <rangeReaderSettings>S3</rangeReaderSettings>
      </cogSettings>
    </entry>
  </metadata>
</coverageStore>
```

Nilai `rangeReaderSettings` berasal dari enum dengan empat anggota: `HTTP`, `S3`, `GS`, `Azure`.

#### Kredensial

Kredensial dibaca imageio-ext dari variabel lingkungan berpola `IIO_<ALIAS>_AWS_<KUNCI>`. Untuk URL berskema `s3://` aliasnya `S3`:

```
IIO_S3_AWS_USER  IIO_S3_AWS_PASSWORD  IIO_S3_AWS_REGION
IIO_S3_AWS_ENDPOINT  IIO_S3_AWS_FORCE_PATH_STYLE
```

`IIO_S3_AWS_ENDPOINT` dan `IIO_S3_AWS_FORCE_PATH_STYLE=true` adalah yang membuat MinIO berfungsi sebagai pengganti S3 sungguhan.

**Presigned URL tidak dapat digunakan di sini.** Konfigurasi coveragestore bersifat persisten sementara presigned URL kedaluwarsa — layer akan mati dengan sendirinya setelah masa berlakunya habis. GeoServer memerlukan kredensial statis.

#### Image GeoServer dibangun sendiri

Plugin `cog-s3` adalah modul community, dan mekanisme `INSTALL_EXTENSIONS` bawaan image resmi tidak memadai untuknya. Karena itu image dibangun dari `app-requirement/geoserver/Dockerfile`, yang mengunduh plugin **saat build** lalu memasangnya.

Satu langkah di dalamnya menuntut perhatian: **jar `imageio-ext-cog-commons` bawaan image dihapus** sebelum versi dari plugin dipasang. Installer bawaan tidak melakukannya, sehingga dua versi jar yang sama akan hidup berdampingan di classpath. Dockerfile itu menutup celahnya dengan penjaga saat build yang menuntut **tepat satu** jar tersebut — bila versi bawaan image berubah kelak, build gagal seketika alih-alih menghasilkan classpath ganda yang baru ketahuan sebagai galat membingungkan di produksi.

### 6.5 Simbologi Baku

Named style dibuat di GeoServer saat bootstrap:

```
vektor : tahura_point    tahura_line    tahura_polygon
raster : tahura_dem    tahura_dem_viridis    tahura_dem_gray    tahura_hillshade
```

Untuk vektor, style ditetapkan saat publikasi berdasarkan tipe geometri layer. Ketiga style vektor mewarnai **tiap fitur berbeda** dari satu palet kategorikal design system (12 warna token Carbon: purple-70, cyan-50, teal-70, magenta-70, red-50, green-60, blue-80, magenta-50, yellow-50, teal-50, purple-50, orange-60). Kuncinya deterministik, bukan acak sungguhan: `(id × 7) − 12 × floor((id × 7) / 12)` — modulus 12 dari `id` yang dikalikan 7 (koprima dengan 12, sehingga fitur ber-`id` berurutan meloncat-loncat di palet) — lalu dipetakan lewat `Recode` ke kode warna. Kolom `id` tersedia di semua tabel `gis.*` (serial dari pipeline ingest). Warna yang sama untuk fitur yang sama di setiap render, legenda klien (`LegendPanel`) menampilkan strip palet alih-alih satu warna. Untuk raster, `tahura_dem` ditetapkan sebagai baku pada dataset bersubtipe **DEM** (dua ramp lainnya dipilih per permintaan lewat `styles=`, dan `tahura_hillshade` menjadi baku coverage hillshade pendampingnya — §6.6); ortofoto dan raster lainnya memakai render RGB apa adanya tanpa style.

Pola ini dipilih agar ketika simbologi sungguhan ditulis kelak, cukup mengganti **isi** style tersebut — seluruh layer yang sudah ada ikut berubah tanpa perlu dipublikasikan ulang. Bila kemudian diperlukan style per layer, kolom `style_name` sudah tersedia untuk menimpanya.

**Rencana simbologi kustom.** Pengguna kelak menyusun style melalui antarmuka saat membuat dataset di peta; pada saat penyimpanan, pilihannya diterjemahkan menjadi SLD lalu diterapkan ke layer bersangkutan. Kolom `style_name` dan `sld_body` di `app.vector_layers` sudah menyediakan tempatnya. Empat ketentuan mengikat pekerjaan itu:

- **Style baku bersama tetap berlaku.** `style_name` bernilai NULL berarti layer memakai style baku per tipe geometri; hanya layer yang sengaja di-style pengguna yang keluar dari kumpulan bersama, sehingga manfaat penggantian serentak di atas tidak hilang.
- **Perubahan style menuntut purge GeoWebCache** — kasus ketiga di luar perubahan fitur dan struktur field (§6.8). Tanpanya pengguna melihat rendering lama dan melaporkan style-nya tidak tersimpan.
- **Hanya berlaku untuk vektor.** Raster DEM tetap memakai `tahura_dem` bersama yang berparameter `env` (§6.6).
- **SLD hasil terjemahan divalidasi sebelum menggantikan yang lama.** GeoServer menolak SLD rusak dengan 400; layer harus tetap menunjuk style sebelumnya, bukan ditinggalkan menunjuk style yang gagal.

### 6.6 Styling DEM — Color Ramp Dinamis, Hillshade Praproses

Rencana awal menaruh `ColorMap` dan `ShadedRelief` dalam satu `RasterSymbolizer`. Itu **ditinggalkan** setelah terbukti `ShadedRelief` GeoServer selalu merender area NoData sebagai hitam pekat pada setiap tile yang memuat campuran data dan NoData — persis "black shades" di sekeliling footprint survei. Semua jalan keluar pada tingkat style diuji dan gagal: entri `ColorMapEntry` NoData ber-`opacity="0.0"` (dihormati ColorMap, diabaikan ShadedRelief), `VendorOption InputTransparentNoData` (hanya bekerja pada tile yang 100% NoData), `BrightnessOnly=true` (NoData tetap hitam, dan color ramp terbuang menjadi grayscale murni), dua `FeatureTypeStyle` dengan `composite: multiply` (dirender identik dengan satu symbolizer), dan transformasi Jiffle `dest = src == -9999 ? null : src;` (NaN pun digambar hitam).

Karena itu hillshade kini **dihitung sekali saat ingest**, bukan saat render:

- `gdaldem hillshade -compute_edges -s 111120 -z <DEM_RELIEF_FACTOR>` dijalankan atas COG 4326 (faktor `-s 111120` mengonversi derajat ke meter). Keluarannya Byte 1–255 dengan NoData 0, di-COG-kan dengan opsi yang sama, diunggah sebagai `<dataset_id>/hillshade.tif`, dan kuncinya dicatat di `app.raster_layers.hillshade_key` (migrasi 005).
- Publikasi DEM membuat **dua** coverage: `r<12-hex>` (elevasi, style baku ramp) dan `h<12-hex>` (hillshade, style `tahura_hillshade` — grayscale dengan NoData transparan). ColorMap murni menghormati entri NoData transparan dengan benar; hanya ShadedRelief yang cacat.
- Frontend menumpuk layer hillshade di atas layer warna dengan CSS `mix-blend-mode: multiply` pada kontainer tile-nya (`createHillshadeLayer` di `authTileLayer.js`): putih netral, bayangan menggelapkan, NoData transparan tidak menyentuh basemap.

Tiga hal yang tetap menentukan hasil:

- **Entri `quantity` untuk nilai NoData dengan `opacity="0.0"`** — ditambah entri penjaga transparan tepat di bawah `elev_min` agar nilai liar di antara NoData dan minimum tidak terinterpolasi menjadi gelap semi-transparan.
- **Titik henti color ramp diturunkan dari `elevation_min` dan `elevation_max`** yang dihitung saat ingest dan tersimpan di `app.raster_layers`. Tanpa itu, seluruh raster jatuh pada satu warna.
- **Faktor `-z` gdaldem sangat bergantung resolusi.** Nilai besar menghasilkan bayangan nyaris hitam pada DSM 5 cm; pada data uji Tahura, **3** yang layak pakai. Karena itu ia variabel konfigurasi (`DEM_RELIEF_FACTOR`), bukan angka tetap.

**Satu layer elevasi melayani banyak tampilan.** Tiga style ramp — `tahura_dem` (spectral, baku), `tahura_dem_viridis`, `tahura_dem_gray` — dibuat/diperbarui saat bootstrap (`ensure_style` melakukan upsert: PUT bila sudah ada) dan dipilih per permintaan dengan parameter `styles=`; halaman detail dataset menawarkan pilihan itu untuk raster bersubtipe DEM. GetCapabilities tetap mengumumkan satu layer elevasi.

#### Satu style melayani seluruh dataset DEM

Rentang elevasi berbeda-beda antar dataset, tetapi itu **tidak** menuntut satu style per dataset. Titik henti color ramp menerima ekspresi, dan nilainya dikirim per permintaan:

```xml
<ColorMapEntry color="#2b6b3f" quantity="${env('elev_min',0)}"/>
<ColorMapEntry color="#97b35a" quantity="${(env('elev_min',0)+env('elev_max',1000))/2}"/>
<ColorMapEntry color="#f2f2f2" quantity="${env('elev_max',1000)}"/>
```

```
GET .../wms?...&styles=tahura_dem&env=elev_min:779;elev_max:948
```

BFF menyisipkan `env=` dari `elevation_min` dan `elevation_max` milik dataset yang bersangkutan di `app.raster_layers`. Nilai baku di argumen kedua `env()` menjaga style tetap merender sesuatu bila parameter itu tidak terkirim.

Perhatikan bentuk penulisannya: ekspresi ditaruh di **atribut `quantity`** dengan sintaks `${...}`. Menuliskannya sebagai elemen anak `<ogc:Function>` **tidak berfungsi** — GeoServer menerima style-nya tanpa keluhan, lalu merender kanvas kosong.

Berkas style-nya ada di `app-requirement/geoserver/styles/` (`tahura_dem*.sld`, `tahura_hillshade.sld`) dan di-COPY ke image API/worker agar bootstrap dapat mengunggahnya.

Permintaan bermode `TILED=true` menghasilkan keluaran identik dengan non-tiled pada waktu yang sama, sehingga GeoWebCache (§6.7) tetap berlaku — untuk layer elevasi maupun layer hillshade-nya.

> **Catatan TiTiler.** TiTiler dulu ditolak karena tidak bisa menggabungkan colormap dan hillshade dalam satu permintaan. Temuan di atas membuat argumen itu tidak lagi menentukan — komposit dua layer di browser toh akhirnya dipakai — tetapi GeoServer tetap dipertahankan karena seluruh publikasi, otorisasi layer, dan cache sudah berdiri di atasnya.

### 6.7 Cache Tile

GeoWebCache diaktifkan di depan seluruh layer. Tanpanya, setiap permintaan WMS raster menjadi range request baru ke MinIO.

### 6.8 Penyuntingan dan Penghapusan

Penyuntingan berlangsung dalam **sesi**, mengikuti pola perangkat lunak GIS desktop: pengguna masuk ke mode sunting, melakukan sejumlah perubahan, lalu menyimpan sekaligus. Penyegaran GeoServer dilakukan **sekali per sesi simpan**, bukan per fitur.

**Satu sesi sunting per layer, ditegakkan kunci.** Masuk ke mode sunting mengambil baris di `app.layer_edit_locks`; primary key pada `dataset_id` membuat kunci kedua atas layer yang sama mustahil. Pengguna kedua menerima keterangan siapa yang sedang menyunting dan sejak kapan, bukan penolakan tanpa sebab.

```sql
INSERT INTO app.layer_edit_locks (dataset_id, user_sub, expires_at)
VALUES ($1, $2, now() + ($3 * interval '1 second'))
ON CONFLICT (dataset_id) DO UPDATE
   SET user_sub = EXCLUDED.user_sub, acquired_at = now(), expires_at = EXCLUDED.expires_at
 WHERE app.layer_edit_locks.expires_at < now()
    OR app.layer_edit_locks.user_sub = EXCLUDED.user_sub
RETURNING user_sub, acquired_at, expires_at;
```

Kunci **diperpanjang berkala selama sesi masih aktif** dan dilepas saat sesi disimpan atau dibatalkan — mekanisme yang sama dengan lease pekerjaan di §5.2, dan karena alasan yang sama: tab browser yang ditutup begitu saja tidak boleh mengunci sebuah layer selamanya.

Pendekatan alternatif — membiarkan keduanya menyunting lalu mendeteksi tabrakan saat penyimpanan — ditolak karena sifat sesi itu sendiri. Satu sesi dapat memuat puluhan perubahan yang dikerjakan selama berpuluh menit; memberi tahu penggunanya bahwa sebagian di antaranya bertabrakan, setelah pekerjaan selesai, berarti membuang pekerjaan itu. Kunci menghindarkan konflik alih-alih menyelesaikannya, dan itu memang perilaku yang sudah dikenal pengguna dari perangkat lunak GIS desktop.

`ABOUT-APPS.md` §2.8 menetapkan setiap Staff berwenang menyunting layer mana pun. Kunci ini **tidak mengubah wewenang itu** — ia hanya mengantre, bukan membatasi.

Jenis perubahan menentukan tindakan yang diperlukan:

| Perubahan | Tindakan |
|---|---|
| Fitur ditambah, disunting, atau dihapus | **Purge cache GeoWebCache saja** |
| Struktur field berubah | **Reload featuretype + purge cache** |

Pemisahan ini penting. Reload featuretype hanya diperlukan ketika struktur kolom berubah, karena GeoServer meng-cache skema. Isi yang berubah tidak memerlukannya. Bila keduanya dijalankan pada setiap perubahan fitur, satu sesi menggambar 50 titik menghasilkan 50 reload dan 50 purge — beban yang tidak perlu dan akan menghambat GeoServer.

Tanpa penyegaran sama sekali, peta menampilkan data lama dan pengguna melaporkan suntingannya hilang.

**Layer yang digambar di peta** dipublikasikan saat penyimpanan pertama, bukan saat layer dibuat — agar tidak ada layer kosong yang terpublikasi. Tabelnya sendiri sudah dibuat saat layer didefinisikan, lengkap dengan tipe geometri dan struktur atributnya.

**Penghapusan dataset** melintasi empat sistem dan dijalankan dalam dua tahap:

```
Tahap 1 (sinkron):  datasets.deleted_at = now()      → dataset hilang dari seluruh tampilan
Tahap 2 (job, dapat diulang):
    unpublish GeoServer → purge GeoWebCache
    → DROP TABLE gis.<layer_name>  /  hapus objek MinIO
    → hapus objek media menurut app.media_assets, lalu barisnya
    → hapus baris tabel detail
```

Bila salah satu langkah gagal, pekerjaan diulang. Sistem tidak pernah berada dalam keadaan setengah terhapus yang terlihat oleh pengguna.

**Tidak ada masa tenggang.** Dua tahap di atas semata mekanisme untuk menangani kegagalan sebagian lintas sistem, bukan jendela pembatalan — Tahap 2 dijalankan segera. Penghapusan bersifat final, dan dicatat di `app.activity_logs`. Pengaman utamanya berada di depan: penghapusan diblokir selama dataset masih dirujuk peta mana pun.

### 6.9 Bootstrap GeoServer

Lima hal harus ada di GeoServer sebelum satu pun dataset dapat dipublikasikan, dan **kelimanya tidak dapat disiapkan pada saat yang sama**:

| # | Langkah | Kapan |
|---|---|---|
| 1 | Workspace `GEOSERVER_WORKSPACE` | **pra-kondisi** |
| 2 | Tiga named style vektor `GEOSERVER_STYLE_POINT / _LINE / _POLYGON` | **pra-kondisi** |
| 3 | Style raster `GEOSERVER_STYLE_DEM`, dari `app-requirement/geoserver/styles/tahura_dem.sld`, dengan `ReliefFactor` disubstitusi dari `DEM_RELIEF_FACTOR` | **pra-kondisi** |
| 4 | Datastore PostGIS → schema `gis` | menunggu API |
| 5 | Publikasi layer `gis.cctv_location` | menunggu API |

Tiga langkah pertama tidak bergantung pada apa pun selain GeoServer itu sendiri, sehingga diselesaikan devops sebelum API dipasang. Schema `gis` dan tabel `cctv_location` sendiri sudah ada lebih awal lagi — keduanya bagian dari baseline basis data yang diimpor pada langkah pertama urutan pemasangan (§11, §12.1). Langkah 4 dan 5 tetap menjadi tugas bootstrap API bukan karena terhalang secara teknis, melainkan karena hasil keduanya harus dicatat kembali ke katalog — `publication_status` pada baris semaian §3.3 — dan pencatatan itu milik API, bukan skrip devops.

**Seluruhnya idempoten.** Bootstrap di dalam API tetap menjalankan kelima langkah, memeriksa keberadaan masing-masing lebih dulu dan melewati yang sudah ada. Dengan begitu urutan pemasangan tidak mengikat: bila devops sudah menyiapkan tiga yang pertama, API melewatinya; bila belum, API mengerjakannya sendiri. GeoServer yang dipasang ulang pulih tanpa langkah manual dalam kedua kasus.

**Dijaga advisory lock.** Seluruh rangkaian berjalan di dalam `pg_advisory_lock` bernomor tetap:

```sql
SELECT pg_try_advisory_lock($1);   -- $1 = nomor tetap milik bootstrap GeoServer
```

Tanpa kunci ini, dua replika API yang menyala bersamaan akan menjalankan rangkaian yang sama dan berlomba membuat objek yang sama — GeoServer merespons sebagian dengan galat dan sebagian lagi dengan konfigurasi setengah jadi. Replika yang gagal memperoleh kunci melanjutkan startup tanpa menjalankan bootstrap, karena replika lain sedang mengerjakannya.

**Kegagalan bootstrap tidak menggagalkan startup API.** GeoServer yang belum siap saat API menyala adalah keadaan yang lazim pada `docker compose up`; API tetap melayani seluruh endpoint yang tidak bergantung padanya, dan pekerjaan publikasi yang tertunda diulang oleh penjadwal (§12.4) — mekanisme yang sudah ada untuk publikasi gagal di §6.2.

---

## 7. Kontrol Akses

### 7.1 Rantai Autentikasi

Keycloak dengan **satu realm** (`KEYCLOAK_REALM`) berisi dua client: `tahura-backend` dan `tahura-frontend`. Access token berumur 15 menit, refresh token 7 hari, dengan silent refresh selama pengguna aktif dan global logout melalui back-channel. Token terikat pada realm penerbitnya — dua realm terpisah akan memutus rantai validasi di bawah, karena token hasil login di realm satu tidak akan pernah lolos verifikasi terhadap realm lainnya.

#### Provisioning realm

Realm lahir dari **realm import** di `app-requirement/keycloak/` — dua template JSON (`tahura-realm.json` untuk struktur, `tahura-users-0.json` untuk user awal) yang dirender entrypoint dari variabel `.env` lalu diimpor otomatis saat start. Impor hanya terjadi bila realm belum ada; container-nya stateless dan seluruh state realm hidup di basis data `keycloak` yang disiapkan baseline §11, sehingga pemasangan ulang container tidak menyentuh realm yang sudah berjalan.

Isi impor: empat peran realm dari `ROLE_*`, kedua client (frontend public + PKCE S256, backend confidential), dan *group membership mapper* yang terpasang langsung pada **kedua client** — klaim `groups` hadir di token siapa pun client peminta-nya, menutup mode kegagalan senyap yang diperingatkan §7.3. Diverifikasi dengan token contoh: `realm_access.roles`, `groups`, `preferred_username`, dan `email` seluruhnya hadir.

> **Jebakan impor yang sudah dipijak.** Berkas realm **tidak boleh memuat array `clientScopes`**. Impor full realm memperlakukan array itu sebagai daftar scope *lengkap* — scope bawaan (`roles`, `profile`, `email`, `web-origins`, …) tidak dibuat, dan rujukan client kepadanya gugur diam-diam. Akibatnya token kehilangan `realm_access.roles` tanpa satu pun galat, dan seluruh otorisasi §7.3 mati senyap. Karena itulah mapper grup dipasang sebagai `protocolMappers` di masing-masing client, bukan lewat client scope kustom.

**Tema login `tahura`** (`app-requirement/keycloak/themes/tahura/login/`, induk `keycloak.v2`) memberi halaman login, lupa sandi, dan ganti sandi tampilan yang sama dengan frontend: tata letak dua panel bermerek, token warna dan tipografi Carbon yang identik, IBM Plex di-bundle sebagai woff2, pesan `id`/`en`/`su`, dan palet terang/gelap yang sama. Pilihan tema pengguna ikut menyeberang ke Keycloak lewat parameter `tg_theme` pada URL otorisasi (parameter asing diabaikan OIDC); `template.ftl` menyalinnya ke cookie `tg_theme` pada domain Keycloak dan memasang `data-theme` pada `<html>` sebelum render, sehingga halaman lanjutan yang tidak lagi membawa parameter (login gagal, ganti bahasa, lupa sandi) tetap konsisten. Dipasang `COPY themes/` di Dockerfile dan `loginTheme` + `supportedLocales` pada realm template — frontend sendiri tidak memuat form sandi sama sekali; halaman pembukanya hanya tombol *Masuk* yang mengalihkan ke Keycloak (PKCE). Keycloak men-cache tema dalam mode produksi, sehingga perubahan CSS/FTL menuntut image dibangun ulang; pada realm yang sudah terlanjur diimpor, tema dipilih lewat admin console (Realm settings → Themes → Login theme) atau `kcadm update realms/<realm> -s loginTheme=tahura`.

Dua identitas administratif yang sengaja dipisah:

| Identitas | Ruang lingkup | Pemegang |
|---|---|---|
| `KEYCLOAK_ADMIN` | admin master seluruh instance Keycloak | devops |
| `BOOTSTRAP_SYSADMIN_USERNAME` | user realm berperan sysadmin + hak `realm-management` (`view-users`, `manage-users`) | pengelola aplikasi |

User bootstrap inilah yang menetapkan peran pengguna aplikasi ke depannya — dari admin console realm `tahura` saja, tanpa memegang admin master. Password awalnya bersifat sementara: Keycloak memaksa penggantian pada login pertama (`UPDATE_PASSWORD`).

Identitas diverifikasi **dua kali, di dua lapis**:

```
Browser ──token pengguna──▶ BFF ──token pengguna + kredensial layanan──▶ API
                             │                                            │
                    verifikasi JWT                            verifikasi JWT ulang
                    penyaringan awal                          otorisasi otoritatif
```

BFF memverifikasi token dan menolak permintaan yang jelas tidak berhak. API **memverifikasi ulang token yang sama** dan menegakkan seluruh aturan hak akses secara otoritatif.

Verifikasi ganda ini disengaja: API tidak boleh mempercayai klaim identitas dari BFF begitu saja. Bila suatu saat BFF disusupi atau muncul jalur lain menuju API, model kontrol akses tidak boleh runtuh karenanya. **BFF melindungi dari paparan, bukan menggantikan otorisasi.**

Kredensial layanan yang dipakai BFF untuk memanggil API terpisah dari identitas pengguna dan tidak pernah dikirim ke browser.

**Alur di sisi BFF.** Login berlangsung langsung antara browser dan Keycloak (client `tahura-frontend`, public + PKCE); BFF tidak ikut dalam alur OIDC dan tidak memegang sesi cookie — setiap permintaan membawa access token sebagai Bearer, dan BFF bersifat stateless terhadap identitas. Tiga endpoint autentikasinya:

| Endpoint | Peran |
|---|---|
| `GET /auth/me` | Memverifikasi token, lalu meminta API memastikan identitas (`/internal/whoami`) — peran dan grup yang dikembalikan adalah hasil verifikasi API, bukan pembacaan BFF sendiri |
| `POST /auth/logout` | Logout eksplisit: `sid` token diteruskan ke `POST /internal/sessions/revoke` API sebelum frontend mengarahkan browser ke `end_session` Keycloak — seluruh tab yang memakai sesi itu tertolak seketika (F05) |
| `POST /auth/backchannel-logout` | Dipanggil Keycloak (form `logout_token`) ketika sesi berakhir dari sisi mana pun. Logout token diverifikasi penuh — tanda tangan JWKS, issuer, audience client, klaim `events` back-channel, tanpa `nonce`, ber-`sid` — lalu `sid` dicabut lewat jalur yang sama |

URL back-channel (`BFF_INTERNAL_URL/auth/backchannel-logout`) terpasang pada kedua client sejak realm import; Keycloak menjangkaunya lewat jaringan Docker internal. Perpanjangan sesi selama pengguna aktif sepenuhnya urusan frontend dan Keycloak (silent refresh); BFF hanya menjawab 401 bersebab ketika token kedaluwarsa agar frontend tahu harus menyegarkannya.

### 7.2 Proxy Layanan Peta

Seluruh permintaan layanan peta melewati BFF.

```
Browser → /gs/wms?LAYERS=<layer_name>&...
             │
             ▼
           BFF ── verifikasi token (atau anonim, untuk peta yang dipublikasikan)
             │
             ├─ periksa hak akses layer ke API          → §7.3
             ├─ tolak 403 bila tidak berhak
             └─ teruskan ke GeoServer internal
```

Hasil pemeriksaan hak akses di-cache singkat di BFF — dalam hitungan puluhan detik — agar satu tampilan peta yang memuat ratusan permintaan tile tidak menghasilkan ratusan pemeriksaan berulang. Kunci cache adalah pasangan (subjek, layer); subjek diturunkan dari sidik jari token pengguna, sidik jari API key, atau "anonim" — sehingga token baru pasca-refresh otomatis memulai entri baru, dan pencabutan akses berlaku paling lambat `LAYER_ACCESS_CACHE_SECONDS` kemudian.

Proxy yang sama berlaku untuk seluruh operasi WMS lainnya, termasuk `GetLegendGraphic`, serta WFS dan WMTS (GeoWebCache). Empat ketentuan pelaksanaannya:

- **Hanya jalur layanan OGC yang diteruskan**: `wms`, `wfs`, `ows` (boleh berawalan workspace), `gwc/service/wmts`, `gwc/service/wms`, dan `gwc/service/wmts/rest/<layer>/…`. REST API, antarmuka web, dan jalur GeoServer lainnya tidak pernah mencapai GeoServer — dijawab 404 di BFF. Hanya metode `GET` yang dilayani; WFS-T tidak pernah tersedia (datastore pun dibuka sebagai `geoserver_ro`).
- **Setiap permintaan harus menyebut layer** melalui `LAYERS`, `LAYER`, `QUERY_LAYERS`, `TYPENAME`, atau `TYPENAMES` (atau segmen jalur WMTS REST). Seluruh layer yang disebut harus berhak; satu saja yang tidak, seluruh permintaan ditolak 403. Permintaan tanpa layer — misalnya `DescribeFeatureType` tanpa `TYPENAME`, yang akan memuat seluruh skema — ditolak 400.
- **`GetCapabilities` disaring, bukan diblokir.** QGIS dan ArcGIS memulai koneksi WMS/WFS/WMTS dengan `GetCapabilities`, sehingga memblokirnya mematikan jalur F11. BFF mengambil dokumen lengkap dari GeoServer, lalu membuang setiap elemen `Layer`/`FeatureType` bernama yang tidak berhak dirender penerima — memakai pemeriksaan §7.3 yang sama, lewat cache yang sama. Pengunjung anonim melihat hanya layer milik peta yang dipublikasikan; pemegang API key melihat layer peta yang dihibahkan padanya; Staff melihat semuanya. Kebocoran daftar layer yang diperingatkan §1.2 karenanya tertutup tanpa mengorbankan konsumen GIS eksternal.
- **Alamat internal ditulis ulang.** Elemen `OnlineResource` di dokumen capabilities menunjuk ke `GEOSERVER_PROXY_TARGET`; BFF menggantinya dengan `BFF_PUBLIC_URL/gs` agar klien GIS mengikuti URL yang benar-benar dapat ia jangkau. Ini satu-satunya penyuntingan isi respons GeoServer; tile, gambar, dan GML/GeoJSON diteruskan apa adanya secara streaming.

Token pengguna dan API key **tidak pernah diteruskan ke GeoServer** — hanya header `Accept` dan header caching kondisional yang ikut.

### 7.3 Resolusi Hak Akses Layer

Permintaan WMS menyebut **layer**, sementara hibah akses diberikan pada **peta**. Resolusinya melalui `map_layers`:

> Pengguna berhak merender sebuah layer bila terdapat **setidaknya satu** peta yang memuat layer tersebut dan dapat ia akses.

```sql
SELECT EXISTS (
  SELECT 1
    FROM app.map_layers ml
    JOIN app.maps m ON m.id = ml.map_id
    LEFT JOIN app.vector_layers vl ON vl.dataset_id = ml.dataset_id
    LEFT JOIN app.raster_layers rl ON rl.dataset_id = ml.dataset_id
   WHERE ( vl.layer_name = $1                              -- layer vektor
           OR ( rl.dataset_id IS NOT NULL                  -- coverage raster r<hex12>, §6.4
                AND 'r' || left(replace(ml.dataset_id::text, '-', ''), 12) = $1 )
           OR ( rl.hillshade_key IS NOT NULL
                AND 'h' || left(replace(ml.dataset_id::text, '-', ''), 12) = $1 ) )
     AND ( m.is_published                                  -- publik, termasuk anonim
           OR $2 = ANY($3)                                 -- peran berhak penuh, dari ROLE_*
           OR EXISTS (SELECT 1 FROM app.map_access ma
                       WHERE ma.map_id = m.id
                         AND ( (ma.subject_type='user'  AND ma.subject_id = $4)
                            OR (ma.subject_type='group' AND ma.subject_id = ANY($5)) ))
           OR EXISTS (SELECT 1 FROM app.api_key_maps akm   -- konsumen eksternal, §7.8
                       WHERE akm.map_id = m.id
                         AND akm.api_key_id = $6) )
);
```

Daftar peran berhak penuh (`$3`) dibaca dari `ROLE_SYSADMIN` dan `ROLE_STAFF`, **tidak di-hardcode** — nama peran di realm Keycloak dapat berbeda antar lingkungan, dan §12.3 melarang nilai konfigurasi tertanam di tempat pemakaiannya.

Satu kueri menyelesaikan kedua jenis layer yang dikenal GeoServer: layer vektor lewat `vector_layers.layer_name`, dan coverage raster lewat identitasnya `r<12 hex pertama dataset_id>` (§6.4) yang dihitung langsung dari `map_layers.dataset_id` — tanpa bergantung pada kolom `coveragestore` yang baru terisi setelah publikasi. Kueri versi awal hanya mengenal vektor, sehingga seluruh permintaan WMS raster lewat proxy tertolak; celah itu baru tampak ketika proxy BFF dibangun (Tahap 2).

Aturan yang sama memberi akses anonim ke layer milik peta yang dipublikasikan, sehingga penyematan iframe berfungsi tanpa ketentuan tambahan.

**Identitas pengguna (`$4`) adalah himpunan, bukan satu nilai:** `[sub, preferred_username]`, dicocokkan dengan `ma.subject_id = ANY($4)` (`security/access.py`, `user_identities`). Pemberi hibah mengetik username di antarmuka — UUID `sub` tidak bermakna dan tidak tersedia baginya — sementara baris hibah lama yang menyimpan `sub` tetap berlaku. Pencabutan hibah bertipe grup memakai `POST /maps/{id}/access/revoke` dengan body, karena nama grup Keycloak berawalan `/` dan tidak aman sebagai segmen path.

**Keanggotaan grup (`$5`) harus tersedia sebagai klaim di dalam token.** Ini menuntut *group membership mapper* dikonfigurasi pada client `tahura-backend` di Keycloak; tanpanya seluruh hibah bertipe `group` tidak pernah cocok, dan kegagalannya senyap — akses ditolak tanpa pesan yang menunjuk sebabnya.

#### Layer lokasi CCTV dikecualikan

Aturan di atas berbunyi "berhak merender bila terdapat setidaknya satu peta terakses yang memuat layer tersebut". Karena seluruh titik kamera kini berada dalam **satu layer sistem tunggal** (§3.3), satu peta yang dipublikasikan sudah cukup membuat **seluruh** lokasi kamera di kawasan terlihat oleh siapa pun.

Karena itu layer lokasi CCTV **tidak pernah melewati jalur di atas**. Ia hanya dirender bagi pemegang peran System Administrator, Staff, atau Security, terlepas dari peta mana yang memuatnya dan apakah peta itu dipublikasikan:

```sql
SELECT $2 = ANY($7);   -- $7 = ROLE_SYSADMIN, ROLE_STAFF, ROLE_SECURITY
```

Peta publik yang memuat layer ini tetap dapat dipublikasikan — pengunjung anonim menerima peta yang sama tanpa titik kameranya. Pengecualian ini mengikuti preseden yang sudah ada di §7.7: live stream CCTV pun sepenuhnya ditentukan peran, tidak pernah oleh hibah akses peta. Hibah API key (§7.8) juga tidak berlaku untuknya.

#### Raster dan pointcloud — resolusi pada tingkat dataset

Kueri di atas menyelesaikan hak akses layer **vektor**, yang dikenali GeoServer melalui `layer_name`. Sebagian permintaan lain menyebut `dataset_id` — penerbitan presigned URL multimedia dan pointcloud tiles — sehingga resolusinya memakai bentuk yang setara tanpa singgahan ke `vector_layers`:

```sql
SELECT EXISTS (
  SELECT 1
    FROM app.map_layers ml
    JOIN app.maps m ON m.id = ml.map_id
   WHERE ml.dataset_id = $1
     AND ( m.is_published
           OR $2 = ANY($3)
           OR EXISTS (SELECT 1 FROM app.map_access ma
                       WHERE ma.map_id = m.id
                         AND ( (ma.subject_type='user'  AND ma.subject_id = $4)
                            OR (ma.subject_type='group' AND ma.subject_id = ANY($5)) ))
           OR EXISTS (SELECT 1 FROM app.api_key_maps akm
                       WHERE akm.map_id = m.id
                         AND akm.api_key_id = $6) )
);
```

Bentuk ini juga yang dipakai untuk pointcloud tiles dan untuk penerbitan presigned URL konten multimedia, karena keduanya pun beroperasi pada satuan dataset.

#### Jalan pintas peran pengelola

Kedua kueri di atas mensyaratkan dataset terpasang pada minimal satu peta (`JOIN app.map_layers`). Halaman detail dataset menampilkan pratinjau WMS untuk dataset yang baru selesai di-ingest dan belum dipakai peta mana pun, sehingga syarat itu membuat pratinjau selalu 403. Karena itu `can_render_layer` dan `can_access_dataset` memberikan jalan pintas: pemegang peran System Administrator atau Staff cukup diperiksa terhadap keberadaan layer/dataset-nya (`LAYER_EXISTS_SQL` / `DATASET_EXISTS_SQL`, dengan `deleted_at IS NULL`), tanpa melihat keanggotaan peta. Peran lain dan API key tetap melalui kueri keanggotaan peta di atas; layer lokasi CCTV tetap pada aturan khususnya sendiri.

### 7.4 Atribut Fitur — Bukan melalui GeoServer

WMS mengembalikan gambar. Untuk menampilkan atribut saat fitur diklik, API menyediakan endpoint tersendiri yang membaca PostGIS langsung.

**Operasi `GetFeatureInfo` dan `WFS GetFeature` tidak digunakan untuk keperluan ini**, dengan tiga alasan: API dapat menyaring kolom sensitif, dapat menyisipkan presigned URL untuk konten multimedia, dan dapat menerapkan pembatasan berbasis peran pada tingkat kolom.

### 7.5 Legenda

Legenda layer diperoleh dari operasi `GetLegendGraphic` GeoServer melalui proxy yang sama. Legenda mengikuti style yang ditetapkan, sehingga tidak memerlukan pekerjaan tambahan ketika simbologi kustom diterapkan kelak.

### 7.6 Kepemilikan Bukan Kontrol Akses

Kolom `owner_sub` pada `app.datasets` dan `app.maps` bersifat **keterangan, bukan pembatas wewenang**. Tidak ada pemeriksaan otorisasi yang membandingkannya dengan identitas pemanggil.

Peran Staff dan System Administrator dapat menyunting serta menghapus dataset dan peta mana pun, termasuk milik pengguna lain. Akuntabilitas ditegakkan melalui `app.activity_logs`, bukan melalui penguncian — alasannya di `ABOUT-APPS.md` §2.8.

Satu pengecualian ditegakkan di lapis data: **tabel `app.cctv_credentials` hanya dapat ditulis oleh peran System Administrator.** Staff tetap berwenang penuh atas tabel lokasi CCTV di schema `gis`, termasuk membuat, memindahkan, dan menghapus titiknya. Pemisahan dua tabel yang sudah ada membuat pembatasan ini cukup ditegakkan pada satu titik, bukan tersebar di banyak pemeriksaan kolom.

### 7.7 Live Stream CCTV

Stream video tidak dapat diproksikan melalui BFF tanpa memboroskan sumber daya secara signifikan. Karena itu MediaMTX dijangkau langsung oleh browser, namun **tidak pernah tanpa otorisasi**.

```
Browser minta stream kamera X
   → BFF verifikasi peran (System Administrator / Staff / Security)
   → BFF terbitkan token stream berjangka pendek untuk kamera X
   → Browser buka stream HLS di MediaMTX dengan token tersebut
   → MediaMTX memvalidasi token melalui auth hook ke BFF
```

Token bersifat spesifik per kamera dan berumur pendek. Tanpa mekanisme ini, siapa pun yang mengetahui URL stream dapat menontonnya, dan pembatasan peran pada live stream CCTV menjadi tidak berarti.

Pelaksanaannya di BFF (`POST /streams/{camera_id}/token`): BFF menyaring peran lebih dulu, lalu membaca kamera dari API dengan token pengguna yang sama — sehingga API tetap menegakkan peran secara otoritatif (§7.1) dan hanya kamera aktif berpath stream yang diberi token. Token adalah JWT HS256 yang ditandatangani `BFF_SESSION_SECRET`, memuat `path` stream dan `exp` = sekarang + `STREAM_TOKEN_TTL_SECONDS`; tidak ada state di server, sehingga beberapa replika BFF memvalidasinya tanpa berbagi apa pun selain rahasia. Respons menyertakan `hls_url` (`PUBLIC_MEDIAMTX_URL/<path>/index.m3u8`); pemutar HLS mengirim token sebagai `Authorization: Bearer` (hls.js lewat `xhrSetup`), atau sebagai query `?token=` untuk pemutar yang tidak dapat menyetel header (HLS native Safari) — MediaMTX meneruskan query itu ke hook dan ke URL segmen di dalam playlist (teruji pada 1.15.0).

MediaMTX dijalankan dengan `authMethod: http` dan `authHTTPAddress` = `MEDIAMTX_AUTH_HOOK_URL` (`POST /internal/stream-auth` di BFF). Hook menerima JSON berisi `action`, `path`, `token`/`password`, `query`, dan `protocol`; ia hanya meloloskan aksi `read`/`playback` yang membawa token sah **untuk path yang sama** — token kamera A tidak membuka kamera B. Token dicari berurutan di field `token`, `password`, lalu query (`token`, `jwt`, `pass`), mengikuti cara MediaMTX menyalurkan kredensial dari berbagai protokol. Aksi `api`, `metrics`, `pprof`, dan `publish` dikecualikan dari hook (`authHTTPExclude`): keempatnya hanya terjangkau dari jaringan Docker internal — API mengelola path lewat port 9997, dan port RTSP 8554 memang tidak pernah dipetakan ke host, sehingga tidak ada yang dapat menerbitkan stream dari luar. Satu-satunya port MediaMTX yang dipetakan ke host adalah HLS (`127.0.0.1:${MEDIAMTX_HLS_PORT}`), untuk diproksikan Nginx sebagai `PUBLIC_MEDIAMTX_URL`. WebRTC tidak diekspos: ia menuntut port UDP ICE di luar jangkauan reverse proxy HTTPS, sementara HLS sudah memenuhi kebutuhan tampilan grid dan panel peta.

Kegagalan bersifat *fail-closed*: bila BFF mati, MediaMTX tidak dapat memvalidasi token dan menolak seluruh playback. Endpoint hook sendiri tidak memuat rahasia dan hanya menjawab sah/tidak, sehingga terekspos pun tidak membahayakan; tetap, Nginx sebaiknya menutup awalan `/internal/` dari luar.

Kredensial RTSP kamera **tidak pernah** meninggalkan jaringan internal: hanya API yang mendekripsinya, dan hanya untuk dikirim ke MediaMTX saat path stream dibuat.

### 7.8 API Key — Konsumen Eksternal

Layer milik peta yang dipublikasikan sudah dapat diakses **anonim** melalui proxy BFF (§7.3), sehingga QGIS dan ArcGIS dapat membukanya tanpa kredensial apa pun. API key karenanya tidak diperlukan untuk data publik — **kegunaannya semata memberi konsumen eksternal akses ke peta yang tidak dipublikasikan.**

```
QGIS / sistem lain → /gs/wms?LAYERS=<layer_name>&...
                        header: X-API-Key: <kunci>
                          │
                          ▼
                        BFF ── cari key_hash di app.api_keys, pastikan is_active
                          │      perbarui last_used_at
                          ├─ resolusi §7.3 dengan api_key_id sebagai subject
                          └─ tolak 403 bila tidak ada hibah
```

Hibah diberikan **per peta** melalui `app.api_key_maps`, mengikuti satuan yang sama dengan hibah kepada pengguna dan grup — tidak ada hibah per-layer, konsisten dengan `ABOUT-APPS.md` §8.3.

Empat ketentuan yang membatasinya:

- **Kunci disimpan sebagai hash**, tidak pernah dalam bentuk asli. Nilai penuhnya hanya ditampilkan sekali saat dibuat.
- **API key tidak pernah memberi hak tulis.** Ia hanya membuka jalur baca layanan peta; seluruh operasi mutasi tetap menuntut token Keycloak.
- **API key tidak pernah membuka live stream CCTV**, sejalan dengan §7.7 yang menetapkan stream sepenuhnya ditentukan peran.
- **Pemakaian dicatat** melalui `last_used_at`, sehingga kunci yang menganggur dapat dikenali dan dinonaktifkan.

---

## 8. Penyajian Raster dalam Aplikasi

**Raster disajikan oleh GeoServer, sama seperti vektor.** Tidak ada layanan tile terpisah.

```
Browser → /gs/wms?LAYERS=<layer_name>&...
             │
             ▼
           BFF ── verifikasi token, periksa hak akses layer   → §7.2, §7.3
             │
             └─ teruskan ke GeoServer internal
```

Jalur ini identik dengan penyajian vektor, sehingga satu proxy, satu pemeriksaan hak akses, dan satu cache melayani keduanya.

**Browser tidak pernah menyentuh objek COG.** Raster selalu sampai sebagai gambar hasil render, bukan sebagai berkas — sehingga tidak ada presigned URL yang beredar untuk `tahura-cog/`, dan persoalan konsistensi hostname yang melekat pada pola presigned tidak berlaku di sini. GeoServer membacanya dengan kredensial statis di dalam jaringan Docker (§6.4).

Untuk raster DEM, color ramp dan hillshade diterapkan melalui style `tahura_dem`, dengan titik henti diturunkan dari `elevation_min` dan `elevation_max` di `app.raster_layers` — rinciannya di §6.6.

> **Layanan tile terpisah pernah direncanakan dan dibatalkan.** Rancangan sebelumnya menempatkan TiTiler untuk penyajian raster dalam aplikasi, dengan alasan lebih ringan daripada WMS untuk penjelajahan interaktif. Ia dibatalkan setelah terbukti GeoServer sanggup menyajikan color ramp dan hillshade sekaligus dari satu layer (§6.6) — sesuatu yang justru **tidak** dapat dilakukan TiTiler dalam satu permintaan. Menyingkirkannya menghapus satu container, satu service account, satu jalur proxy, dan satu jalur pemeriksaan hak akses, sementara GeoWebCache sudah menutup kebutuhan caching.

---

## 9. Kepadatan Pengunjung

### 9.1 Pengambilan Tangkapan Gambar

Kamera dapat dijangkau langsung oleh server melalui RTSP/RTMP, sehingga **tidak diperlukan aplikasi klien terpisah**.

Kamera yang ikut dalam rotasi adalah kamera aktif **yang sudah berkredensial**:

```sql
SELECT c.id, c.stream_path, cr.port, cr.username_enc, cr.password_enc, cr.rtsp_url_enc
  FROM app.cameras c
  JOIN app.cctv_credentials cr ON cr.camera_id = c.id
 WHERE c.is_active;
```

Kamera yang titiknya sudah ditandai Staff tetapi kredensialnya belum diisi System Administrator tidak akan terpilih — tanpa penanganan NULL di mana pun, karena ketiadaan barisnya di `cctv_credentials` sudah menjawabnya.

Worker snapshot menjalankan siklus berikut setiap **30 detik** untuk setiap kamera terpilih:

```
ffmpeg -rtsp_transport tcp -i <rtsp_url> -frames:v 1 -q:v 2 <keluaran>.jpg
   → unggah ke tahura-snapshot/<camera_id>/<tanggal>/<timestamp>.jpg
   → catat di app.crowd_records (count sementara NULL)
   → antrikan pekerjaan inferensi
```

Tangkapan gambar disimpan **sebelum** inferensi dijalankan. Dengan demikian ketidaktersediaan layanan inferensi tidak menyebabkan kehilangan data mentah.

### 9.2 Kontrak Endpoint Inferensi

Model deteksi berada **di luar lingkup sistem ini**. Sistem hanya mengenal sebuah endpoint HTTP.

**Permintaan**

```http
POST {INFERENCE_ENDPOINT}
Authorization: Bearer {INFERENCE_API_KEY}
Content-Type: multipart/form-data

image        : berkas JPEG
camera_id    : uuid
captured_at  : string ISO-8601 dengan offset zona waktu
```

**Respons berhasil — 200**

```json
{
  "count": 14,
  "model": "nama-dan-versi-model",
  "processed_at": "2026-08-16T10:30:12+07:00"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `count` | integer ≥ 0 | ya | Jumlah orang terdeteksi |
| `model` | string | tidak | Pengenal model, disimpan untuk penelusuran |
| `processed_at` | ISO-8601 | tidak | Waktu pemrosesan di sisi endpoint |

**Respons gagal**

| Kode | Perlakuan sistem |
|---|---|
| `4xx` | Pekerjaan ditandai gagal permanen; tidak diulang |
| `5xx`, timeout, atau tidak dapat dihubungi | Pekerjaan diulang dengan backoff; tangkapan gambar tetap tersimpan |

Sistem **tidak** menetapkan atau memeriksa model yang digunakan. Nilai `count` diterima apa adanya.

**Konfigurasi:** `INFERENCE_ENDPOINT`, `INFERENCE_API_KEY`, `INFERENCE_TIMEOUT_SECONDS`, `INFERENCE_MAX_RETRIES`.

### 9.3 Pembuatan Alert

Setelah `count` diterima, nilainya dibandingkan dengan `CROWD_THRESHOLD`.

**Satu kejadian menghasilkan satu alert.** Selama sebuah kamera masih memiliki alert berstatus `open`, deteksi berikutnya di atas ambang **memperbarui alert itu** — `peak_count` dinaikkan bila perlu dan `last_seen_at` disegarkan — tanpa membuat baris baru dan **tanpa mengirim notifikasi ulang**. Alert baru untuk kamera tersebut hanya lahir setelah yang lama ditandai `handled`.

```sql
INSERT INTO app.alerts (camera_id, crowd_record_id, count, peak_count, threshold)
VALUES ($1, $2, $3, $3, $4)
ON CONFLICT (camera_id) WHERE status = 'open'
DO UPDATE SET peak_count   = GREATEST(app.alerts.peak_count, EXCLUDED.count),
              last_seen_at = now()
RETURNING (xmax = 0) AS alert_baru;
```

Notifikasi — popup maupun WhatsApp — dikirim **hanya bila `alert_baru` bernilai true**.

Tanpa aturan ini, kerumunan yang bertahan sepuluh menit di atas ambang menghasilkan dua puluh baris alert dan dua puluh pesan WhatsApp untuk satu kejadian yang sama. Tabel log alert akan menjadi tidak terpakai dalam praktik, penerima notifikasi akan mematikan pemberitahuannya, dan kartu KPI "Alert Aktif" akan menghitung tangkapan gambar alih-alih kejadian. Indeks unik parsial pada `(camera_id) WHERE status = 'open'` menegakkan aturan ini **di lapis basis data**, sehingga tidak bergantung pada ketelitian kode pemanggil.

Nilai ambang yang tersimpan pada baris alert bersifat historis — mengubah konfigurasi tidak mengubah arti alert yang sudah terjadi.

**Inferensi yang gagal permanen memiliki keadaan terminal.** Respons `4xx` langsung menandai `inference_status = 'failed'`; respons `5xx` dan timeout menaikkan `inference_attempts` dan diulang sampai `INFERENCE_MAX_RETRIES`, setelah itu juga `failed`. Tanpa keadaan terminal ini, baris yang tidak pernah berhasil akan menumpuk selamanya di indeks parsial dan terus dipindai pekerjaan pengulangan. Baris `failed` tetap disimpan permanen beserta tangkapan gambarnya — yang hilang hanya angkanya, bukan buktinya.

### 9.4 Kontrak Endpoint Notifikasi

**Permintaan**

```http
POST {NOTIFICATION_ENDPOINT}
Authorization: Bearer {NOTIFICATION_API_KEY}
Content-Type: application/json

{
  "recipients": ["6281234567890", "6285555555555"],
  "message": "Peringatan kepadatan di Gerbang Utama: 32 orang terdeteksi pada 16 Agustus 2026 pukul 10.30 WIB.",
  "reference": "<alert_id>"
}
```

**Respons berhasil — 200**

```json
{ "accepted": 2, "failed": [] }
```

Sistem **tidak** mengelola sesi WhatsApp, tidak memindai QR code, dan tidak menyimpan status koneksi. Seluruhnya menjadi tanggung jawab operator endpoint.

Daftar `recipients` diambil dari `app.notification_recipients` yang aktif, dikelola System Administrator melalui aplikasi.

**Konfigurasi:** `NOTIFICATION_ENDPOINT`, `NOTIFICATION_API_KEY`, `NOTIFICATION_TIMEOUT_SECONDS`.

### 9.5 Pembersihan Snapshot

Pekerjaan terjadwal harian:

```
HAPUS objek MinIO pada tahura-snapshot/ yang berumur > SNAPSHOT_RETENTION_DAYS
   DAN tidak dirujuk oleh baris app.alerts mana pun
→ set crowd_records.snapshot_key = NULL untuk baris terkait
```

Baris `crowd_records` **tidak pernah dihapus**. Riwayat numerik dipertahankan permanen sebagai bahan analisis; hanya berkas gambarnya yang dibersihkan.

### 9.6 Agregasi Metrik Kepadatan

Definisi kedua kartu KPI kepadatan, dinyatakan sebagai kueri agar tidak ada ruang tafsir.

**Kepadatan Saat Ini** — jumlah antar kamera dari **nilai terbaru masing-masing kamera** di dalam jendela `CROWD_WINDOW_MINUTES`:

```sql
SELECT COALESCE(SUM(terbaru.count), 0) AS kepadatan_saat_ini
  FROM (
    SELECT DISTINCT ON (cr.camera_id) cr.count
      FROM app.crowd_records cr
      JOIN app.cameras c ON c.id = cr.camera_id AND c.is_active
     WHERE cr.recorded_at >= now() - ($1 * interval '1 minute')
       AND cr.inference_status = 'succeeded'
     ORDER BY cr.camera_id, cr.recorded_at DESC
  ) AS terbaru;
```

**Puncak Kepadatan Hari Ini** — nilai tertinggi yang pernah dicapai angka gabungan di atas sepanjang hari berjalan menurut Asia/Jakarta. Karena tangkapan antar kamera tidak serentak, angka gabungan dihitung per **ember waktu** selebar interval snapshot, memakai nilai terakhir tiap kamera di dalam ember tersebut:

```sql
WITH ember AS (
  SELECT date_bin($1 * interval '1 second', cr.recorded_at, date_trunc('day', now())) AS t,
         cr.camera_id,
         (array_agg(cr.count ORDER BY cr.recorded_at DESC))[1] AS count
    FROM app.crowd_records cr
   WHERE cr.recorded_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta')
     AND cr.inference_status = 'succeeded'
   GROUP BY 1, 2
)
SELECT COALESCE(MAX(total), 0) AS puncak_hari_ini
  FROM (SELECT t, SUM(count) AS total FROM ember GROUP BY t) AS gabungan;
```

Tiga ketentuan yang mengikat keduanya:

- **Baris ber-`inference_status` selain `succeeded` selalu disaring.** Baris `pending` berarti "menunggu inferensi" dan baris `failed` berarti "tidak pernah terhitung" — keduanya **bukan** nol orang. Memperlakukannya sebagai nol akan menurunkan angka kepadatan justru ketika layanan inferensi sedang bermasalah, yaitu saat pengawasan paling dibutuhkan.
- **Tidak ada penjumlahan antar waktu.** Inilah penerapan langsung catatan metodologis di `ABOUT-APPS.md` §1: satu kamera menyumbang tepat satu angka pada satu titik waktu. Menjumlahkan sepuluh baris dalam jendela lima menit akan menghitung orang yang sama sepuluh kali.
- **Hanya kamera aktif yang dihitung** untuk metrik saat ini. Kamera yang dipensiunkan tetap menyimpan riwayatnya dan tetap muncul dalam analisis jangka panjang, tetapi tidak lagi menyumbang angka kepadatan berjalan.

---

## 10. Komunikasi Real-Time

Sistem menggunakan **Server-Sent Events (SSE)**, bukan WebSocket.

Seluruh kebutuhan bersifat satu arah dari server ke klien: alert masuk, pembaruan angka kepadatan, perubahan status CCTV, dan perubahan status ingest dataset. Tidak ada yang memerlukan komunikasi dua arah.

Keunggulan yang relevan:

- SSE adalah HTTP biasa; pada Nginx cukup menonaktifkan buffering, tanpa konfigurasi upgrade koneksi
- Mekanisme reconnect otomatis sudah tersedia pada `EventSource` di browser
- Ketika backend berjalan lebih dari satu proses, penyebaran antar-proses dilakukan melalui Redis pub/sub

**Satu endpoint** memultipleks seluruh jenis peristiwa, dibedakan melalui field `event`:

```
event: alert.created      data: { alert_id, camera_id, count, snapshot_url }
event: alert.updated      data: { alert_id, camera_id, peak_count, last_seen_at }
event: alert.handled      data: { alert_id, camera_id, handled_by, handled_at }
event: crowd.updated      data: { camera_id, count, recorded_at }
event: cctv.status        data: { camera_id, is_online }
event: dataset.status     data: { dataset_id, status, error }
```

`alert.created` **memicu popup**, `alert.updated` tidak. Keduanya menyegarkan tabel log alert dan kartu KPI yang sedang terbuka. Tanpa `alert.updated`, kerumunan yang terus membesar tidak terlihat bertambah oleh petugas yang sedang menatap layarnya — karena aturan satu-kejadian-satu-alert (§9.3) sengaja tidak membuat baris baru. `alert.handled` menjaga agar dua petugas tidak menangani kejadian yang sama.

Peristiwa disaring berdasarkan hak akses penerima sebelum dikirim: peristiwa alert, kepadatan, dan status CCTV hanya untuk System Administrator, Staff, dan Security; `dataset.status` hanya untuk System Administrator dan Staff. Viewer tidak menerima apa pun dan ditolak 403 saat berlangganan — tidak ada peristiwa yang berarti baginya.

`dataset.status` diterbitkan pada tiga titik: saat ingest mulai diproses (`processing`), saat ingest berakhir (`completed`/`failed`), dan saat pekerjaan `publish` selesai — berhasil maupun gagal — dengan `status` berisi status dataset saat itu. Titik ketiga penting bagi halaman detail dataset: publikasi GeoServer berjalan beberapa detik setelah `completed`, dan tanpa peristiwa susulan itu halaman akan terus menampilkan "Menunggu publikasi" tanpa pratinjau WMS sampai dimuat ulang manual.

**Jalur data:** API menerbitkan ke kanal Redis `tahura:events`; setiap proses BFF memegang **satu** langganan Redis dan menyebarkannya ke antrian per koneksi browser, sehingga seribu tab tidak berarti seribu koneksi Redis. Koneksi yang tertinggal (antrian penuh) kehilangan peristiwa, bukan memblokir yang lain. Pesan yang bukan JSON berobjek `event` diabaikan.

**Autentikasi `EventSource`.** `EventSource` bawaan browser tidak dapat mengirim header `Authorization`, sementara menaruh access token Keycloak di query string membocorkannya ke log proxy. Jalan tengahnya: frontend meminta **tiket** (`POST /events/ticket`, dengan Bearer) — token HMAC berumur sisa hidup access token, memuat `sub`, peran, dan `sid` — lalu membuka `GET /events?ticket=…`. Tiket hanya berlaku untuk berlangganan peristiwa, tidak untuk operasi lain, sehingga kebocorannya ke log tidak berharga. Koneksi ditutup dengan `event: session.expired` saat tiket habis atau sesi dicabut (diperiksa tiap heartbeat), dan `EventSource` otomatis menyambung ulang — frontend cukup meminta tiket baru ketika menerima 401. Klien yang mampu mengirim header (fetch-based SSE) boleh memakai Bearer langsung tanpa tiket.

---

## 11. Migrasi Basis Data

Migrasi ditulis sebagai **berkas SQL bernomor**, tanpa perkakas ORM.

**Baseline `001` tidak berada di API.** Seluruh DDL awal — peran, basis data, schema, ke-23 tabel §3.2–§3.3, hibah, dan baris semai — berada di `app-requirement/pgsql/sql/` dan diimpor saat deployment PostgreSQL (§12.1), jauh sebelum API terpasang. Impor itu mencatat `001_baseline` di `app.schema_migrations`, sehingga runner API mengenalinya sebagai sudah diterapkan.

```
app-requirement/pgsql/sql/    baseline 001 — dijalankan devops saat deployment
app-api/migrations/
  002_....sql                 evolusi skema berikutnya — dijalankan runner API
  003_....sql
```

Sebuah runner kecil di API menerapkan berkas yang belum tercatat di `app.schema_migrations`, secara berurutan, masing-masing dalam satu transaksi — melanjutkan dari baseline, tidak pernah mengulanginya.

Pola alternatif — menjalankan DDL idempoten pada setiap startup — **tidak digunakan**. Pola tersebut hanya sanggup menangani penambahan, dan tidak memiliki jawaban untuk perubahan destruktif seperti penggantian nama kolom, perubahan constraint, atau pengisian ulang data. Ia juga tidak dapat menjawab pertanyaan apakah basis data staging sudah setara dengan produksi.

Berkas baseline sendiri memang idempoten (`IF NOT EXISTS`), tetapi itu properti keselamatan agar impor ulang aman — bukan mekanisme perubahan skema. Setelah sistem berjalan, baseline tidak pernah disunting; setiap perubahan skema adalah migrasi bernomor baru. Menyunting baseline hanya menggeser definisi lingkungan baru, diam-diam menjauh dari basis data yang sudah terpasang.

---

## 12. Pengemasan & Konvensi Pengembangan

### 12.1 Seluruh Lapis Berbentuk Container

Ketiga lapis sistem — API, Backend (BFF), dan Frontend — beserta seluruh layanan pendukung dikemas sebagai **container** dan dijalankan melalui `docker compose`. Tidak ada komponen yang dipasang atau dijalankan langsung di host.

Ini bukan sekadar kemudahan penyebaran. Pemisahan zona jaringan yang menjadi tulang punggung model keamanan (§1) hanya berlaku bila setiap komponen berada di dalam jaringan Docker — satu layanan yang berjalan di host akan menembus batas tersebut.

| Container | Isi |
|---|---|
| `api` | Layanan inti FastAPI |
| `worker-ingest` | Worker pemroses unggahan |
| `worker-snapshot` | Worker pengambil tangkapan CCTV |
| `worker-scheduler` | Pekerjaan berkala; lihat §12.4 |
| `bff` | Backend for Frontend |
| `frontend` | nginx: berkas statis hasil build Vite **sekaligus proxy** jalur BFF (`/api`, `/gs`, `/auth`, `/streams`, `/pages`, `/events`, `/healthz`) ke `bff:8080` — Nginx luar cukup satu upstream `127.0.0.1:${FRONTEND_PORT}`; ketentuan unggahan berpotongan, SSE, dan `frame-ancestors` peta publik tertanam di container, bukan di konfigurasi host |
| `postgres` | PostgreSQL + PostGIS |
| `redis` | Redis |
| `minio` | Object storage |
| `geoserver` | GeoServer + GeoWebCache, dengan ekstensi COG |
| `mediamtx` | MediaMTX |
| `keycloak` | Keycloak |

Container `api`, `worker-ingest`, `worker-snapshot`, dan `worker-scheduler` dibangun dari **satu image yang sama** dengan perintah jalan berbeda, karena keempatnya memerlukan GDAL, PotreeConverter, dan ffmpeg yang identik.

Yang berada **di luar** compose hanya Nginx/aaPanel beserta terminasi HTTPS.

#### Urutan pemasangan

Layanan penyimpanan dan publikasi disiapkan **lebih dulu dan berurutan**, sebelum ketiga lapis aplikasi dipasang. Berkas penyiapannya berada di `app-requirement/`, satu direktori per layanan:

```
1. PostgreSQL + PostGIS    baseline lengkap — peran, basis data, schema,
                           seluruh tabel, hibah, baris semai (§11)
2. MinIO                   bucket dan dua service account (§2.2)
3. GeoServer               image kustom, workspace, dan named style (§6.9 langkah 1-3)
4. Keycloak                image kustom + realm import (§7.1);
                           butuh basis data keycloak dari langkah 1
   ────────────────────────────────────────────────────────────────
5. API → Backend (BFF) → Frontend
```

Urutan ini mengikat: GeoServer tidak dapat membuat datastore tanpa peran `geoserver_ro` di PostgreSQL, tidak dapat membaca COG tanpa service account di MinIO, dan Keycloak tidak dapat menyala tanpa basis data `keycloak` dari baseline. Keempatnya berbagi jaringan Docker `tahura-internal`, yang **dimiliki** compose langkah pertama (`app-requirement/pgsql/compose.yml`) — stack lain merujuknya sebagai `external`, sehingga menyalakan layanan mana pun sebelum PostgreSQL gagal seketika alih-alih diam-diam berjalan tanpa dependensinya.

Keempat langkah dieksekusi satu entrypoint: **`app-requirement/install.sh`**, yang membaca **`app-requirement/.env`** — berkas env devops tersendiri berisi kredensial dan port infrastruktur yang diubah pengguna sebelum pemasangan. Installer memeriksa ketersediaan port lebih dulu (dilewati untuk stack yang sudah berjalan), memperingatkan kredensial baku yang belum diganti, lalu memasang berurutan dengan menunggu sehat antar langkah; menjalankannya ulang aman karena seluruh provisioning idempoten dan konvergen. Nilai pada berkas itu wajib disalin identik ke `.env` aplikasi ketika lapisan API/BFF/Frontend dipasang kelak.

Baseline langkah pertama tertanam di dalam image (`docker-entrypoint-initdb.d`) dan berjalan otomatis pada start pertama dengan volume kosong. Impor ulang manual — idempoten, sekaligus merotasi password ketiga peran dari `.env`:

```
docker compose exec postgres /docker-entrypoint-initdb.d/20-tahura-init.sh
```

Tiga peran yang lahir dari baseline mengikuti pola service account MinIO §2.2 — hak paling minimal per pemakai:

| Peran | Hak | Dipakai oleh |
|---|---|---|
| `POSTGRES_USER` | superuser instance | administrasi dan impor baseline saja |
| `PG_USER` (baku `tahura_app`) | non-superuser, pemilik schema `app` dan `gis` | API, seluruh worker, runner migrasi |
| `geoserver_ro` | `SELECT` pada schema `gis` saja | datastore GeoServer |

API tidak pernah terhubung sebagai superuser. API menginterpolasikan nama tabel sistem ke dalam SQL (§3.3); bila kelak ada celah pada jaminan itu, koneksi non-superuser membatasi kerusakannya — tanpa `COPY ... PROGRAM`, tanpa akses ke basis data Keycloak yang berada pada instance yang sama dan sengaja ditutup dengan `REVOKE CONNECT`.

`app-requirement/` memuat berkas yang **dijalankan**, beserta satu [`README.md`](app-requirement/README.md) operasional untuk devops — cara memasang, memverifikasi, dan merotasi. Alasan di balik setiap keputusan tetap berada di dokumen ini, dan README itu merujuk ke sini, bukan mengulanginya.

### 12.2 Tidak Ada Dokumentasi di Dalam Kode

Kode **tidak memuat docstring maupun komentar inline**. Seluruh penjelasan berada di dokumen terpisah: `ABOUT-APPS.md` untuk aturan bisnis, `ARCHITECTURE.md` untuk desain teknis, dan `FITUR-APLIKASI.md` untuk daftar fitur dan urutan pengembangan.

Konsekuensinya terhadap cara menulis kode:

- **Penamaan harus membawa makna**, karena tidak ada komentar yang menjelaskannya
- Logika yang tidak jelas dengan sendirinya — algoritma tidak lazim, solusi sementara, alasan sebuah ambang batas — dijelaskan di dokumen, bukan di berkas sumber
- Kontrak antarmuka dituangkan dalam **spesifikasi OpenAPI**, bukan docstring

### 12.3 Tidak Ada Nilai yang Di-Hardcode

Setiap nilai konfigurasi — batas ukuran, ambang batas, interval, timeout, nama bucket, alamat layanan, kredensial — dibaca dari variabel lingkungan yang didefinisikan di `.env`.

Nilai baku boleh berada di lapisan pemuat konfigurasi, **tidak pernah** di tempat pemakaiannya. Setiap variabel baru yang diperkenalkan wajib ikut dicatat di §13.

`.env` tidak pernah di-commit. Repositori menyertakan `.env.example` yang memuat seluruh kunci beserta penjelasannya, tanpa nilai rahasia.

### 12.4 Pekerjaan Berkala

Seluruh pekerjaan yang berjalan menurut jadwal — bukan menurut permintaan pengguna — dijalankan oleh container `worker-scheduler`.

| Pekerjaan | Irama | Rujukan |
|---|---|---|
| Pembersihan snapshot kedaluwarsa | `SNAPSHOT_CLEANUP_CRON` | §9.5 |
| Pemeriksaan status online/offline kamera | `CCTV_STATUS_CHECK_INTERVAL_SECONDS` | §3.2 |
| Pengembalian pekerjaan yatim yang lease-nya kedaluwarsa | `JOB_REAPER_INTERVAL_SECONDS` | §5.2 |
| Pengulangan publikasi GeoServer yang gagal | `PUBLISH_RETRY_INTERVAL_SECONDS` | §6.2 |
| Pembersihan sesi unggah kedaluwarsa beserta berkas spool-nya | `UPLOAD_SESSION_TTL_HOURS` | §4.1 |

Penjadwal berada di container tersendiri, bukan di dalam proses API. Bila ia menumpang di API, setiap replika API akan menjalankan jadwal yang sama dan pekerjaan terduplikasi — kecuali ditambahkan pemilihan leader, yang lebih rumit daripada memisahkan satu container. Menumpangkannya ke `worker-snapshot` juga ditolak: loop snapshot berjalan tiap 30 detik untuk seluruh kamera, sementara pembersihan harian bersifat berat dan berdurasi panjang, sehingga keduanya akan saling menahan.

**Penjadwal tidak mengerjakan pekerjaannya sendiri.** Ia hanya memasukkan pekerjaan ke `app.ingest_jobs` atau ke antrian Redis, lalu worker yang bersangkutan mengeksekusinya — sehingga mekanisme lease (§5.2) tetap berlaku dan penjadwal dapat di-restart kapan pun tanpa meninggalkan pekerjaan setengah jalan.

---

## 13. Variabel Konfigurasi

Seluruh konfigurasi berasal dari variabel lingkungan. **Tidak ada nilai yang di-hardcode.**

**Daftar lengkap variabel beserta penjelasan dan nilai bakunya ada di [`.env.example`](.env.example)** — berkas itu yang bersifat otoritatif. Bagian ini hanya memetakan kelompoknya agar mudah ditelusuri.

| Kelompok | Cakupan |
|---|---|
| Umum | Zona waktu, tingkat log, ukuran halaman baku |
| Domain & URL publik | Alamat yang dijangkau dari internet, termasuk `frame-ancestors` untuk penyematan iframe |
| PostgreSQL | Inisialisasi container, koneksi API sebagai peran non-superuser, pengguna read-only GeoServer, basis data Keycloak |
| Redis | Fan-out peristiwa dan antrian snapshot |
| MinIO | Inisialisasi container, kredensial aplikasi, lima bucket, dua service account, masa berlaku presigned URL |
| GeoServer | Admin, workspace, datastore, tiga named style, ekstensi COG dan kredensial S3, GeoWebCache |
| MediaMTX | Port, auth hook, masa berlaku token stream |
| Keycloak | Admin master, realm import, dua client, masa berlaku token, nama peran, user sysadmin awal |
| API | Kredensial layanan, kunci enkripsi CCTV, spool, batas ukuran, pemeriksaan arsip, konversi, antrian pekerjaan |
| CCTV & kepadatan | Interval snapshot, retensi, ambang batas kepadatan |
| Penjadwal | Irama seluruh pekerjaan berkala — lihat §12.4 |
| Layanan eksternal | Endpoint analisis kepadatan dan notifikasi beserta kontraknya |
| Backend (BFF) | Alamat internal yang diproksikan, cache hak akses, SSE |
| Frontend | Variabel build-time Vite — seluruhnya terlihat publik |

**Empat variabel yang wajib diisi sebelum sistem dapat berjalan** dan tidak memiliki nilai baku yang aman:

| Variabel | Akibat bila kosong |
|---|---|
| `CCTV_CREDENTIAL_ENCRYPTION_KEY` | Kredensial kamera tidak dapat disimpan. Kehilangan kunci ini setelah terisi berarti seluruh kredensial tidak dapat dipulihkan |
| `API_SERVICE_CREDENTIAL` | BFF tidak dapat memanggil API |
| `CROWD_THRESHOLD` | Peringatan kepadatan tidak pernah dibuat. Belum ditetapkan pemangku kepentingan |
| `MINIO_ENDPOINT` | Wajib dapat diresolusi **identik** dari dalam dan luar jaringan Docker; ketidaksesuaian membuat seluruh tile raster gagal |

---

## 14. Ringkasan Keputusan Arsitektur

| Keputusan | Pilihan | Alasan utama |
|---|---|---|
| Lapisan sistem | Frontend → Backend (BFF) → API | Alamat dan kredensial layanan internal tidak pernah terekspos ke browser |
| Otorisasi | Ditegakkan di API, disaring di BFF | API tidak mempercayai klaim identitas dari BFF begitu saja |
| Publikasi OGC | GeoServer, raster dan vektor | Satu jalur publikasi untuk konsumen eksternal |
| Penyajian raster in-app | GeoServer WMS | Color ramp dan hillshade dalam satu permintaan dari satu layer |
| Penyajian vektor in-app | GeoServer WMS | Rendering di sisi server; ratusan ribu fitur tidak dikirim ke browser |
| Atribut fitur | Endpoint API sendiri | Penyaringan kolom sensitif dan penyisipan presigned URL |
| Pustaka peta | Leaflet | Vektor datang sebagai tile gambar; MapLibre tidak diperlukan |
| Object storage | MinIO | Presigned URL dengan dukungan Range untuk video besar |
| GeoServer membaca COG | Langsung dari MinIO via S3 | Berkas hanya ada di satu tempat; terbukti pada data survei nyata |
| Antrian ingest | PostgreSQL | Status pekerjaan dan data bisnis dalam satu transaksi |
| Real-time | SSE | Kebutuhan satu arah; jauh lebih sederhana daripada WebSocket |
| Skema atribut vektor | Tabel per layer | Diwajibkan oleh GeoServer untuk mempublikasikan layer |
| Nama tabel | Acak 12 karakter | Aman secara konstruksi terhadap injeksi dan tabrakan nama |
| Model inferensi | Endpoint eksternal | Persoalan lisensi dan operasional berada di luar sistem ini |
| Notifikasi WhatsApp | Endpoint eksternal | Manajemen sesi berada di luar sistem ini |
| Migrasi | SQL bernomor | Menangani perubahan destruktif, yang tidak dapat dilakukan DDL idempoten |
| Pengemasan | Seluruh lapis sebagai container | Pemisahan zona jaringan hanya berlaku bila semua komponen berada di dalamnya |
| Dokumentasi kode | Dokumen terpisah, tanpa komentar inline | Satu sumber kebenaran; penjelasan di sumber cenderung menyimpang dari dokumen |
| Kepemilikan data | Bukan pembatas wewenang; akuntabilitas via audit log | Data milik institusi; penguncian per pemilik menghasilkan data yatim saat pegawai mutasi |
| Kredensial CCTV | Penulisan dibatasi System Administrator | Wewenang atas akses kamera lebih berat daripada wewenang atas data peta |
| Penghapusan | Langsung, tanpa masa tenggang | Pengaman berada di depan — penghapusan diblokir selama dataset dirujuk peta |
| Penyegaran GeoServer | Per sesi simpan, purge dipisah dari reload | Satu sesi menggambar 50 fitur tidak boleh menghasilkan 50 reload |
| Identitas kamera | Registry `app.cameras` tersendiri | Riwayat kepadatan permanen tidak boleh menggantung pada baris fitur yang dapat dihapus |
| Layer lokasi CCTV | Satu tabel sistem bernama tetap | Kamera adalah registry yang kebetulan spasial, bukan dataset gambaran pengguna |
| Hitungan kepadatan | `count` boleh NULL sampai inferensi selesai | Tangkapan gambar disimpan sebelum inferensi agar data mentah tidak hilang saat layanan mati |
| Media multimedia | Tabel `app.media_assets`, bukan konvensi prefix | Penghapusan dan audit berkas yatim menuntut daftar yang dapat dikueri |
| API key | Hibah per-peta untuk peta tak-terpublikasi | Data publik sudah anonim; kunci hanya berarti untuk yang tidak dipublikasikan |
| Pekerjaan berkala | Container `worker-scheduler` tersendiri | Cron di dalam API akan terduplikasi begitu API direplikasi |
| Sesi unggah | Tabel `app.upload_sessions` | Unggahan 20 GB yang terputus perlu tahu potongan mana yang sudah diterima |
| Metrik kepadatan | Nilai terbaru tiap kamera, dijumlahkan antar kamera | Penjumlahan antar waktu menghitung orang yang sama berulang kali |
| Alert | Satu alert terbuka per kamera, ditegakkan indeks unik parsial | Kerumunan sepuluh menit tidak boleh menjadi dua puluh alert dan dua puluh pesan |
| Inferensi gagal | Keadaan terminal `failed`, bukan menggantung | Baris yang tak pernah berhasil akan menumpuk selamanya di indeks parsial |
| Layer lokasi CCTV | Selalu menuntut peran, di luar jalur §7.3 | Satu layer sistem berarti satu peta publik menyingkap seluruh posisi kamera |
| Bootstrap GeoServer | Tugas startup API, dijaga advisory lock | Lingkungan baru terbentuk sendiri; kunci mencegah replika saling berlomba |
| Sesi sunting | Kunci per layer, bukan deteksi konflik saat simpan | Sesi memuat puluhan perubahan; tabrakan yang baru ketahuan di akhir berarti pekerjaan terbuang |
| Arsip berkas sumber | Vektor saja | Kegagalan vektor kerap dari pilihan konversi; raster 20 GB tidak memuat apa pun yang belum ada di COG-nya |
| Pointcloud dalam peta | Ditolak | Potree adalah viewer tersendiri, bukan layer Leaflet |
| Heatmap kepadatan | Per kamera, bukan per zona | Tidak ada kamera yang ditugaskan ke zona; zona hanya untuk pencarian lokasi |
| Baseline skema | `app-requirement/pgsql`, diimpor saat deployment | Basis data lengkap tersedia sebelum API terpasang; runner API melanjutkan dari 002 |
| Peran basis data API | Non-superuser, terpisah dari superuser instance | API menginterpolasi nama tabel ke SQL; koneksi non-superuser membatasi kerusakan bila jaminan §3.3 kelak bercelah |
| Provisioning Keycloak | Satu realm, realm import dua berkas JSON saat start | Token terikat realm penerbit; realm yang sudah ada dilewati impor, state hidup di basis data |
| Admin pengguna aplikasi | User sysadmin realm dengan `manage-users` terdelegasi | Penetapan peran pengguna tanpa memegang admin master Keycloak milik devops |
| Provisioning MinIO | Service one-shot `mc` dalam compose, idempoten | Kunci dari `.env` dikonvergenkan tiap jalan ulang — rotasi kredensial tanpa langkah manual |
| CORS MinIO | Tingkat server, origin dibatasi `PUBLIC_BASE_URL` | Dukungan CORS per-bucket bergantung versi; daftar origin-nya identik untuk semua bucket |
| Installer pra-deployment | `install.sh` + `.env` devops tersendiri di `app-requirement/` | Empat stack terpasang berurutan dengan tunggu-sehat; kredensial dan port infra diedit di satu tempat sebelum pemasangan |
| Teknologi BFF | FastAPI, satu bahasa dengan API | Verifikasi JWT, klien HTTP streaming, dan pola konfigurasi/compose identik — satu ekosistem untuk dirawat |
| Sesi di BFF | Stateless, Bearer pada tiap permintaan | Login OIDC terjadi di browser; BFF tanpa cookie dapat direplikasi tanpa berbagi state sesi |
| `GetCapabilities` lewat proxy | Disaring per hak akses, bukan diblokir | QGIS/ArcGIS memulai koneksi dari capabilities; memblokirnya mematikan jalur F11 |
| Autentikasi SSE | Tiket HMAC berumur sisa access token | `EventSource` tak bisa mengirim header; access token di query string bocor ke log proxy |
| Token stream | JWT HS256 tanpa state, per path kamera | Beberapa replika BFF memvalidasi tanpa berbagi apa pun selain rahasia; MediaMTX fail-closed bila BFF mati |
| Komposit halaman (2.6) | Agregasi tipis di BFF, rute passthrough tetap ada | Bentuk halaman diturunkan dari spesifikasi, bukan dari template frontend; frontend bebas memilih |
| Topologi frontend | Satu container nginx: statis + proxy jalur BFF | Nginx luar cukup satu upstream; ketentuan unggahan/SSE tidak bergantung pada konfigurasi aaPanel |
| Login di frontend | Tema Keycloak `tahura`; frontend hanya halaman pembuka | Frontend tak pernah memegang kata sandi; lupa/ganti sandi tetap milik Keycloak |
| Tile WMS di browser | `fetch` ber-Bearer → blob URL per tile | `<img>` tidak bisa membawa header; token di query string bocor ke log proxy (alasan yang sama dengan §10) |
| Nama pelaku | `*_username` di samping `sub` (migrasi 004) | Token hanya memberi `sub`; UUID tidak bermakna bagi pengguna |
| Hibah akses user | `subject_id` cocok dengan `sub` **atau** username | Pemberi hibah mengetik username; hibah lama ber-`sub` tetap berlaku |
| Pointcloud di browser | potree-core dengan encoding warna dipaksa linear, pick ber-fallback raycast | Shader pustaka versi 2.0.15 memutihkan seluruh warna pada encoding bakunya; picker GPU-nya gagal tanpa GPU nyata |
