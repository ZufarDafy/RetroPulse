# Tahura Djuanda Geo-Intelligence Dashboard

Sistem WebGIS dan pemantauan kawasan untuk **UPTD Taman Hutan Raya Ir. H. Djuanda**, Dinas Kehutanan Jawa Barat. Satu dashboard yang menggabungkan dua kemampuan:

- **Geo-intelligence** — pengelolaan data spasial hasil survei (ortofoto dan DEM raster, vektor, pointcloud): unggah, konversi otomatis (COG / PostGIS / Potree), publikasi layanan OGC melalui GeoServer, dan penyusunan peta dengan kontrol akses per peta. Layer yang sama dapat dibuka langsung di QGIS/ArcGIS.
- **Pengawasan kawasan** — pemantauan kepadatan pengunjung berbasis CCTV: tangkapan gambar berkala, penghitungan orang melalui endpoint inferensi eksternal, kartu KPI real-time, dan alert dengan notifikasi WhatsApp saat ambang terlampaui.

## Status

| Bagian | Keadaan |
|---|---|
| Dokumen perencanaan | Lengkap dan saling konsisten |
| Pra-kondisi infrastruktur (`app-requirement/`) | Dibangun dan **teruji hidup per modul** — termasuk pembuktian GeoServer membaca COG dari MinIO dan styling DEM ramp+hillshade tanpa duplikasi layer, pada data survei Tahura yang sebenarnya |
| API (`app-api/`, Tahap 1) | **Selesai — ketiga belas sub-tahap teruji hidup**, termasuk ketiga pipeline ingest pada data survei nyata, publikasi GeoServer ujung-ke-ujung (WMS/WFS), model akses §7.3, dan mesin pengawasan kepadatan dengan kamera sintetis; kontrak OpenAPI 54 path / 70 operasi setelah ekstensi kecil yang menyertai Tahap 3. Rincian di [app-api/README.md](app-api/README.md) |
| Backend/BFF (`app-be/`, Tahap 2) | **Selesai — keenam sub-tahap teruji hidup**: verifikasi ganda token + back-channel logout nyata dari Keycloak, proxy GeoServer dengan `GetCapabilities` tersaring per hak akses, token stream divalidasi MediaMTX lewat auth hook, SSE ber-tiket, unggahan dialirkan tanpa buffering, dan komposit per halaman. Rincian di [app-be/README.md](app-be/README.md) |
| Frontend (`app-fe/`, Tahap 3) | **Selesai — kedelapan sub-tahap teruji hidup di browser nyata** (Chromium headless melawan seluruh stack): login PKCE ke Keycloak bertema, dashboard + SSE, unggahan berpotongan dengan lanjut-ulang dan jalur versi baru, peta WMS ber-Bearer dengan panel fitur/legenda/ukur/ekspor/hibah akses, peta publik anonim, editor vektor bersesi kunci, pencocokan media batch, CCTV HLS tiga stream sekaligus, crowd map dengan alert hidup, administrasi, dan pointcloud viewer 51 juta titik. Rincian di [app-fe/README.md](app-fe/README.md) |

## Arsitektur Selayang Pandang

```
┌─ BROWSER ──────────────────────────────────────────────┐
│  Frontend (Vue + Leaflet)                               │
└────┬───────────────┬───────────────┬────────────────────┘
     │ seluruh       │ login OIDC    │ objek via presigned URL
     ▼               ▼               ▼
   Backend (BFF)   Keycloak        MinIO
     │
┌────▼─ INTERNAL (jaringan Docker tahura-internal) ───────┐
│  API (FastAPI)          GeoServer + GeoWebCache          │
│  PostgreSQL + PostGIS   MediaMTX                         │
│  Redis                  worker: ingest, snapshot,        │
│                                 scheduler                │
└──────────────────────────────────────────────────────────┘
```

Pemisahan lapis adalah **kontrol keamanan**: browser tidak pernah menjangkau API maupun GeoServer secara langsung — satu-satunya pengecualian adalah MinIO melalui presigned URL berjangka waktu. Rincian di [ARCHITECTURE.md](ARCHITECTURE.md) §1.

## Peta Dokumen

| Dokumen | Isi | Catatan otoritas |
|---|---|---|
| [ABOUT-APPS.md](ABOUT-APPS.md) | Spesifikasi aplikasi dan aturan bisnis | **Menang** bila bertentangan dengan dokumen lain soal aturan bisnis |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Desain teknis: topologi, skema data, pipeline ingest, publikasi, kontrol akses, keputusan arsitektur | Alasan di balik setiap keputusan berada di sini |
| [FITUR-APLIKASI.md](FITUR-APLIKASI.md) | 59 fitur dalam tiga tahap pengembangan | — |
| [.env.example](.env.example) | Seluruh variabel konfigurasi beserta penjelasannya | **Otoritatif** untuk konfigurasi |
| [app-requirement/README.md](app-requirement/README.md) | Operasional pra-deployment: cara memasang, memverifikasi, merotasi | — |

## Mulai Cepat — Pra-Deployment

Infrastruktur (PostgreSQL → MinIO → GeoServer → Keycloak) dipasang **sebelum** lapisan aplikasi:

```
cd app-requirement
cp .env.example .env        # sunting kredensial dan port
./install.sh --dry-run      # opsional: tampilkan rencana tanpa mengubah apa pun
./install.sh
```

