# Analisis Kebutuhan Server untuk 100 User

> Dibuat: 5 Juli 2026 — analisis skalabilitas Gezy untuk multi-user.

---

## Ringkasan Eksekutif

**Satu server cukup untuk 100 user.** Tidak perlu banyak server. Bottleneck utama bukan jumlah user terdaftar, tapi jumlah user yang **aktif chatting bersamaan** dan **SQLite write contention**.

---

## 1. Perhitungan Beban Realistis

### Asumsi Dasar

```
100 user TERDAFTAR
  → Yang LOGIN bareng:     ~30-50 orang  (tidak semua online)
  → Yang CHATTING bareng:  ~5-15 orang   (tidak semua ngobrol)
  → Yang TOOL CALLS:       ~2-5 orang    (generate PDF, search, dll)
```

### Matriks User vs Server

| User Terdaftar | Online Bersamaan | Aktif Chatting | Rekomendasi Server |
|:---:|:---:|:---:|:---|
| 20 | 10 | 3-5 | 1 server kecil (2 vCPU / 4 GB) |
| 50 | 25 | 5-10 | 1 server menengah (4 vCPU / 8 GB) |
| **100** | **50** | **10-20** | **1 server besar (8 vCPU / 16 GB)** |
| 200 | 100 | 20-40 | 1 server besar atau mulai split |
| 500+ | 250+ | 50+ | 2+ server (mulai perlu) |

---

## 2. Analisis Bottleneck

### Arsitektur Single-Process

```
┌─────────────────────────────────────────────────────────┐
│              SINGLE PROCESS (Bun)                        │
│                                                         │
│  50-100 user → SSE connections (ringan, keep-alive)     │
│       ↓                                                 │
│  Agent Queue → dequeue satu per satu per agent          │
│       ↓                                                 │
│  SQLite (1 file) → baca: banyak, tulis: SATU per waktu  │
│       ↓                                                 │
│  LLM API (eksternal) → rate limit per provider          │
└─────────────────────────────────────────────────────────┘
```

### Analisis Per Lapisan

| Lapisan | Bottleneck? | Kenapa |
|---------|:-----------:|--------|
| **SSE connections** | 🟢 Rendah | 100 koneksi SSE sangat ringan (long-poll keep-alive) |
| **HTTP (Hono)** | 🟢 Rendah | Bun + Hono bisa ribuan req/detik |
| **Agent Queue** | 🟡 Menengah | FIFO per agent, user message priority 100 |
| **SQLite write** | 🔴 **Tinggi** | Hanya SATU writer dalam satu waktu |
| **LLM API** | 🔴 **Tinggi** | Rate limit provider (RPM/TPM), biaya token |

---

## 3. SQLite: Mitos vs Realita

```
MITOS: "SQLite cuma bisa 1 user"
FAKTA:
  - WAL mode: pembaca TANPA BATAS, selama tidak ada writer
  - Writer: SATU per waktu (tapi tiap transaksi mikrodetik)
  - SQLite bisa ribuan queries/detik di server modern
  - Yang bikin lambat: BANYAK writer bersamaan, bukan banyak reader
```

### Angka Kemampuan SQLite

NVMe SSD bisa handle **~500-1000 transaksi write/detik**.

```
1 user kirim 1 pesan → ~5-7 transaksi write:

  insert queue_item       (1 write)
  dequeue                 (1 write)
  insert message user     (1 write)
  insert message asst     (1 write)
  update queue status     (1 write)
  insert memory (opsional) (0-2 write)
  ─────────────────────────────────
  = 5-7 write per pesan
```

### Simulasi Beban

```
10 user chatting bareng:
  10 × 7 write = 70 write dalam 2-5 detik
  → SQLite sibuk ~70ms dari 5000ms
  → Utilisasi: 1.4%
  → SANTAT ✅

50 user chatting bareng (worst case 100 user terdaftar):
  50 × 7 write = 350 write dalam 2-5 detik
  → SQLite sibuk ~350ms dari 5000ms
  → Utilisasi: 7%
  → MASIH AMAN ✅

100 user chatting bareng:
  100 × 7 write = 700 write dalam 2-5 detik
  → SQLite sibuk ~700ms dari 5000ms
  → Utilisasi: 14%
  → MASIH AMAN, mulai terasa latency ✅
```

---

## 4. Satu Server: Kapan Cukup & Kapan Perlu Split

### Kapan 1 Server Cukup

| Kondisi | Batas Aman |
|---------|-----------|
| User terdaftar | Sampai ~500 |
| Online bersamaan | Sampai ~150 |
| Chatting bersamaan | Sampai ~70 |
| Database size | Sampai ~5-10 GB |
| Response time | <2 detik (normal) |

### Kapan Perlu 2+ Server

| Kondisi | Threshold |
|---------|-----------|
| 🔴 User terdaftar | 1000+ |
| 🔴 Chatting bersamaan | 100+ |
| 🔴 Butuh HA (high availability) | Server mati → backup langsung |
| 🔴 User tersebar geografis | Asia + Eropa + US (latency) |
| 🔴 Database | >20 GB (SQLite mulai lambat) |

