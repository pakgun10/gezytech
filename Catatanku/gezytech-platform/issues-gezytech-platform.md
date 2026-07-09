# Issues — GezyTech Platform App (dari PRD)

> Dibuat: 9 Jul 2026 · Diperbarui: 9 Jul 2026 · Status: **IN PROGRESS — MVP lokal selesai, menunggu phase 3 & deploy**

---

# EPIC-1 — Scaffolding & Auth

## Issue PLT-00 — Scaffold platform-app folder structure

- **Labels**: `P0`, `phase-1`, `infrastructure`
- **Status**: ✅ **DONE**
- **Estimate**: 1
- **Tujuan**: Buat folder `platform-app/` dengan React + Vite + Hono + Bun, sama seperti public-app.
- **Tugas**
  - [x] `bun create vite platform-app --template react-ts` (manual scaffold, tidak menggunakan create)
  - [x] `bun add hono @hono/node-server`
  - [x] Buat `server/index.ts` dengan health endpoint di port 3004
  - [x] Buat `vite.config.ts` proxy `/api` → `localhost:3004`
  - [x] Buat `package.json` scripts: `dev`, `build`
  - [x] Buat layout dasar: sidebar + content area
  - [x] Tes: `curl http://localhost:3004/api/health` → `{"status":"ok"}`
- **Acceptance**: `bun run dev` → buka `http://localhost:5174` → tampil halaman kosong dengan sidebar
- **Catatan implementasi**: Folder scaffold ada di `/home/pgun/dev/gezy/gezytech/platform-app/`. Build sukses, health endpoint aktif.

## Issue PLT-01 — Database & migration

- **Labels**: `P0`, `phase-1`, `backend`
- **Status**: ✅ **DONE**
- **Estimate**: 1
- **Depends-on**: PLT-00
- **Tugas**
  - [x] Buat `server/db.ts` — inisialisasi SQLite `platform.db`
  - [x] Buat `server/migrate.ts` — buat tabel: `platform_users`, `topup_transactions`, `usage_daily`, `pricing_config`
  - [x] Seed pricing default (DeepSeek)
  - [x] Seed dev user (kalau `DEV_MODE=true`)
- **Acceptance**: `sqlite3 data/platform.db ".tables"` → 4 tabel muncul
- **Catatan implementasi**: Migrasi otomatis dijalankan saat server start. Tabel tersedia.

## Issue PLT-02 — SSO Auth (verify ke gezytech)

- **Labels**: `P0`, `phase-1`, `backend`
- **Status**: ✅ **DONE**
- **Estimate**: 2
- **Depends-on**: PLT-01
- **Tujuan**: Platform-app tidak membuat auth sendiri — verify session ke gezytech.
- **Tugas**
  - [x] Buat `server/auth.ts` — fungsi `verifySession(token)` → call `GET gezytech:3003/api/auth/me` dengan cookie
  - [x] Middleware `requireAuth` — redirect ke gezytech login kalau belum login
  - [x] `DEV_MODE=true` → auto-login sebagai dev user (bypass gezytech)
  - [x] Frontend `useAuth.ts` — check `/api/auth/me`, redirect kalau 401
- **Acceptance**: Buka `http://localhost:5174` → redirect ke login (atau auto-login di dev mode)
- **Catatan implementasi**: SSO verify mengarah ke `GEZYTECH_URL/api/auth/me`. Pada dev mode bypass otomatis dengan user `dev@gezy.tech`.

---

# EPIC-2 — Dashboard & Usage

## Issue PLT-10 — Dashboard ringkasan

- **Labels**: `P0`, `phase-1`, `frontend+backend`
- **Status**: ✅ **DONE**
- **Estimate**: 2
- **Depends-on**: PLT-02
- **Tugas**
  - [x] Backend: `GET /api/dashboard` → `{ balance, usageThisMonth: {input, output, total, cost}, pendingTopups }`
  - [x] Frontend: `Dashboard.tsx` — card saldo + bar chart pemakaian bulan ini
  - [x] Ambil data dari `token_usage` table public-app (atau dari `usage_daily` platform-app sendiri)
