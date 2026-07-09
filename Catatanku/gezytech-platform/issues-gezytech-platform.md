# Issues — GezyTech Platform App (dari PRD)

> Dibuat: 9 Jul 2026 · Status: **DRAFT**

---

# EPIC-1 — Scaffolding & Auth

## Issue PLT-00 — Scaffold platform-app folder structure

- **Labels**: `P0`, `phase-1`, `infrastructure`
- **Estimate**: 1
- **Tujuan**: Buat folder `platform-app/` dengan React + Vite + Hono + Bun, sama seperti public-app.
- **Tugas**
  - [ ] `bun create vite platform-app --template react-ts`
  - [ ] `bun add hono @hono/node-server`
  - [ ] Buat `server/index.ts` dengan health endpoint di port 3004
  - [ ] Buat `vite.config.ts` proxy `/api` → `localhost:3004`
  - [ ] Buat `package.json` scripts: `dev`, `build`
  - [ ] Buat layout dasar: sidebar + content area
  - [ ] Tes: `curl http://localhost:3004/api/health` → `{"status":"ok"}`
- **Acceptance**: `bun run dev` → buka `http://localhost:5174` → tampil halaman kosong dengan sidebar

## Issue PLT-01 — Database & migration

- **Labels**: `P0`, `phase-1`, `backend`
- **Estimate**: 1
- **Depends-on**: PLT-00
- **Tugas**
  - [ ] Buat `server/db.ts` — inisialisasi SQLite `platform.db`
  - [ ] Buat `server/migrate.ts` — buat tabel: `platform_users`, `topup_transactions`, `usage_daily`, `pricing_config`
  - [ ] Seed pricing default (DeepSeek)
  - [ ] Seed dev user (kalau `DEV_MODE=true`)
- **Acceptance**: `sqlite3 data/platform.db ".tables"` → 4 tabel muncul

## Issue PLT-02 — SSO Auth (verify ke gezytech)

- **Labels**: `P0`, `phase-1`, `backend`
- **Estimate**: 2
- **Depends-on**: PLT-01
- **Tujuan**: Platform-app tidak membuat auth sendiri — verify session ke gezytech.
- **Tugas**
  - [ ] Buat `server/auth.ts` — fungsi `verifySession(token)` → call `GET gezytech:3003/api/auth/me` dengan cookie
  - [ ] Middleware `requireAuth` — redirect ke gezytech login kalau belum login
  - [ ] `DEV_MODE=true` → auto-login sebagai dev user (bypass gezytech)
  - [ ] Frontend `useAuth.ts` — check `/api/auth/me`, redirect kalau 401
- **Acceptance**: Buka `http://localhost:5174` → redirect ke login (atau auto-login di dev mode)

---

# EPIC-2 — Dashboard & Usage

## Issue PLT-10 — Dashboard ringkasan

- **Labels**: `P0`, `phase-1`, `frontend+backend`
- **Estimate**: 2
- **Depends-on**: PLT-02
- **Tugas**
  - [ ] Backend: `GET /api/dashboard` → `{ balance, usageThisMonth: {input, output, total, cost}, pendingTopups }`
  - [ ] Frontend: `Dashboard.tsx` — card saldo + bar chart pemakaian bulan ini
  - [ ] Ambil data dari `token_usage` table public-app (atau dari `usage_daily` platform-app sendiri)
- **Acceptance**: Dashboard menampilkan saldo + chart usage

## Issue PLT-11 — Usage detail (chart + tabel)

- **Labels**: `P0`, `phase-1`, `frontend+backend`
- **Estimate**: 2
- **Depends-on**: PLT-10
- **Tugas**
  - [ ] Backend: `GET /api/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` → daily breakdown
  - [ ] Data source: dari `token_usage` table public-app (aggregate per hari)
  - [ ] Frontend: `Usage.tsx` — chart bar + tabel
  - [ ] Filter: hari ini / minggu ini / bulan ini / custom range
- **Acceptance**: Grafik usage muncul, bisa difilter range tanggal

## Issue PLT-12 — Usage pricing config

- **Labels**: `P1`, `phase-1`, `backend`
- **Estimate**: 1
- **Depends-on**: PLT-01
- **Tugas**
  - [ ] Admin endpoint: `POST /api/admin/pricing` — update harga per model
  - [ ] Hitung `cost_estimate` = input_tokens × input_price + output_tokens × output_price
  - [ ] Seed pricing default di migration
- **Acceptance**: Dashboard menampilkan estimasi biaya dalam Rupiah

---

# EPIC-3 — TopUp & Billing

## Issue PLT-20 — TopUp manual (admin approve)

- **Labels**: `P0`, `phase-2`, `backend`
- **Estimate**: 2
- **Depends-on**: PLT-02
- **Tugas**
  - [ ] Backend: `POST /api/topup` — buat transaksi pending, generate nomor referensi
  - [ ] Backend: `GET /api/topup/history` — riwayat topup user
  - [ ] Backend: `GET /api/topup/status/:id` — cek status
  - [ ] Admin: `GET /api/admin/topups` — list semua pending
  - [ ] Admin: `POST /api/admin/topups/:id/approve` — approve → balance bertambah
  - [ ] Admin: `POST /api/admin/topups/:id/reject` — reject