---

## 5. Arsitektur Split (Untuk 200+ User)

### Opsi A: Split by User Group

```
┌─────────────────────────────────────────────────────┐
│             LOAD BALANCER (nginx/caddy)              │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Gezy #1      │  │ Gezy #2      │  │ Gezy #3    │ │
│  │ User 1-50    │  │ User 51-100  │  │ User 101-  │ │
│  │ Agent A,B,C  │  │ Agent D,E,F  │  │ 150        │ │
│  │ DB: gezy1.db │  │ DB: gezy2.db │  │ DB: gezy3  │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                      │
│  Setiap instance = isolate, tidak sharing DB         │
│  User dialokasi ke instance via subdomain atau path  │
└─────────────────────────────────────────────────────┘
```

**Kelebihan:** Sederhana, tidak perlu migrasi SQLite → PostgreSQL.  
**Kekurangan:** User di instance beda tidak bisa interaksi.

### Opsi B: Split by Function (Enterprise)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Server 1: API + Agent Engine                        │
│  Server 2: PostgreSQL (ganti SQLite)                 │
│  Server 3: Redis (cache + queue)                     │
│  Server 4: Playwright (PDF generation)               │
│  Server 5: Ollama (embedding lokal)                  │
│                                                      │
│  Butuh ~5 server, kompleksitas tinggi                │
│  Hanya untuk 500+ user enterprise                    │
└──────────────────────────────────────────────────────┘
```

**Kelebihan:** Skalabilitas penuh, HA, tiap komponen bisa scale sendiri.  
**Kekurangan:** Kompleks, mahal, overkill untuk <200 user.

---

## 6. Strategi Provider LLM untuk 100 User

### BYOK (Bring Your Own Key) — Direkomendasikan

```
┌──────────────────────────────────────────────────────┐
│               MODEL BYOK                              │
│                                                      │
│  User daftar → masukin API key sendiri →              │
│  Agent user PAKAI API key user →                     │
│  Biaya ditanggung user (bukan admin)                 │
│                                                      │
│  Keuntungan:                                         │
│  - Admin tidak kelola 100 API key                    │
│  - Biaya transparan per user                         │
│  - User bisa pilih provider favorit                  │
│  - Tidak ada shared rate limit                       │
│  - Rate limit 1000 RPM/user → cukup untuk 1 orang    │
└──────────────────────────────────────────────────────┘
```

### Perbandingan Strategi Provider

| Strategi | Rate Limit | Biaya Admin | Biaya User | Kompleksitas |
|----------|:---:|:---:|:---:|:---:|
| 1 provider shared semua | 🔴 Cepat habis | Admin bayar semua | Gratis | 🟢 Simpel |
| Admin setup 100 provider | 🟢 Tidak shared | Setup 100× | Gratis | 🟡 Berat |
| **BYOK (user bawa key)** | 🟢 Tidak shared | Hanya VPS | Bayar sendiri | 🟡 Perlu UI jelas |
| Multi-instance + BYOK | 🟢 Tidak shared | VPS × N | Bayar sendiri | 🔴 Kompleks |

---

## 7. Rekomendasi Spesifikasi Server

### Untuk 100 User

```
┌──────────────────────────────────────────────────────┐
│  VPS: Hetzner CX42 / DigitalOcean 8 vCPU             │
│                                                      │
│  CPU:  8 vCPU (AMD EPYC / Intel Xeon)                │
│  RAM:  16 GB                                         │
│  Disk: 160 GB NVMe SSD                               │
│  Net:  1 Gbps                                        │
│                                                      │
│  Harga: ~$30-60/bln                                  │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Docker Compose:                              │    │
│  │  - Gezy (single container)                    │    │
│  │  - Caddy (reverse proxy + HTTPS otomatis)     │    │
│  │  - Ollama (embedding lokal, opsional)         │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Kapasitas: nyaman untuk 100 user                    │
│  Batas aman: ~200 user sebelum perlu split           │
└──────────────────────────────────────────────────────┘
```

### Perbandingan Provider VPS

| Provider | Spec | Harga/bln | Region |
|----------|------|-----------|--------|
| **Hetzner CX42** | 8 vCPU, 16 GB, 160 GB NVMe | ~$30 | EU (Nuremberg) |
| **DigitalOcean** | 8 vCPU, 16 GB, 160 GB SSD | ~$96 | Global |
| **Vultr** | 8 vCPU, 16 GB, 160 GB NVMe | ~$96 | Global |
| **Linode** | 8 vCPU, 16 GB, 160 GB SSD | ~$72 | Global |
| **AWS Lightsail** | 8 vCPU, 16 GB, 160 GB SSD | ~$80 | Global |

> **Rekomendasi:** Hetzner — harga paling murah, NVMe, performa terbaik untuk harga. Kalau butuh region Asia, DigitalOcean Singapore.

### Spesifikasi untuk Skala Lain

| Skala | CPU | RAM | Disk | Harga/bln |
|-------|-----|-----|------|-----------|
| 20 user | 2 vCPU | 4 GB | 40 GB SSD | ~$10 |
| 50 user | 4 vCPU | 8 GB | 80 GB NVMe | ~$20 |
| **100 user** | **8 vCPU** | **16 GB** | **160 GB NVMe** | **~$30-60** |
| 200 user | 16 vCPU | 32 GB | 320 GB NVMe | ~$80-120 |
| 500 user (split) | 2× 8 vCPU | 2× 16 GB | 2× 160 GB | ~$60-120 |

---

## 8. Checklist Produksi

```bash
# ─── 1. Environment Variables ───
PUBLIC_URL=https://gezy.domain-anda.id
PORT=3000
GEZY_DATA_DIR=/data/gezy
LOG_LEVEL=info