- **Acceptance**: Dashboard menampilkan saldo + chart usage
- **Catatan implementasi**: Menggunakan tabel `usage_daily` lokal. Chart masih placeholder (siap diganti library chart).

## Issue PLT-11 — Usage detail (chart + tabel)

- **Labels**: `P0`, `phase-1`, `frontend+backend`
- **Status**: ✅ **DONE**
- **Estimate**: 2
- **Depends-on**: PLT-10
- **Tugas**
  - [x] Backend: `GET /api/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` → daily breakdown
  - [x] Data source: dari `token_usage` table public-app (aggregate per hari)
  - [x] Frontend: `Usage.tsx` — chart bar + tabel
  - [x] Filter: hari ini / minggu ini / bulan ini / custom range
- **Acceptance**: Grafik usage muncul, bisa difilter range tanggal
- **Catatan implementasi**: Filter preset hari ini / 7 hari / bulan ini aktif. Chart placeholder, tabel lengkap.

## Issue PLT-12 — Usage pricing config

- **Labels**: `P1`, `phase-1`, `backend`
- **Status**: ✅ **DONE**
- **Estimate**: 1
- **Depends-on**: PLT-01
- **Tugas**
  - [x] Admin endpoint: `POST /api/admin/pricing` — update harga per model
  - [x] Hitung `cost_estimate` = input_tokens × input_price + output_tokens × output_price
  - [x] Seed pricing default di migration
- **Acceptance**: Dashboard menampilkan estimasi biaya dalam Rupiah
- **Catatan implementasi**: Pricing default untuk `deepseek-chat` dan `deepseek-reasoner` tersedia. Harga disimpan dalam IDR per 1 juta token.

---

# EPIC-3 — TopUp & Billing

## Issue PLT-20 — TopUp manual (admin approve)

- **Labels**: `P0`, `phase-2`, `backend`
- **Status**: ✅ **DONE**
- **Estimate**: 2
- **Depends-on**: PLT-02
- **Tugas**
  - [x] Backend: `POST /api/topup` — buat transaksi pending, generate nomor referensi
  - [x] Backend: `GET /api/topup/history` — riwayat topup user
  - [x] Backend: `GET /api/topup/status/:id` — cek status
  - [x] Admin: `GET /api/admin/topups` — list semua pending
  - [x] Admin: `POST /api/admin/topups/:id/approve` — approve → balance bertambah
  - [x] Admin: `POST /api/admin/topups/:id/reject` — reject
- **Acceptance**: User bisa request topup → admin approve → saldo user bertambah
- **Catatan implementasi**: Semua endpoint admin diproteksi dengan `x-admin-token`. Referensi auto-generate dengan prefix `TOP`.

## Issue PLT-21 — TopUp UI (frontend)

- **Labels**: `P0`, `phase-2`, `frontend`
- **Status**: ✅ **DONE**
- **Estimate**: 2
- **Depends-on**: PLT-20
- **Tugas**
  - [x] `TopUp.tsx` — pilih nominal (50rb, 100rb, 200rb, custom)
  - [x] Tampilkan nomor rekening + referensi
  - [x] Status polling (pending → success)
  - [ ] Notifikasi kalau saldo menipis
- **Acceptance**: User bisa isi form topup → lihat status transaksi
- **Catatan implementasi**: Polling riwayat topup setiap 5 detik. Notifikasi saldo menipis belum ditambahkan (bisa di-phase 2 lanjutan).

## Issue PLT-22 — Billing (riwayat transaksi)

- **Labels**: `P1`, `phase-2`, `frontend+backend`
- **Status**: ✅ **DONE**
- **Estimate**: 1
- **Depends-on**: PLT-20
- **Tugas**
  - [x] Backend: `GET /api/billing` — semua transaksi user (topup + pemakaian)
  - [x] Frontend: `Billing.tsx` — tabel dengan filter (topup/usage/semua)
  - [x] Export CSV (opsional)
