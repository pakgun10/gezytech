# Catatan Kondisi gezyhive — Status Pasca-Upgrade & Deployment VPS

> Dibuat: 2026-07-08
> Versi: 1.9.0
> Commit terakhir: `59a3246d` (35 file, +12,687/-19)
> Deploy: VPS `103.103.21.95:3001` (systemd, production)

---

## 1. Kondisi Saat Ini

### Server

| Item | Nilai |
|---|---|
| Lokasi | VPS `103.103.21.95` |
| Port | 3001 |
| Mode | `NODE_ENV=production` |
| Process manager | systemd (`gezyhive.service`) |
| Auto-restart | ✅ `Restart=on-failure` |
| Boot persistent | ✅ `systemctl enable` |
| Runtime | Bun 1.3.14 |
| Memory usage | ~211 MB |
| Database | SQLite (`./data/gezy.db`) |

### Agent

| Item | Nilai |
|---|---|
| Nama | Wati (sebelumnya Audrey) |
| ID | `d28b40db-9f1b-46e8-afe8-a7a01384ee71` |
| Model | `deepseek-v4-pro` |
| Provider | Testee (tipe DeepSeek) |
| Toolbox | All tools (285 tools) |
| Skills aktif | code-reviewer, git-committer (systematic-debugger nonaktif) |
| SOUL (character) | Kosong → default template aktif |
| Reasoning | DeepSeek V4 Pro (high effort) |

### Channel

| Platform | Status | Mode |
|---|---|---|
| Web UI | ✅ Aktif | `http://103.103.21.95:3001` |
| Telegram DM | ✅ Aktif | Bot `@watikubot`, hanya chat ID `6468143001` |
| Telegram Grup | ✅ Aktif | `onlyMentions=true` — hanya balas mention/reply |
| Discord | ❌ Belum dikonfigurasi | — |
| WhatsApp | ❌ Belum ada adapter | — |
| Slack | ❌ Belum ada adapter | — |

### Telegram Bot

| Item | Nilai |
|---|---|
| Bot username | `@watikubot` |
| Bot ID | `8163171059` |
| Vault key | `channel_telegram_1abb32f2-eb0f-401a-923e-28a089bda4b3_botToken` |
| Channel ID (DB) | `tel-wati-001` |
| allowedChatIds | `["6468143001"]` (DM only, grup tanpa filter) |
| onlyMentions | `true` (default — grup hanya balas mention/reply) |

---

## 2. Kelebihan (Strengths)

### Kapabilitas tool (285 tools, 17 kategori)

| Kapabilitas | Tools | LIVE tested |
|---|---|---|
| Code execution | `run_code` (Python/JS/shell, sandbox 30s-120s) | ✅ 4/4 tes |
| Mixture of Agents | `moa` (parallel/debate/vote, multi-model) | ✅ 3/3 tes |
| Computer use | 9 tools (screenshot, OCR, mouse, keyboard, scroll, dll) | ✅ 9/9 tes (laptop) |
| Skills system | 3 built-in (code-reviewer, git-committer, systematic-debugger) | ✅ 6/6 tes |
| SOUL editor | Tab UI, reset to default, preview, save terpisah | ✅ 6/6 tes |
| Browser automation | 15+ browser tools (navigate, click, type, screenshot, cookies) | Tidak diuji |
| File system | read/write/edit/grep/list, MAX_LINES 5000, spill 50KB | ✅ 3/3 tes |
| Memory | recall/memorize/forget, vector search (sqlite-vec) | Tidak diuji |
| Email | 10+ tools (list, read, send, triggers) | Tidak diuji |
| Calendar | 6 tools (list, create, update, delete events) | Tidak diuji |
| Contacts | 8 tools (CRUD, search, notes) | Tidak diuji |
| Vault (secrets) | 10+ tools (create, reveal, redact, search) | Tidak diuji |
| Tasks & delegation | spawn_self/spawn_agent, task monitoring | Tidak diuji |
| Cron | create/update/delete, trigger manual | Tidak diuji |
| Web search | web_search, browse_url, extract_links | Tidak diuji |
| TTS/STT | text_to_speech, transcribe_audio | Tidak diuji |
| Projects & tickets | CRUD projects, tickets, tags, knowledge | Tidak diuji |
| Mini apps | create/update/delete, file management, backend | Tidak diuji |

### Arsitektur

