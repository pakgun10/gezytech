# Hivekeep / Gezy — Platform Agent AI Self-Hosted

> Dijelaskan 5 Juli 2026 — berdasarkan kode sumber `gezyhive`.

---

## Apa itu Hivekeep/Gezy?

**Hivekeep** (sekarang di-rebrand ke **Gezy**) adalah platform **self-hosted** untuk menjalankan **agen AI spesialis** yang bekerja untuk individu atau kelompok kecil. Bayangkan seperti punya tim asisten AI pribadi, masing-masing dengan keahlian, kepribadian, dan memori sendiri, semua berjalan di server kamu sendiri.

---

## Konsep Utama

```
┌─────────────────────────────────────────────────────────┐
│                    HIVEKEEP / GEZY                       │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Agent A │  │ Agent B │  │ Agent C │  │ Agent D │   │
│  │ (Guru   │  │ (Admin  │  │ (Coder  │  │ (Tutor  │   │
│  │  MTK)   │  │  Kantor)│  │  DevOps)│  │  Bahasa)│   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       │            │            │            │         │
│       └────────────┼────────────┼────────────┘         │
│                    │            │                       │
│              ┌─────┴─────┐ ┌───┴────┐                  │
│              │ Memory    │ │ Tools  │                  │
│              │ (SQLite   │ │ (Shell,│                  │
│              │  + vec)   │ │  File, │                  │
│              └───────────┘ │  Web)  │                  │
│                            └────────┘                  │
│  Satu proses • Satu file DB • Nol infrastruktur eksternal │
└─────────────────────────────────────────────────────────┘
```

---

## Fitur Utama

### 1. Multi-Agent dengan Identitas Persisten

Setiap Agent punya:

| Komponen | Deskripsi | Contoh |
|----------|-----------|--------|
| **Nama & Avatar** | Identitas visual | "Bu Anita" + foto guru |
| **Character / SOUL** | Kepribadian unik | "Kamu guru matematika yang sabar dan suka pakai analogi kehidupan sehari-hari" |
| **Expertise** | Keahlian spesifik | "Ahli kurikulum K13 dan Kurikulum Merdeka, spesialisasi SMP kelas 7-9" |
| **Memory** | Ingatan jangka panjang | Fakta, preferensi, keputusan tersimpan permanen — bisa di-search |
| **Model LLM sendiri** | Provider & model | Claude Sonnet 4, GPT-5, Gemini Flash, atau model lokal via Ollama |

### 2. Satu Session Berkelanjutan — No "New Chat"

Tidak seperti ChatGPT yang setiap "new chat" mulai dari nol:
- Agent punya **satu session kontinu** seumur hidup
- Agent mengingat **semua** percakapan sebelumnya
- Kalau history terlalu panjang → **auto-compacting**: meringkas percakapan lama (tidak menghapus)
- Memory extraction pipeline otomatis mengekstrak fakta penting ke long-term memory

### 3. Kolaborasi Antar-Agent

Agent bisa saling komunikasi seperti tim sungguhan:

```
Agent Guru MTK ──request──→ Agent Admin ──reply──→ Agent Guru MTK
                              │
                              └──inform──→ Agent Kepsek (one-way notification)
```

**Aturan komunikasi:**
- `request` = minta respons (target agent akan diproses)
- `inform` = one-way, tidak memicu turn LLM
- `reply` = SELALU `inform` — mencegah ping-pong loop tak berujung
- Rate-limited: max 3 request per task
- Timeout: 5 menit untuk respons

### 4. Delegasi Tugas — Sub-Agent Spawning

Agent bisa spawn "anak" untuk kerja paralel:

```
Agent Utama: "Buat RPP untuk semester ini"
  ├── spawn_self: Riset kurikulum terbaru (async)
  ├── spawn_self: Cari contoh soal UAN (async)
  └── spawn_self: Susun modul ajar per-bab (await → hasil diproses)
```

**Dua mode spawning:**

| Mode | Perilaku |
|------|----------|
| `await` | Parent menunggu hasil → dapat turn baru untuk memproses |
| `async` | Fire-and-forget, hasil dicatat sebagai informational |

**Kedalaman:** Maksimal 3 level (sub-agent bisa spawn sub-agent lagi).

### 5. Otomasi Terjadwal — Cron Jobs

```
"Setiap jam 7 pagi, cek kalender dan buat ringkasan rapat hari ini"
"Setiap Senin jam 8, generate laporan progress mingguan"
"Setiap tanggal 1, buat RPP bulanan sesuai silabus"
```