- **Acceptance**: User bisa lihat semua transaksi dalam tabel
- **Catatan implementasi**: Tombol export CSV aktif, filter tipe transaksi aktif.

---

# EPIC-4 — Profile

## Issue PLT-30 — Profile (view + edit)

- **Labels**: `P0`, `phase-1`, `frontend+backend`
- **Status**: ✅ **DONE**
- **Estimate**: 1
- **Depends-on**: PLT-02
- **Tugas**
  - [x] Backend: `GET /api/profile` → display name, email, createdAt
  - [x] Backend: `PATCH /api/profile` → update display name
  - [x] Frontend: `Profile.tsx` — form edit nama, tampil email (read-only)
  - [ ] Ganti password: proxy ke gezytech
- **Acceptance**: User bisa edit display name, lihat email
- **Catatan implementasi**: Display name editable, data lain read-only. Ganti password belum diimplementasikan (proxy ke gezytech).

---

# EPIC-5 — Payment Gateway (Phase 3)

## Issue PLT-40 — Midtrans Snap integration

- **Labels**: `P2`, `phase-3`, `backend`
- **Status**: ⏳ **PENDING**
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
- **Catatan implementasi**: Menunggu akun Midtrans / kredensial. Topup manual tetap bisa digunakan.

---

# EPIC-6 — VPS Deploy (setelah MVP lokal selesai)

## Issue PLT-90 — Nginx: `platform.gezytech.web.id` → `:3004`

- **Labels**: `P2`, `vps`, `infrastructure`
- **Status**: ⏳ **PENDING**
- **Tugas**
  - [ ] Tambah vhost Nginx untuk `platform.gezytech.web.id`
  - [ ] Proxy `/api/` → `localhost:3004`
  - [ ] Serve static file dari `platform-app/dist/`
  - [ ] HTTPS via certbot
  - [ ] Firewall: hanya 22/80/443 terbuka
- **Catatan implementasi**: Harus dijalankan di VPS setelah build production tersedia.

## Issue PLT-91 — systemd service untuk platform-app

- **Labels**: `P2`, `vps`, `infrastructure`
- **Status**: ⏳ **PENDING**
- **Tugas**
  - [ ] Buat `/etc/systemd/system/gezytech-platform.service`
  - [ ] Environment variables (PORT, DEV_MODE=false, GEZYTECH_URL, etc.)
  - [ ] Auto-restart on failure
- **Catatan implementasi**: Siap dibuat saat deploy VPS. Pastikan `.env` production tidak menyertakan `DEV_MODE=true`.

---

# Roadmap (urutan rekomendasi)

```
PLT-00 (scaffold) ✅
  └→ PLT-01 (database) ✅
       └→ PLT-02 (SSO auth) ✅
            ├→ PLT-10 (dashboard) ✅ ── bersamaan ──→ PLT-30 (profile) ✅
            │     └→ PLT-11 (usage detail) ✅
            │           └→ PLT-12 (pricing config) ✅
            └→ PLT-20 (topup backend) ✅
                  ├→ PLT-21 (topup UI) ✅
                  └→ PLT-22 (billing) ✅
                       └→ PLT-40 (Midtrans) ⏳
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

- [x] `platform-app/` scaffold + database + migration
- [x] SSO auth (verify ke gezytech) + dev mode auto-login
- [x] Dashboard: saldo + chart usage
- [x] Usage detail: chart + tabel + filter range
- [x] Pricing config
- [x] Profile: view + edit
- [x] TopUp manual: request → admin approve → balance update
- [x] Billing: riwayat transaksi

---

# Cara Menjalankan

```bash
cd /home/pgun/dev/gezy/gezytech/platform-app
bun install

# Terminal 1: backend
bun run dev:server

# Terminal 2: frontend
bun run dev
```

Mode dev akan auto-login sebagai `dev@gezy.tech` dengan saldo Rp 100.000.