Rincian, verifikasi, dan rotasi kredensial: [app-requirement/README.md](app-requirement/README.md).

## Mulai Cepat — Lapisan Aplikasi

Setelah infrastruktur hidup, susun `.env` aplikasi di root repo dari [.env.example](.env.example) — nilai infra disalin identik dari `app-requirement/.env` (catatan 10 di dalamnya), lalu isi empat rahasia aplikasi yang tidak punya nilai baku: `API_SERVICE_CREDENTIAL`, `CCTV_CREDENTIAL_ENCRYPTION_KEY`, `BFF_SESSION_SECRET`, dan `CROWD_THRESHOLD` begitu ditetapkan. Pasang berurutan, selalu dengan path `.env` **absolut**:

```
docker compose -f app-api/compose.yml --env-file "$PWD/.env" up -d --build   # redis, mediamtx, api, tiga worker
docker compose -f app-be/compose.yml  --env-file "$PWD/.env" up -d --build   # bff
curl -s http://127.0.0.1:8080/healthz                                        # {"status":"ok","api":"ok","redis":"ok"}
docker compose -f app-fe/compose.yml  --env-file "$PWD/.env" up -d --build   # frontend (build Vite di dalam image)
curl -s http://127.0.0.1:8090/healthz                                        # jawaban BFF yang sama, lewat proxy frontend
```

Rincian per lapis: [app-api/README.md](app-api/README.md), [app-be/README.md](app-be/README.md), [app-fe/README.md](app-fe/README.md).

### Yang berada di luar compose: Nginx

Hanya tiga hal yang terekspos ke internet, seluruhnya lewat Nginx/aaPanel dengan HTTPS:

| Nama publik | Diarahkan ke | Ketentuan Nginx |
|---|---|---|
| `PUBLIC_BASE_URL` | `127.0.0.1:${FRONTEND_PORT}` | Container frontend sudah menanamkan ketentuan unggahan dan SSE di nginx-nya sendiri; Nginx luar cukup meneruskan HTTP/1.1 dengan `client_max_body_size` ≥ `UPLOAD_CHUNK_SIZE_MB` (baku 50 MB), `proxy_request_buffering off`, dan `proxy_buffering off` + `proxy_read_timeout` panjang pada `/events`. Contoh lengkap ketiga server block: [app-fe/deploy/nginx-edge.example.conf](app-fe/deploy/nginx-edge.example.conf). `127.0.0.1:${BFF_PORT}` tidak lagi perlu dijangkau browser |
| `PUBLIC_MEDIAMTX_URL` | `127.0.0.1:${MEDIAMTX_HLS_PORT}` | Teruskan header `Authorization` dan query string apa adanya — keduanya membawa token stream |
| `PUBLIC_KEYCLOAK_URL` | `127.0.0.1:${KEYCLOAK_PORT}` | Header `X-Forwarded-*` (Keycloak berjalan dengan `KC_PROXY_HEADERS=xforwarded`) |

MinIO (`PUBLIC_MINIO_URL`) juga diproksikan untuk presigned URL, dengan hostname yang **sama** dari dalam dan luar Docker (catatan 1 di `.env.example`). API dan GeoServer tidak pernah mendapat nama publik; pemetaan `127.0.0.1:${API_PORT}` dan `127.0.0.1:${GEOSERVER_PORT}` hanya untuk devops dan dapat dilepas saat produksi.

## Tahap Pengembangan

Sistem dibangun **mengikuti lapisan**, bukan per kelompok fitur ([ARCHITECTURE.md](ARCHITECTURE.md) §1.3):

| Urutan | Direktori | Isi |
|---|---|---|
| Pra-kondisi | `app-requirement/` | Infrastruktur penyimpanan, publikasi, identitas |
| Tahap 1 | `app-api/` | Seluruh logika domain dan aturan bisnis (FastAPI) — kemajuannya diverifikasi lewat QGIS tanpa antarmuka |
| Tahap 2 | `app-be/` | Backend for Frontend — satu-satunya pintu dari browser |
| Tahap 3 | `app-fe/` | Antarmuka pengguna (Vue) |

## Teknologi

| Peran | Teknologi |
|---|---|
| Basis data | PostgreSQL 16 + PostGIS 3.5 — juga antrian pekerjaan |
| Object storage | MinIO — lima bucket private, akses presigned |
| Publikasi OGC | GeoServer 3.0 + GeoWebCache, plugin community `cog-s3` |
| Identitas | Keycloak 26 — OIDC, satu realm dua client |
| API | FastAPI + GDAL/OGR, PotreeConverter 2.x, ffmpeg |
| Backend (BFF) | FastAPI — verifikasi token, proxy API/GeoServer streaming, token stream, SSE |
| Real-time | Server-Sent Events + Redis pub/sub |
| Streaming CCTV | MediaMTX (RTSP → HLS), playback diotorisasi lewat auth hook ke BFF |
| Frontend | Vue 3 + Vite, Pinia, vue-i18n (id/en/su), keycloak-js (PKCE); token Carbon Design System dengan IBM Plex di-bundle |
| Peta | Leaflet (WMS ber-Bearer → blob tile); pointcloud melalui three + potree-core; 360 melalui Photo Sphere Viewer; HLS melalui hls.js |