- Scheduler **in-process** (library croner) — tidak perlu cron system
- Agent-created crons **harus disetujui user** sebelum aktif
- Hasil cron bersifat **informational** (tidak mengganggu percakapan)
- Opsi `trigger_parent_turn` untuk membuat parent agent bereaksi terhadap hasil

### 6. Trigger Eksternal — Webhooks

```
GitHub push ──POST──→ Webhook ──→ Agent DevOps triase issue baru
WhatsApp msg ──────→ Channel ──→ Agent Asisten balas otomatis
Form online ───────→ Webhook ──→ Agent Admin catat ke spreadsheet
```

**Dispatch modes:**
- `conversation`: payload diinjeksi ke chat utama → agent langsung respons
- `task`: payload spawn sub-agent task (dengan template prompt)

### 7. Tools Bawaan yang Bisa Dipakai Agent

| Kategori | Tool | Fungsi |
|----------|------|--------|
| **File system** | `read_file`, `write_file`, `edit_file`, `multi_edit`, `list_directory`, `grep` | Baca/tulis/edit file di workspace agent |
| **Shell** | `run_shell` | Eksekusi command terminal (Python, Node, Bash, dll) |
| **Memory** | `memorize`, `recall`, `search_memories`, `forget` | Kelola ingatan jangka panjang |
| **Web** | `web_search`, `browse_url` | Cari informasi di internet |
| **Gambar** | `generate_image`, `list_image_models` | Generate gambar via DALL-E, Stable Diffusion, dll |
| **Kontak** | `add_contact`, `update_contact`, `list_contacts` | Kelola buku alamat |
| **Kolaborasi** | `send_message`, `reply`, `spawn_self`, `spawn_agent` | Kerja sama antar-agent |
| **Cron** | `create_cron`, `update_cron`, `delete_cron`, `list_crons` | Kelola jadwal otomatis |
| **Webhook** | `create_webhook`, `update_webhook`, `delete_webhook` | Kelola endpoint eksternal |
| **Vault** | `set_secret`, `get_secret`, `list_secrets` | Simpan API key/password terenkripsi |
| **Custom** | `create_custom_tool`, `write_custom_tool_file`, `run_custom_tool_setup` | Buat tool sendiri (Python, Node, Bash) |

---

## Arsitektur Teknis