# ─── 2. SQLite Tuning (.env atau PRAGMA) ───
# WAL mode (default di Gezy)
PRAGMA journal_mode=WAL;
# Cache 256MB
PRAGMA cache_size=-256000;
# Sync normal (10x lebih cepat dari FULL)
PRAGMA synchronous=NORMAL;
# Timeout 5 detik (kalau writer sibuk, tunggu jangan langsung error)
PRAGMA busy_timeout=5000;

# ─── 3. Queue Tuning ───
QUEUE_POLL_INTERVAL=250         # Default 500ms

# ─── 4. Batasi Concurrent ───
TASKS_MAX_CONCURRENT=5          # Default 10
TASKS_MAX_DEPTH=2               # Default 3
CRONS_MAX_CONCURRENT_EXEC=2     # Default 5

# ─── 5. Reverse Proxy (Caddyfile) ───
# gezy.domain-anda.id {
#     reverse_proxy localhost:3000
# }

# ─── 6. Backup Database (cron tiap jam) ───
# 0 * * * * cp /data/gezy/gezy.db /data/backups/gezy-$(date +\%Y\%m\%d-\%H\%M).db

# ─── 7. Monitoring ───
# Pantau: CPU, RAM, disk usage, SQLite write latency
# Tools: htop, iostat, docker stats

# ─── 8. Docker Restart Policy ───
# docker-compose.yml:
# services:
#   gezy:
#     restart: unless-stopped

# ─── 9. Log Rotation ───
# /etc/logrotate.d/gezy:
# /var/log/gezy/*.log {
#     daily
#     rotate 7
#     compress
#     missingok
# }
```

---

## 9. Estimasi Biaya Operasional

### Biaya Admin (VPS + Infrastruktur)

```
┌─────────────────────────────────────────────┐
│  VPS 8 vCPU / 16 GB / 160 GB NVMe           │
│  ─────────────────────────────────────      │
│  Hetzner CX42              ~$30/bln         │
│  Domain                    ~$1/bln          │
│  Backup storage            ~$5/bln          │
│  ─────────────────────────────────────      │
│  TOTAL ADMIN               ~$36/bln         │
└─────────────────────────────────────────────┘
```

### Biaya User (LLM API — BYOK)

```
┌─────────────────────────────────────────────────────┐
│  PER USER (chatting 1-2 jam/hari):                  │
│                                                     │
│  Claude Sonnet 4       ~$20-50/bln/user             │
│  GPT-4o / GPT-5        ~$15-40/bln/user             │
│  GPT-4o-mini           ~$5-15/bln/user              │
│  DeepSeek V3           ~$2-5/bln/user               │
│  Gemini Flash          ~$1-3/bln/user               │
│                                                     │
│  TOTAL 100 USER (variatif per pilihan model)        │
├─────────────────────────────────────────────────────┤
│  ADMIN                 ~$36/bln (fixed)             │
│  USER (mandiri)        ~$2-50/bln/user (variatif)   │
└─────────────────────────────────────────────────────┘
```

> **Biaya terbesar adalah LLM API user, BUKAN infrastruktur server.**

---

## 10. Kesimpulan

| Pertanyaan | Jawaban |
|------------|---------|
| Perlu berapa server untuk 100 user? | **1 server** (8 vCPU, 16 GB RAM, NVMe) |
| Kenapa tidak perlu banyak? | 100 user terdaftar ≠ 100 chatting bareng. Paling 10-20 yang chatting. |
| Kapan perlu 2 server? | 200-300 user, atau butuh HA |
| Kapan perlu 5+ server? | 1000+ user, atau multi-region |
| Yang paling penting? | Spec server yang tepat + monitoring, bukan jumlah server |
| SQLite cukup? | Ya, WAL mode + NVMe bisa handle 500-1000 write/detik |
| Provider LLM? | **BYOK** — user bawa API key sendiri |
| Biaya admin? | ~$36/bln (VPS + domain + backup) |
| Biaya user? | ~$2-50/bln/user (tergantung model LLM pilihan) |

**Satu server besar lebih baik daripada banyak server kecil.** Bottleneck utama (SQLite) tetap satu file dan tidak bisa di-split tanpa mengubah arsitektur. Untuk 100 user: **fokus ke spec yang tepat dan monitoring, bukan jumlah server.**