- **Cap output diperbaiki**: `toolResultSizeCapTokens` 50K, `read_file` MAX_LINES 5000, spill 50KB + preview 500 baris, tool result trim head+tail+landmark
- **Compacting tuning**: threshold 85%, keep 40%, keepMax 150K — fakta early conversation tidak hilang
- **PROTECTED_CORE_TOOLS**: 14 tool baru dilindungi dari DeepSeek 128-tool cap
- **Think tool guidance**: agent didorong pakai `think` untuk masalah sulit
- **Reasoning di channel**: Telegram `<blockquote>💭`, Discord `> 💭`
- **Skills prompt injection**: skill aktif diinjeksikan sebagai volatile block di system prompt
- **SOUL default template**: agent tanpa character custom otom dapat persona "thoughtful, step-by-step, honest"
- **Vite proxy env-configurable**: `VITE_PROXY_TARGET` untuk dev di port lain
- **Multi-locale**: 10 bahasa (en, fr, es, de, it, ja, pl, pt-BR, ru, zh-CN), 3314 keys

### vs gezyhd

| Dimensi | gezyhive | gezyhd |
|---|---|---|
| computer_use | ✅ 9 tools | ✅ (via Python backend) |
| code_execution | ✅ sandbox Python/JS/shell | ✅ (via Python backend) |
| moa | ✅ parallel/debate/vote | ❌ |
| Skills system | ✅ 3 skill + self-manage dari chat | ❌ |
| SOUL editor | ✅ UI tab + reset + preview | File config saja |
| Ekosistem | ~285 tools, 17 kategori | Terbatas (wrapper) |
| Multi-channel | Telegram, Discord, web | Tidak |
| Task delegation | ✅ spawn_self/spawn_agent | Tidak |
| Memory | ✅ vector search (sqlite-vec) | Tidak |
| UI | ✅ web dashboard | Electron app |
| Deployment | VPS + systemd | Desktop app |

---

## 3. Kekurangan (Weaknesses)

### Fungsional

| Kekurangan | Dampak | Solusi |
|---|---|---|
| `computer_use` tidak berfungsi di VPS headless | 7 tool (screenshot, OCR, mouse, keyboard, scroll) tidak bisa jalan di server tanpa GUI | VPS butuh X11/virtual display, atau jalankan di laptop/desktop |
| `video_gen` belum ada | Tidak bisa generate video | Issue I-70 — butuh API Runway/Veo/Kling |
| `computer_use` macOS belum didukung | Hanya Linux (X11) | Issue I-12 — butuh macOS machine |
| WhatsApp/Slack channel belum ada | Hanya Telegram + Discord | Perlu adapter baru |
| `moa` debate/vote belum LIVE tested dengan LLM | Hanya `parallel` yang sudah diuji LIVE | Jalankan tes 3.2/3.3 dengan LLM sungguhan |
| `git-committer` skill tidak bisa commit langsung | `run_code` sandbox terisolasi dari repo | Skill tetap benar format conventional commit, tapi eksekusi manual |
| `scroll` tool tidak terima parameter pixel | Click-based native, parameter custom diabaikan | By design — bukan bug |
| `focus_window` butuh match judul persis | "Terminal" tidak match, butuh judul asli jendela | By design — match-by-title |

### Operasional

| Kekurangan | Dampak | Solusi |
|---|---|---|
| Tidak ada HTTPS | URL `http://` (tidak aman untuk produksi) | Setup Nginx + Let's Encrypt |
| Typecheck butuh >150s di VPS | Laptop hang saat typecheck + server + browser bersamaan | Jalankan typecheck terpisah atau di laptop |
| `.env` tidak ikut rsync | API key, encryption key manual setup di VPS | Buat `.env` manual atau pakai secret manager |
| Encryption key berbeda antar mesin | Password hash dari laptop tidak valid di VPS | Set `ENCRYPTION_KEY` di `.env` atau reset password |
| Build Vite lama di VPS (resource terbatas) | Build >5 menit, kadang SIGHUP | Build di laptop, rsync `dist/` ke VPS |
| Telegram `allowedChatIds` untuk grup belum diset | Bot merespons semua pesan di grup (tanpa filter chat ID) | Tambahkan group chat ID ke `allowedChatIds` |
| DeepSeek 128-tool cap | 285 tools → 157 di-drop, hanya 128 dikirim | `PROTECTED_CORE_TOOLS` melindungi 14 tool kritis, sisanya di-drop |

### Pengujian

| Kekurangan | Dampak |
|---|---|
| 53 test failures (pre-existing) | `database migrations` + `deleteMessagesCascade` — bukan dari upgrade ini |
| 3 tes CLI ditunda (8.1, 8.3) | Typecheck + test suite belum dijalankan di VPS (laptop hang) |
| 2 tes channel skip (7.3, 7.4) | Telegram/Discord reasoning belum LIVE tested (sekarang Telegram sudah bisa) |
| Benchmark B1 side-by-side belum dijalankan | Belum ada perbandingan empiris gezyhive vs gezyhd di tugas identik |