| Layer | Teknologi |
|-------|-----------|
| **Runtime** | [Bun](https://bun.sh) — JavaScript/TypeScript runtime (cepat, all-in-one) |
| **Backend framework** | [Hono](https://hono.dev) — ringan, edge-ready |
| **Database** | **SQLite** (via `bun:sqlite`) — satu file, nol server |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) — type-safe queries |
| **Vector search** | `sqlite-vec` (KNN) + FTS5 (full-text) — hybrid search |
| **Authentication** | [Better Auth](https://better-auth.com) — HTTP-only cookie session |
| **LLM Provider** | Native: Anthropic, OpenAI, Google Gemini, DeepSeek, xAI, OpenRouter, Groq, Cerebras, dll |
| **Frontend** | React 19 + Vite + Tailwind CSS + shadcn/ui |
| **Real-time** | Server-Sent Events (SSE) — satu koneksi untuk semua agent |
| **Scheduler** | croner — in-process, no cron daemon |
| **Deployment** | **Satu Docker container** — semua dalam satu proses |

```
home-server:~$ docker run -p 3000:3000 gezy
→ Aplikasi jalan di http://localhost:3000
→ Semua data di satu file: data/gezy.db
→ Uploads di: data/uploads/
→ Workspaces di: data/workspaces/
→ Tidak perlu Redis, PostgreSQL, S3, cloud storage apapun
```

### Arsitektur Single-Process

```
┌────────────────────────────────────────────┐
│           DOCKER CONTAINER                 │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │         Bun Process                  │  │
│  │                                      │  │
│  │  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Hono API │  │  Cron Scheduler  │  │  │
│  │  │ (REST)   │  │  (in-process)    │  │  │
│  │  └────┬─────┘  └────────┬─────────┘  │  │
│  │       │                 │             │  │
│  │  ┌────┴─────────────────┴──────┐      │  │
│  │  │      Agent Engine           │      │  │
│  │  │  (Queue → LLM → Tools)      │      │  │
│  │  └────────────┬────────────────┘      │  │
│  │               │                       │  │
│  │  ┌────────────┴────────────────┐      │  │
│  │  │       SQLite                │      │  │
│  │  │  (data/gezy.db)             │      │  │
│  │  └─────────────────────────────┘      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Port 3000 ─── HTTP + SSE                  │
└────────────────────────────────────────────┘
```

---

## Kenapa Self-Hosted? (vs ChatGPT / Claude.ai)

| Aspek | ChatGPT / Claude.ai | Hivekeep / Gezy |
|-------|---------------------|-----------------|
| **Lokasi data** | Server OpenAI / Anthropic (US) | **Server kamu sendiri** |
| **Privasi** | Bisa dibaca provider (training) | **Enkripsi AES-256-GCM** untuk secrets |
| **Memory** | Per session, hilang saat new chat | **Persisten**, hybrid search (vector + FTS) |
| **Kustomisasi** | Prompt + Custom GPT | **Prompt + Tools + Cron + Webhook + Agent** |
| **Multi-agent** | ❌ Tidak ada | ✅ Kolaborasi, delegasi, komunikasi |
| **Tools** | Terbatas (browsing, code, image) | **Shell, file system, custom script, webhook** |
| **Biaya** | $20/bln (fixed) | **API key sendiri** — bayar per token pakai |
| **Vendor lock-in** | Terikat ke satu provider | **Provider-agnostic** — ganti model kapan saja |
| **Offline?** | ❌ Harus online | ❌ Juga harus online (LLM API) |

---

## Sistem Prompt Agent — Cara "Kepribadian" Dibangun

Setiap agent dibangun dari blok-blok prompt yang di-assemble otomatis:

```
┌─────────────────────────────────────────────┐
│ SYSTEM PROMPT                               │
│                                             │
│ 1. Identity — "Kamu adalah Bu Anita, guru  │
│    matematika SMP yang sabar dan humoris"    │
│ 2. Character — kepribadian, tone, gaya bicara│
│ 3. Expertise — pengetahuan, spesialisasi    │
│ 4. Tools — daftar tool yang tersedia        │
│ 5. Memory — fakta & preferensi yang diingat │
│ 6. Contacts — buku alamat (nama, platform)  │
│ 7. Current Context — waktu, project aktif   │
│ 8. Rules — batasan, etika, format output    │
│ 9. Other Agents — daftar agent lain (kolab) │
│ 10. Active Project — project yang sedang   │
│     dikerjakan (tiket, task)                │
│ 11. Channel Context — jika dari Telegram/WA │
│ 12. Vault Hints — nama secret (bukan isi!)  │
└─────────────────────────────────────────────┘
```

---

## Alur Kerja Agent (Queue → LLM → Tools → Loop)

```
Pesan masuk (user/agent/cron/webhook)
  │
  ▼
┌──────────────┐
│  QUEUE       │  FIFO per Agent, prioritas: user > otomatis
│  (SQLite)    │
└──────┬───────┘
       │ dequeue
       ▼
┌──────────────┐
│  BUILD       │  System prompt + memory + contacts + history
│  CONTEXT     │  Compacting jika token threshold terlampaui
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  LLM CALL    │  Streaming → token by token ke frontend via SSE
│  (streaming) │
└──────┬───────┘
       │
       ▼
┌──────────────┐   YES (tool_calls)
│  TOOLS?      │──────────────────┐
└──────┬───────┘                  │
       │ NO                       ▼
       ▼                   ┌──────────────┐
┌──────────────┐           │  EXECUTE     │  Parallel batch untuk
│  DONE        │           │  TOOLS       │  tools yang concurrency-
│  (response)  │           └──────┬───────┘  safe
└──────────────┘                  │
       │                          ▼
       │                   ┌──────────────┐
       │                   │  FEED RESULT │  Tool output → LLM
       │                   │  BACK TO LLM │  (loop sampai selesai)
       │                   └──────────────┘
       ▼
┌──────────────┐
│  COMPACTING  │  Jika token > threshold → ringkas history
│  + MEMORY    │  Ekstrak fakta baru → long-term memory
└──────────────┘
```

---

## Provider LLM yang Didukung (Built-in)

| Provider | Capabilities |
|----------|-------------|
| **Anthropic** (Claude) | LLM |
| **OpenAI** (GPT-4, GPT-5) | LLM + Embedding + Image |
| **Google** (Gemini) | LLM |
| **DeepSeek** | LLM |
| **xAI** (Grok) | LLM |
| **OpenRouter** | LLM (routing ke banyak model) |
| **Groq** | LLM |
| **Cerebras** | LLM |
| **Mistral** | LLM |
| **Cohere** | LLM |
| **Perplexity** | LLM + Search |
| **Brave** | Search |
| **SerpAPI** | Search |
| **Tavily** | Search |

> Bisa juga tambah provider sendiri via plugin SDK.

---

## Keamanan Data

| Data | Perlindungan |
|------|-------------|
| **API keys** | AES-256-GCM encrypted, tidak pernah muncul di prompt |
| **Password / token** | Disimpan di Vault, hanya bisa diakses via `get_secret()` |
| **Database** | Satu file SQLite di server sendiri |
| **Session** | HTTP-only cookie (Better Auth) |
| **Webhook** | SHA-256 token, constant-time comparison |
| **Redaction** | Secrets di-redact dari compacting (tidak masuk summary) |

---

## Use Case Nyata (dari file di `Catatanku/`)

| Use Case | File Terkait |
|----------|-------------|
| 📚 **Pembuatan RPP/Modul Ajar** | `1-rpp/` — template & contoh RPP Matematika, PAI, English |
| 🤖 **Bot Telegram** | `bottelegram.md`, `bottelegram-api-10.1.md` — integrasi bot Telegram |
| 📄 **Dokumen LaTeX/PDF** | `latex-dokumen.md`, `pdf-parse-fix.md` — generate & parse dokumen |
| 💬 **WhatsApp Group** | `whatsapp-grup.md` — integrasi WhatsApp |
| 🔐 **Provider LLM** | `provider.md` — setup Anthropic, OpenAI |
| 🖥️ **VPS Management** | `vps-bersih.md`, `pull+up_vps.md` — deploy & update |
| 📁 **File via Telegram** | `file-telegram.md` — upload/download file lewat bot |

---

## Kondisi Existing — Yang Sudah Dikembangkan & Berjalan

> Update: 5 Juli 2026 — berdasarkan riwayat commit, file catatan, dan konfigurasi VPS.

### Ringkasan Status

| Area | Status |
|------|--------|
| **Platform** | ✅ Berjalan di VPS (`aios.gezytech.web.id`) |
| **Rename Hivekeep → Gezy** | 🔄 Sedang berjalan (branch `main`, environment vars sudah `GEZY_*`) |
| **Agent aktif** | ✅ Minimal 2 agent: **Yefia** (asisten utama) dan agent lain |
| **Database development** | 📦 Kosong (4KB) — development/testing langsung ke VPS, bukan lokal |

### Channel Komunikasi

#### Telegram — ✅ Sangat Matang

| Fitur | Status |
|-------|--------|
| Bot polling + webhook | ✅ |
| Rich messages (HTML: bold, italic, code, table, list) | ✅ |
| **Streaming draft** (balasan muncul real-time seperti ChatGPT) | ✅ |
| LaTeX math di chat (`$...$` inline + block) | ✅ |
| File attachment (DOCX, PDF, gambar) | ✅ |
| Access control (allowlist, owner-only, grup) | ✅ |
| Forum topics (reply di topic yang benar) | ✅ |
| Typing indicator | ✅ |
| Channel handoff (satu bot, banyak agent) | ✅ |
| **2 bot aktif**: Yefia + satu lagi | ✅ |

> Bot Telegram menggunakan **custom API** (TelePost/TeleConversation) yang mendukung `sendRichMessage`, `sendRichMessageDraft`, dan LaTeX math rendering.

**Issue known:** Webhook URL kadang 404 — perlu sinkronisasi ulang.

#### WhatsApp-Web — ✅ Berjalan dengan Workaround

| Fitur | Status |
|-------|--------|
| QR pairing (link device) | ✅ |
| Text message + formatting native WA | ✅ |
| Media attachment (gambar, dokumen) | ✅ |
| Access control (allowlist, owner, grup) | ✅ |
| Grup mention (`@628xxx` text-based) | ✅ |
| Grup reply-to-bot | ✅ (sudah di-push, belum di-test E2E) |
| LID resolution | ⚠️ Workaround: tambah LID manual ke env |
| Streaming draft | ❌ Belum diimplementasi |
| Rich HTML | ❌ WA tidak support |

**Issue known:**
- LID mapping Baileys tidak fire → workaround manual
- Reply-to-bot di grup belum di-test end-to-end di VPS
- Mention by contact name (`@Nama`) tidak bisa — hanya detect digit nomor

### Generasi Dokumen

#### PDF — ✅ Production-ready

| Fitur | Status |
|-------|--------|
| Markdown → PDF | ✅ |
| LaTeX math → MathML (KaTeX) | ✅ |
| Via Playwright headless Chromium | ✅ |
| Tool `generate_pdf` | ✅ |
| Test E2E di VPS | ✅ (sudah verified) |

**Pipeline:** `Agent output (markdown + $LaTeX$) → MDAST walker + KaTeX MathML → HTML → Playwright page.pdf()`

#### DOCX — ✅ Production-ready

| Fitur | Status |
|-------|--------|
| Markdown → DOCX | ✅ |
| LaTeX math → **OMML native** (equation editable di Word!) | ✅ |
| SVG image di DOCX | ✅ |
| Tool `generate_docx` | ✅ |
| Test E2E di VPS | ✅ (103KB, equation bisa diedit) |

**Pipeline:** `Agent output → KaTeX MathML → mml2omml → Office Open XML → DOCX`

> Ini adalah pencapaian besar: LaTeX di DOCX muncul sebagai **equation Microsoft Word native** yang bisa diklik dan diedit, bukan gambar statis. Commit `12337317`.

#### TikZ / LaTeX gambar — ❌ Tidak didukung

`\begin{tikzpicture}` tidak dirender karena butuh TeX engine penuh. Alternatif: SVG (didukung di PDF + DOCX) atau `generate_image`.

### Integrasi Bot Telegram

**Dua bot aktif** melayani user via Telegram:

1. **Yefia** — asisten utama (tanya-jawab, generate dokumen, cron)
2. **Bot kedua** — untuk keperluan lain

**Kemampuan agent via Telegram:**
- Chat biasa (tanya jawab)
- Generate PDF/DOCX dengan LaTeX (kirim file langsung)
- Upload file via `attach_file` (RC-1 fixed: file attachment setelah streaming draft)
- Minta cron (agent buat, user approve via web)
- Channel handoff (pindah agent via Telegram command)

### Rencana / Sedang Dikerjakan

| Item | Status |
|------|--------|
| **Cron approval via Telegram** | 📋 Rencana (analisis selesai, `cron-approval-telegram.md`) |
| **Deploy terbaru ke VPS** | ⏳ Menunggu: `docker compose pull && up -d` |
| **Test WA reply-to-bot E2E** | ⏳ Butuh deploy terbaru |
| **Rename Hivekeep → Gezy** | 🔄 Multi-fase (lihat `rename-hivekeep-ke-gezy.md`) |
| **DOCX LaTeX ke OMML** | ✅ Sudah selesai |
| **WhatsApp streaming draft** | ❌ Belum direncanakan |

### Konfigurasi VPS

```yaml
# docker-compose.prod.yml (ringkasan)
services:
  gezy:
    image: ghcr.io/<user>/gezy:latest
    ports:
      - "3000:3000"
    environment:
      - PUBLIC_URL=https://aios.gezytech.web.id
      - OWNER_TELEGRAM_USER_ID=<id>
      - TELEGRAM_ALLOWED_USERS=<list>
      - OWNER_WHATSAPP_USER_ID=62<nomor>
      - GEZY_WHATSAPP_ALLOWED_USERS=62<nomor1>,62<nomor2>
      - GEZY_WHATSAPP_ALLOW_ALL_IN_GROUPS=false
      - WEB_BROWSING_HEADLESS_ENABLED=true
    volumes:
      - ./data:/app/data
```

**Deploy flow:**
1. Push ke GitHub → GitHub Actions build Docker image
2. SSH ke VPS → `docker compose pull && docker compose up -d --force-recreate gezy`

### Materi Pendidikan (RPP)

| File | Deskripsi |
|------|-----------|
| `1-rpp/template_RPP_1_lembar/RPP_1_Lembar_Template.docx` | Template RPP 1 lembar |
| `1-rpp/01-RPP-1-LEMBAR-MTK.docx` | Contoh RPP Matematika |
| `1-rpp/2_modulajar_pai.docx` | Contoh Modul Ajar PAI |
| `1-rpp/3_rpp_eng_helmi_Membaca_Memirsa_Fable.docx` | Contoh RPP English |
| `1-rpp/17_Model_modelpembelajaranMatematikaSMP.pdf` | Referensi model pembelajaran |
| `1-rpp/sintaks_model_pembelajaran.docx` | Referensi sintaks pembelajaran |

> **Status**: Materi sudah lengkap (template + contoh + referensi), tapi **agent belum disetup untuk membuat RPP secara otonom**. Ini adalah kandidat kuat untuk cron job berikutnya.

---

## Singkatnya

**Hivekeep/Gezy = "Sistem Operasi untuk Agen AI".**

1. **Install** satu Docker container di server/VPS/laptop
2. **Buat agen AI** dengan kepribadian dan keahlian berbeda — kayak rekrut karyawan
3. **Beri mereka tools** — file system, shell, web search, custom script
4. **Jadwalkan** (cron) atau trigger dari luar (webhook)
5. **Biarkan mereka kolaborasi** — satu riset, satu nulis, satu review
6. **Semua data tetap di server kamu** — bukan di cloud orang lain

Kayak punya **kantor virtual** yang isinya tim asisten AI, masing-masing jago di bidangnya, kerja 24/7, dan semua datanya aman di server sendiri.