- **Acceptance**: User bisa request topup → admin approve → saldo user bertambah

## Issue PLT-21 — TopUp UI (frontend)

- **Labels**: `P0`, `phase-2`, `frontend`
- **Estimate**: 2
- **Depends-on**: PLT-20
- **Tugas**
  - [ ] `TopUp.tsx` — pilih nominal (50rb, 100rb, 200rb, custom)
  - [ ] Tampilkan nomor rekening + referensi
  - [ ] Status polling (pending → success)
  - [ ] Notifikasi kalau saldo menipis
- **Acceptance**: User bisa isi form topup → lihat status transaksi

## Issue PLT-22 — Billing (riwayat transaksi)

- **Labels**: `P1`, `phase-2`, `frontend+backend`
- **Estimate**: 1
- **Depends-on**: PLT-20
- **Tugas**
  - [ ] Backend: `GET /api/billing` — semua transaksi user (topup + pemakaian)
  - [ ] Frontend: `Billing.tsx` — tabel dengan filter (topup/usage/semua)
  - [ ] Export CSV (opsional)
- **Acceptance**: User bisa lihat semua transaksi dalam tabel

---

# EPIC-4 — Profile

## Issue PLT-30 — Profile (view + edit)

- **Labels**: `P0`, `phase-1`, `frontend+backend`
- **Estimate**: 1
- **Depends-on**: PLT-02
- **Tugas**
  - [ ] Backend: `GET /api/profile` → display name, email, createdAt
  - [ ] Backend: `PATCH /api/profile` → update display name
  - [ ] Frontend: `Profile.tsx` — form edit nama, tampil email (read-only)
  - [ ] Ganti password: proxy ke gezytech
- **Acceptance**: User bisa edit display name, lihat email

---

# EPIC-5 — Payment Gateway (Phase 3)

## Issue PLT-40 — Midtrans Snap integration

- **Labels**: `P2`, `phase-3`, `backend`
- **Estimate**: 3
- **Depends-on**: PLT-20
- **Tugas**
  - [ ] Install `midtrans-client`
  - [ ] Buat `server/midtrans.ts` — generate Snap token
  - [ ] `POST /api/topup/midtrans` — return Snap token untuk popup
  - [ ] `POST /api/midtrans/webhook` — handle payment notification
  - [ ] Update status transaksi + balance auto-approve
  - [ ] Handle: settlement, pending, expired, deny
- **Acceptance**: User klik "Bayar" → Midtrans popup → bayar → saldo otomatis bertambah

---

# EPIC-6 — VPS Deploy (setelah MVP lokal selesai)

## Issue PLT-90 — Nginx: `platform.gezytech.com` → `:3004`

- **Labels**: `P2`, `vps`, `infrastructure`
- **Tugas**
  - [ ] Tambah vhost Nginx untuk `platform.gezytech.com`
  - [ ] Proxy `/api/` → `localhost:3004`
  - [ ] Serve static file dari `platform-app/dist/`
  - [ ] HTTPS via certbot
  - [ ] Firewall: hanya 22/80/443 terbuka

## Issue PLT-91 — systemd service untuk platform-app

- **Labels**: `P2`, `vps`, `infrastructure`
- **Tugas**
  - [ ] Buat `/etc/systemd/system/gezytech-platform.service`
  - [ ] Environment variables (PORT, DEV_MODE=false, GEZYTECH_URL, etc.)
  - [ ] Auto-restart on failure

---

# Roadmap (urutan rekomendasi)

```
PLT-00 (scaffold)
  └→ PLT-01 (database)
       └→ PLT-02 (SSO auth)
            ├→ PLT-10 (dashboard) ── bersamaan ──→ PLT-30 (profile)
            │     └→ PLT-11 (usage detail)
            │           └→ PLT-12 (pricing config)
            └→ PLT-20 (topup backend)
                  ├→ PLT-21 (topup UI)
                  └→ PLT-22 (billing)
                       └→ PLT-40 (Midtrans)
```

## Ringkasan Estimasi

| EPIC | Issues | Estimasi (jam) |
|------|--------|----------------|
| EPIC-1: Scaffold + Auth | PLT-00, 01, 02 | 4 |
| EPIC-2: Dashboard + Usage | PLT-10, 11, 12 | 5 |
| EPIC-3: TopUp + Billing | PLT-20, 21, 22 | 5 |
| EPIC-4: Profile | PLT-30 | 1 |
| EPIC-5: Midtrans | PLT-40 | 3 |
| EPIC-6: VPS Deploy | PLT-90, 91 | 2 |
| **Total** | **11 issues** | **~20 jam** |

## Definition of Done (MVP lokal)

- [ ] `platform-app/` scaffold + database + migration
- [ ] SSO auth (verify ke gezytech) + dev mode auto-login
- [ ] Dashboard: saldo + chart usage
- [ ] Usage detail: chart + tabel + filter range
- [ ] Pricing config
- [ ] Profile: view + edit
- [ ] TopUp manual: request → admin approve → balance update
- [ ] Billing: riwayat transaksi