---

## 4. Issues Tracker (19/21 selesai)

### Selesai (19 issues, ~55 story points)

| Epic | Issues | Status |
|---|---|---|
| EPIC-4 cap output | I-00✅, I-01✅, I-02✅, I-03✅(tidak perlu), I-04✅, I-05✅ | ✅ |
| EPIC-1 computer_use | I-10✅, I-11✅ | ✅ (Linux) |
| EPIC-2 code_execution | I-20✅ | ✅ |
| EPIC-3 moa | I-30✅, I-31✅ | ✅ |
| EPIC-5 skills | I-50✅, I-51✅, I-50b✅, I-50c✅ | ✅ |
| EPIC-6 SOUL | I-60✅, I-61✅ | ✅ |
| EPIC-8 reasoning | I-80✅, I-81✅, I-82✅ | ✅ |
| Bug fix | I-90✅, I-91✅ | ✅ |

### Tersisa (2 issues, ~8 story points)

| Issue | Bloker | Estimasi |
|---|---|---|
| I-70 `video_gen` | Butuh API key Runway/Veo/Kling | 5 SP |
| I-12 `computer_use` macOS | Butuh macOS machine | 3 SP |

---

## 5. File Dokumentasi

| File | Isi |
|---|---|
| `audit-kecerdasan-gezyhive.md` | Audit lengkap gezyhd vs gezyhive (sebelum upgrade) |
| `prd-kecerdasan-gezyhive.md` | PRD dengan semua requirements |
| `issues-kecerdasan-gezyhive.md` | 21 issues dengan status (19✅, 2 tersisa) |
| `bench-result.md` | Benchmark baseline + live findings |
| `bench-run-guide.md` | Panduan benchmark step-by-step |
| `pengujian-live.md` | 38 tes pengujian LIVE (33 LULUS, 2 SKIP, 3 TUNDA) |
| `pembersihan-pasca-uji.md` | Catatan file yang perlu dibersihkan pasca pengujian |
| `kondisi-gezyhive.md` | Dokumen ini — status lengkap |

---

## 6. Catatan Teknis

### Environment VPS

```bash
# Start server
sudo systemctl start gezyhive

# Stop
sudo systemctl stop gezyhive

# Restart
sudo systemctl restart gezyhive

# Log real-time
sudo journalctl -u gezyhive -f

# Status
sudo systemctl status gezyhive
```

### Environment Laptop (dev)

```bash
cd /home/pgun/dev/gezy/gezyhive
PORT=3001 VITE_PROXY_TARGET=http://localhost:3001 bun run dev
# UI: http://localhost:5173
```

### Build & deploy

```bash
# Di laptop
cd /home/pgun/dev/gezy/gezyhive
bun run build
rsync -avz dist/ pakgun@103.103.21.95:/home/pakgun/gezyhive/dist/

# Kalau ada perubahan server-side code:
rsync -avz src/server/ pakgun@103.103.21.95:/home/pakgun/gezyhive/src/server/

# Di VPS
sudo systemctl restart gezyhive
```

### Password reset (VPS)

```bash
cd /home/pakgun/gezyhive
ENCRYPTION_KEY=$(cat data/.encryption-key) bun -e '
import { hashPassword } from "better-auth/crypto";
const h = await hashPassword("PASSWORD_BARU");
console.log("HASH:", h);
'

sqlite3 data/gezy.db "UPDATE account SET password='HASH_BARU' WHERE user_id='v36vHD9PF9baStbaVTCIdvQ0rVAxSXtL' AND provider_id='credential';"
```

---

## 7. Rekomendasi Selanjutnya

| Prioritas | Item | Estimasi |
|---|---|---|
| P0 | HTTPS (Nginx + Let's Encrypt) | 1-2 jam |
| P1 | Benchmark B1 side-by-side (gezyhive vs gezyhd) | 2-3 jam |
| P1 | Set `allowedChatIds` untuk grup Telegram | 10 menit |
| P2 | Typecheck + test suite di VPS (atau laptop terpisah) | 30 menit |
| P2 | Enable systematic-debugger skill untuk Wati | 1 menit |
| P2 | I-70 `video_gen` | Butuh API eksternal |
| P3 | I-12 `computer_use` macOS | Butuh macOS |
| P3 | Discord channel setup | 30 menit |
| P3 | WhatsApp/Slack adapter | Butuh dev baru |

---

*Dokumen ini adalah snapshot kondisi gezyhive per 2026-07-08. Update setiap ada perubahan signifikan.*
