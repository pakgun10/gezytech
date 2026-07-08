# Audit Kecerdasan: `gezyhd` vs `gezyhive` — Bahan Peningkatan Kecerdasan Hivekeep

> **Status:** READ-ONLY audit. Tidak ada kode diubah. Dokumen ini adalah bahan kerja untuk meningkatkan kecerdasan `gezyhive` (Hivekeep) agar menyalip `gezyhd` (Hermes Agent Desktop).

---

## 0. Executive Summary

Perbandingan dilakukan dengan **provider dan model yang sama persis** (keduanya dijalankan author dengan model identik), sehingga variabel "model" dikontrol. Bedanya murni **arsitektur agent + pengelolaan konteks + kemampuan bertindak + orchestration multi-model**.

Tiga temuan teratas yang membuat `gezyhd` terasa lebih cerdas **dengan model sama**:

1. **Kemampuan bertindak nyata** — `gezyhd` punya `computer_use` (kontrol GUI desktop penuh), `code_execution` (sandbox), dan `moa` (Mixture of Agents). `gezyhive` tidak punya ketiganya (dikonfirmasi grep). Tanpa `computer_use`, agent tidak dapat benar-benar mengoperasikan mesin user, sehingga terasa hanya "berbicara" alih-alih "bekerja".
2. **Pemangkasan output yang agresif di `gezyhive`** — `toolResultSizeCapTokens=30000`, `toolCallArgsSizeCapTokens=8000`, `assistantContentSizeCapTokens=12000`, `userContentSizeCapTokens=16000` **selalu aktif** (`config.ts:308-338`). Output tool besar diubah jadi placeholder → agent kehilangan jejak pada tugas panjang. `gezyhd`/hermes-agent tidak memotong seagresif itu.
3. **Skills system + SOUL.md prominent** — `gezyhd` bisa install paket instruksi `SKILL.md` (`src/main/skills.ts`) dan punya persona `SOUL.md` prominent yang user lihat/edit. `gezyhive` punya `project-knowledge` & custom tools, tapi bukan "skills" sebagai paket instruksi siap pakai, dan persona (`agent.character`) kurang prominent.

**Catatan penting:** `gezyhive` sebenarnya **unggul** di banyak area — memori RAG hybrid (sqlite-vec + FTS5, multi-query, HyDE, rerank, consolidation, temporal decay), prompt caching split stable/volatile, jumlah tool family yang jauh lebih banyak, 6 channel adapter, sub-agents + inter-agent + crons. Kekurangannya hanya pada **kemampuan bertindak + orchestration + ketelitan konteks**.

Rekomendasi: implementasikan `computer_use` + `moa` + `code_execution` + pelunakan cap output. Fondasi teknisnya sudah ada di `gezyhive` (Playwright, terminal, multi-provider registry). Untuk **menyalip** `gezyhd`, tambahkan `video_gen` + skills system + SOUL.md prominent.

---

## 1. Metodologi

- Audit read-only: membaca `package.json`, dokumen arsitektur (`CLAUDE.md`, `prompt-system.md`), kode sumber utama (`src/main/*` `gezyhd`, `src/server/services/*` & `src/server/tools/*` `gezyhive`), dan `config.ts`.
- Konfirmasi kapabilitas via `grep` (mis. `computer_use` → `No matches` di `gezyhive`).
- Variabel model dikontrol (author menjalankan kedua sistem dengan provider+model identik), sehingga perbedaan disebabkan oleh engineering, bukan model.
- **Keterbatasan:** backend Python `hermes-agent` (NousResearch) yang menjadi inti kecerdasan `gezyhd` berada di repo terpisah (`HERMES_REPO`), tidak ada di proyek ini. Beberapa klaim soal reasoning loop asli `gezyhd` adalah **inferensi** dari wrapper TypeScript-nya (`hermes.ts`, `run-stream.ts`, `skills.ts`, `tools.ts`).

---

## 2. Arsitektur Kedua Sistem

| Aspek | `gezyhd` (Hermes Agent Desktop) | `gezyhive` (Hivekeep) |
|---|---|---|
| Jenis | Electron desktop app — **pembungkus** untuk Python backend `hermes-agent` (NousResearch) | Platform AI agent self-hosted (Bun + Hono + React + SQLite + Drizzle) |
| Lokasi "kecerdasan" | Di Python `hermes-agent` (`tui_gateway/server.py`, Runs API) + toolsets + `SOUL.md` + skills | Native TypeScript: `agent-engine.ts` (multi-step agentic loop, `runStreamStep`) + `prompt-builder.ts` (27 blok) |
| Transport | Multi-transport dengan fallback: tui gateway → runs API → chat completions → CLI (`hermes.ts` 3800+ baris) | Native `LLMProvider.chat()` streaming via `stream-runner.ts` |
| Memori | `MEMORY.md` + `USER.md` flat (delimiter `§`) | RAG hybrid (sqlite-vec KNN + FTS5) — **jauh lebih canggih** |
| Channels | Tidak ada (desktop-only) | 6 adapter: Discord, Telegram, WhatsApp, Slack, Signal, Matrix |
| Persona | `SOUL.md` (file prominent, editable) | `agent.character` / `agent.expertise` (block prompt) |

### 2.1 `gezyhd` adalah wrapper, bukan agent
Kode di `gezyhd/src/main/hermes.ts` (3800+ baris) hanya mengatur: transport (tui gateway, runs API, CLI fallback), streaming SSE, kredensial (`gatewayPrompt.ts`: `sudo.request`/`secret.request`), reasoning events (`run-stream.ts`: `reasoning.available`), tool progress, dan approval flow. **Logika kecerdasan (reasoning loop, tool execution, skills loading) ada di Python `hermes-agent` yang TIDAK ada di repo ini.** Implikasi: klaim soal "lebih cerdas" sebagian bersumber dari backend Python yang matang.

### 2.2 `gezyhive` punya agent-engine sendiri (TypeScript)
`agent-engine.ts` (~3300 baris) mengimplementasikan: antrian per-agent (FIFO), multi-step loop (`maxSteps`, default 0 = unlimited), context calibration, tool masking, compacting summary injection, streaming via `stream-runner.ts` (pre-narration guard — buffer text, drop jika step intermediate), signed thinking block re-injection, token usage tracking. Ini kode production-grade, bukan kalah secara arsitektur.

---

## 3. Penyebab Dominan (Model Dikontrol)

### 3.1 Kemampuan Bertindak: `computer_use`, `code_execution`, `moa` — tidak ada di `gezyhive`

Dari `gezyhd/src/main/tools.ts` `TOOLSET_DEFS` (19 toolset) + `i18n` + `messaging-platforms.ts`:

| Toolset | `gezyhd` | `gezyhive` | Catatan |
|---|---|---|---|
| `computer_use` | ✅ | ❌ (grep: `No matches`) | Kontrol GUI desktop penuh — mouse/keyboard/screenshot |
| `code_execution` | ✅ | ❌ (grep: `No matches`) | Sandbox eksekusi kode (bukan `run_shell` biasa) |
| `moa` (Mixture of Agents) | ✅ `"Coordinate multiple AI models together"` | ❌ | Orkestrasi multi-model → konsensus/komparasi |
| `video_gen` | ✅ | ❌ | Generasi video |
| `skills` (SKILL.md packs) | ✅ (`skills.ts`) | ❌ | Paket instruksi siap install |
| `web` / `browser` | ✅ | ✅ (`browse-tools`, `browser-session-tools`) | Setara |
| `terminal` / `shell` | ✅ | ✅ (`shell-tools`, `terminal-sessions`) | Setara |
| `file` / filesystem | ✅ | ✅ (`filesystem-tools`: read/write/edit/grep) | Setara |
| `vision` | ✅ | ⚠️ (via model, bukan toolset dedicated) | — |
| `memory` | ✅ (`MEMORY.md` flat) | ✅ (RAG hybrid — **unggul**) | — |
| `delegation` / sub-agents | ✅ | ✅ (`task-tools`, `subtask-tools`, `scout-tool`) | Setara |
| `todo` | ✅ | ✅ (`task-todos-tool`) | Setara |
| `clarify` | ✅ | ✅ (`human-prompt-tools`) | Setara |
| `cronjob` | ✅ | ✅ (`cron-tools` + learnings) | `gezyhive` **unggul** (cron learnings/journal) |
| `session_search` | ✅ | ✅ (`history-tools`) | Setara |

**Dampak psikologis terbesar: `computer_use`.** Saat agent bisa benar-benar menggerakkan kursor, klik, ketik, dan screenshot layar user, ia terasa "hidup" dan mampu — bahkan dengan model yang sama. `gezyhive` "hanya" bisa `run_shell` + filesystem + browser headless. Untuk tugas real-world (otomatisasi desktop, debugging GUI, scraping interaktif), gap ini krusial.

**`moa` dengan model sama tetap berguna:** menjalankan model yang sama beberapa kali dengan prompt/temperatur berbeda + synthesizer menghasilkan jawaban lebih konsisten & menangkap halusinasi — efek ensemble.

### 3.2 Pemangkasan Output Agresif di `gezyhive` (kandidat degradasi)

Dari `gezyhive/src/server/config.ts` — caps berikut **selalu aktif** (komentar eksplisit: "applied always, including with prompt caching enabled"):

```ts
toolResultSizeCapTokens:    Number(... ?? 30000),   // L308-310
toolCallArgsSizeCapTokens:  Number(... ?? 8000),     // L321 — per string field
assistantContentSizeCapTokens: Number(... ?? 12000), // L330
userContentSizeCapTokens:   Number(... ?? 16000),    // L338
```

Mekanisme: output tool > cap → di-placeholder-kan (DB tidak berubah, tapi payload ke LLM dipangkas). `agent-engine.ts:740-913` (`truncateToolResultValue`, `maskOldToolResults`) menumpuk pemangkasan lebih lanjut.

Skenario degradasi: tugas coding panjang → `read_file`/`run_shell`/`browse_url` mengembalikan output besar (log, file source) → di placeholder-kan jadi ringkasan pendek → langkah berikutnya agent **kehilangan konteks konkret** dan mengulang/menebak. Dengan model sama, `gezyhd`/hermes-agent mempertahankan output penuh → tetap "ingat". Ini kandidat kuat mengapa `gezyhive` "bertele-tele" atau "lupa" pada tugas panjang.

Note: spill-to-file sudah ada (`tool-output-spill.ts`, `spillThreshold=10000` byte) untuk persistensi ke disk, tapi **payload ke LLM tetap di-cap**. Spill hanya simpan ke file, bukan ringkasan kontekstual.

Parameter lain relevan:
- `compacting.thresholdPercent=75`, `keepPercent=25`, `keepMaxTokens=100000`, `triggerMaxTokens=300000` (`config.ts:216-247`) — riwayat di-summarize. Agresif tapi rasional.
- `historyMaxMessages=1000`, `historyTokenBudget=0` (disabled) (`config.ts:253-264`).
- `progressiveCompactionEnabled` default **false** (`config.ts:285`) — masking/observasi compaction progresif **mati** secara default. Alasannya: pipeline ini menulis ulang tool result lama tiap turn (intact → truncated → collapsed), yang byte-for-byte mengubah prefix dan **menginvalidasi prompt cache Anthropic**. Compacting service yang sebenarnya (summarize saat context mendekati threshold) tetap jadi mekanisme utama. Jadi ini BUKAN sumber kehilangan konteks aktif — sebaliknya, ini dimatikan demi cache. Dapat diaktifkan (`PROGRESSIVE_COMPACTION=1`) pada provider tanpa prompt caching.

### 3.3 Skills system (paket instruksi `SKILL.md`)

`gezyhd/src/main/skills.ts`:
- `listInstalledSkills`, `searchSkills` (via `hermes skills browse --json`), `installSkill`, `uninstallSkill`, `parseSkillFrontmatter`.
- Struktur direktori `skills/<category>/<skill-name>/SKILL.md`.
- Skill = paket instruksi/prosedur yang disuntik ke prompt saat relevan → menambah "keahlian" tanpa coding.

`gezyhive` punya `project-knowledge` (pinned + index, `search_project_knowledge`) dan custom tools, tapi bukan "skills" sebagai **paket instruksi siap install dari registry eksternal**. Konsepnya berbeda: project-knowledge = knowledge base ter- indeks; skills = prosedur operasional.

### 3.4 SOUL.md prominent + persona

`gezyhd/src/main/soul.ts`:
```ts
const DEFAULT_SOUL = `You are Hermes, a helpful AI assistant...
you think step-by-step and explain your reasoning...`;
```
`SOUL.md` adalah persona prominent, satu file yang user lihat & edit langsung. `gezyhive` pakai `agent.character` (prompt-builder block 5, `prompt-system.md:76`) — terstruktur, tapi kurang prominent di pengalaman user (terkubur di pengaturan agent).

### 3.5 Backend agent Python yang matang (inferensi)

`hermes-agent` (NousResearch) adalah framework agent production-grade: reasoning loop native, tool execution, approval flow (`sudo.request`/`secret.request`), multi-transport resilience. `gezyhive`'s `agent-engine.ts` juga production-grade, tapi hermes-agent kemungkinan punya prompt engineering reasoning/tool-discipline yang lebih halus (tidak bisa diverifikasi tanpa repo Python).

---

### 3.6 Temuan Benchmark Live (I-00) — akar masalah sebenarnya BUKAN M2

Benchmark live dengan DeepSeek `deepseek-v4-pro` di laptop (Ubuntu 24.04, 8GB, model sama persis) mengungkap bahwa **M2 (`toolResultSizeCapTokens=30000`) hampir tidak pernah terpicu** di praktik. Akar masalah sebenarnya adalah **dua layer pemotong yang bekerja SEBELUM M2**:

| Layer | Limit | Efek |
|---|---|---|
| **`read_file` MAX_LINES** | `2000` baris (`filesystem-tools.ts:15`) | File 65.000 baris → hanya 2000 baris masuk ke LLM. Baris 32500 **tidak pernah terlihat** agent. |
| **`tool-output-spill`** | `10.000 byte` / `200 baris preview` (`config.ts:497-498`) | Output tool > 10KB → disimpan ke file, hanya 200 baris preview yang masuk ke LLM. |
| **`toolResultSizeCapTokens`** (M2) | `30.000 token` (`config.ts:308`) | Cap pada pesan lama di history — **jarang terpicu** karena layer #1 dan #2 sudah memotong duluan. |

**Bukti live:**
- Probe-1 (sum 65.000 angka): Audrey jawab benar (298512500) — tapi karena dia pakai `run_shell` (awk), bukan karena `read_file` memberi seluruh isi file.
- Probe retensi (baris 32500 dari `secret.txt`): Audrey **gagal** — bilang "read_file hanya menampilkan 2000 baris pertama dari total 65.001 baris". Baris 32500 tidak pernah ada di konteksnya.

**Implikasi:**
- M2 tetap relevan untuk tool output besar yang TIDAK melalui `read_file` (mis. `run_shell` output, `browse_url`), tapi **bukan prioritas utama**.
- Prioritas sebenarnya: **naikkan `MAX_LINES`** (2000 → adaptif) dan **naikkan `spillThreshold`** (10KB → 50KB) + `previewLines` (200 → 500). Ini sudah diimplementasi sebagai I-04/I-05.

## 4. Apa yang Sudah Dimiliki `gezyhive` (jangan diregresi)

Ini adalah **keunggulan `gezyhive`** yang justru melampaui `gezyhd`. Saat menambah kapabilitas, pastikan tidak merusak ini:

1. **Memori RAG hybrid** (`config.ts:340-395`, `memory.ts`, `embeddings.ts`) — sqlite-vec KNN + FTS5 rank fusion, multi-query, HyDE, rerank, consolidation, temporal decay, adaptive-k. `gezyhd` hanya `MEMORY.md` flat. **Unggul jauh.**
2. **Prompt caching split stable/volatile** (`prompt-builder.ts`, `llm-cache-hints.ts`, `prompt-system.md`) — 27 blok, stable prefix + volatile `<system-reminder>` di last user message. Anthropic cache breakpoint optimal.
3. **Pre-narration guard** (`stream-runner.ts`) — buffer text step, drop jika step intermediate (`finishReason==tool-calls`). Mencegah "pre-narration" Opus yang menulis narasi sebelum tool_use.
4. **Signed thinking block re-injection** (`stream-runner.ts`) — reasoning continuity across tool loops.
5. **Adaptive thinking** (`config.ts:453-464`, `adaptiveThinking` default on) — Claude adaptive effort API.
6. **Jumlah tool family jauh lebih banyak**: email, calendar, contacts CRM, vault (AES-256-GCM), database, custom tools, webhooks, mini-apps (builder + backend services), MCP management, projects+tickets+knowledge.
7. **Sub-agents + inter-agent communication + crons + cron learnings** — delegasi, `spawn_self`/`spawn_agent`/`scout`, `request_input`, `report_to_parent`; inter-agent `send_message`/`reply`/`list_kins` rate-limited. `gezyhd` punya `delegation`/`todo` tapi tanpa inter-agent mesh.
8. **6 channel adapter** (Discord/Telegram/WhatsApp/Slack/Signal/Matrix) + channel streaming draft.
9. **Compacting + conversation history summaries** (`compacting.ts`) — summarize riwayat lama tanpa hapus asli, telescopic merge.

---

## 5. Rencana Peningkatan (Bahan Kerja)

Diprioritaskan berdasarkan dampak ke "kecerdasan terasa" / effort. Estimasi effort relatif.

### Tier 1 — Dampak Tinggi, Fondasi Sudah Ada

#### 5.1 `computer_use` — kontrol desktop penuh
- **Mengapa:** agent bisa benar-benar mengoperasikan mesin user → terasa "hidup". Gap paling besar vs `gezyhd`.
- **Fondasi yang ada:** `playwright` (dependency, `playwright-manager.ts`), `browser-session-tools.ts`, `xterm` terminal (`terminal-sessions.ts`), `bun-pty`.
- **Yang perlu dibangun:** tool family `computer-use`:
  - `screenshot` → capture layar (atau jendela) sebagai image, kembali sebagai `image` content block ke LLM (model vision).
  - `mouse_click(x,y)` / `mouse_move` / `mouse_drag`, `keyboard_type(text)` / `key_press(combo)`, `scroll`, `get_window_list`, `focus_window`.
  - Backend: Playwright untuk browser; untuk desktop native perlu lapisan OS (Desktop Automation via xdotool/wtype di Linux, atau node-native). Bun-pty bisa spawn perintah OS.
- **Lokasi registrasi:** `src/server/tools/computer-use-tools.ts` baru + `register.ts` (family `computer-use`).
- **Toolbox:** default disabled (destructive), opt-in via toolbox.
- **Effort:** Besar (perlu lapisan OS cross-platform), tapi nilai kecerdasan terasa = sangat tinggi.

#### 5.2 `moa` — Mixture of Agents
- **Mengapa:** ensemble multi-call dengan model yang sama / model berbeda → jawaban lebih konsisten & tangkap halusinasi. Diferensial `gezyhd`.
- **Fondasi:** multi-provider registry (`provider-registry.ts`, `src/server/llm/llm/*`), `LLMProvider.chat()`.
- **Yang perlu dibangun:** tool `moa(prompt, models?, strategy?)`:
  - Panggil N model paralel via `LLMProvider.chat()` (bisa model sama dgn temp berbeda, atau multi-model).
  - Synthesizer pass: model "judge" / "synthesizer" combine → final answer.
  - Strategi: `parallel` (gabung), `debate` (multiple round kritis), `vote` (majority).
- **Lokasi:** `src/server/tools/moa-tools.ts` + `register.ts` (family `moa`).
- **Effort:** Sedang. Nilai tinggi, terutama untuk tugas reasoning/analisis.

#### 5.3 `code_execution` — sandbox eksekusi kode
- **Mengapa:** model "berpikir via kode" untuk tugas logika/matematika/data. Saat ini `run_shell` ada tapi tanpa isolasi & tanpa capture output terstruktur.
- **Fondasi:** `mini-app-backend.ts` (sudah punya isolasi/permission/secret), `shell-tools.ts`, `bun-pty`.
- **Yang perlu dibangun:** tool `run_code(language, code, stdin?)` dengan:
  - Isolasi (sandbox/process limit), timeout, capture stdout/stderr/exit code terstruktur.
  - Bahasa: Python, JS/TS, shell, mungkin via Docker/exec seitan. Dapat mengeksekusi regresif.
- **Lokasi:** `src/server/tools/code-exec-tools.ts` + `register.ts` (family `code-execution`).
- **Effort:** Sedang (mini-app-backend bisa dijadikan dasar).

#### 5.4 Pelunakan cap output agar tidak kehilangan konteks saat tugas panjang
- **Mengapa:** kandidat degradasi #1 dengan model sama (§3.2).
- **Yang perlu:** audit pengaturan cap:
  - `TOOL_RESULT_SIZE_CAP_TOKENS` default 30000 → naikkan atau ganti strategi: **spill ke file + ringkasan kontekstual** (bukan placeholder generik). Saat ini `tool-output-spill.ts` spill ke file di 10k byte, tapi payload LLM tetap di-cap 30k token — perlu ringkasan konten spil ke LLM (mis. `head + tail + struktur` bukan placeholder metabrik).
  - Pertimbangkan: cap adaptif berdasarkan `contextWindow` model besar (1M context) — cap absolut 30000 token percuma di model besar.
  - Verifikasi `awareness` agent: saat output di-trim, beri baris indikator di reasoning.
- **Lokasi:** `config.ts:308-338`, `agent-engine.ts:700-913` (`truncateToolResultValue`, `summarizeToolResultValue`, `maskOldToolResults`), `tool-output-spill.ts`.
- **Effort:** Sedang. Nilai tinggi untuk tugas panjang. **Risiko:** token cost naik; perlu tetap cache-safe (kriteria stabil per message — sudah demikian).
- **Uji:** bandingkan tugas coding/data panjang sebelum/sesudah, model sama, hitung keberhasilan & langkah.

### Tier 2 — Dampak Menengah, Diferensial

#### 5.5 `video_gen`
- **Mengapa:** `gezyhd` punya, `gezyhive` tidak. Komplemen `image-tools.ts`.
- **Fondasi:** struktur provider primitive `image` (`src/server/llm/image/`); tambah `video`.
- **Yang perlu:** tool `generate_video(prompt, model?, duration?)`, `list_video_models`, provider adapter (Runway/Veo/Kling/Kuaishou dst.).
- **Effort:** Sedang-Besar (ada API eksternal).

#### 5.6 Skills system (paket instruksi `SKILL.md`)
- **Mengapa:** tambah keahlian tanpa coding; diferensial `gezyhd`.
- **Fondasi:** `project-knowledge` (`project-knowledge.ts`), custom tools (`custom-tools.ts`).
- **Yang perlu:** konsep **skill pack** = `SKILL.md` (instruksi/prosedur) + preconfigured tools bundle. Install dari registry (built-in + remote). Saat aktif & relevan, instruksi disuntik ke prompt (block baru di `prompt-builder.ts`, volatile).
- **Lokasi:** `src/server/services/skills.ts` baru, `src/server/tools/skill-tools.ts`, integrasi `prompt-builder.ts`.
- **Effort:** Sedang. Diferensial nyata.

#### 5.7 SOUL.md prominent
- **Mengapa:** persona hidup = terasa lebih "karakter"; diferensial pengalaman.
- **Yang perlu:** ekspos `agent.character` + `expertise` sebagai satu file prominent editable di UI (mirip `SOUL.md`), mungkin dengan default template reasoning-friendly ("you think step-by-step...").
- **Effort:** Kecil (UI + storage; sudah ada field DB).

### Tier 3 — Penyempurnaan Reasoning/Prompt

#### 5.8 Dorong penggunaan `think` tool untuk masalah sulit
- `think-tool.ts` sudah ada (port Claude Code ThinkTool). Tambahkan instruksi di prompt: "for hard problems, call `think` first". Tambah ke `## Tool calling discipline` (`prompt-builder.ts` block 4).
- **Effort:** Kecil.

#### 5.9 Tampilkan reasoning di channel (Telegram/Discord)
- `thinking-delta` sudah di-handle (`stream-runner.ts`); pastikan adapter channel bisa render reasoning (collapsed) → transparansi = terasa lebih cerdas.
- **Effort:** Sedang.

#### 5.10 Verifikasi compacting tidak terlalu agresif
- `thresholdPercent=75`, `keepPercent=25`. Pada window 1M, keep=250k — komentar `config.ts:228` sudah lowered 40→25. Audit: apakah summarizing menumpuk kehilangan fakta penting pada tugas multi-hari? Bandingkan dgn `gezyhd` yang pertahankan history penuh (flat MEMORY + session store).
- **Effort:** Sedang (analisa + tuning).

---

## 6. Ringkasan Prioritas Tabel

| # | Item | Dampak | Effort | Tier | Diferensial vs `gezyhd` |
|---|---|---|---|---|---|
| 5.1 | `computer_use` | Sangat tinggi | Besar | 1 | Gap paling besar |
| 5.4 | Pelunakan cap output (anti-loss context) | Tinggi | Sedang | 1 | Penyebab degradasi dengan model sama |
| 5.2 | `moa` | Tinggi | Sedang | 1 | Diferensial `gezyhd` |
| 5.3 | `code_execution` sandbox | Tinggi | Sedang | 1 | Diferensial |
| 5.5 | `video_gen` | Sedang | Sedang-Besar | 2 | Diferensial |
| 5.6 | Skills system | Sedang | Sedang | 2 | Diferensial |
| 5.7 | SOUL.md prominent | Sedang | Kecil | 2 | Pengalaman |
| 5.8 | Dorong `think` tool | Sedang | Kecil | 3 | Penyempurnaan |
| 5.9 | Reasoning di channel | Sedang | Sedang | 3 | Pengalaman |
| 5.10 | Audit compacting | Sedang | Sedang | 3 | Penyempurnaan |

**Untuk mengejar `gezyhd`:** selesaikan Tier 1 (5.1–5.4). **Untuk menyalip:** tambah Tier 2 (video_gen, skills, SOUL.md) + Tier 3.

---

## 7. Referensi File Kunci (untuk implementasi)

### `gezyhd` (referensi)
- `src/main/tools.ts` — definisi 19 toolset (TOOLSET_DEFS)
- `src/main/skills.ts` — skills system (install/list/browse SKILL.md)
- `src/main/soul.ts` — SOUL.md persona
- `src/main/memory.ts` — MEMORY.md/USER.md flat
- `src/main/hermes.ts` — transport (tui gateway/runs API/CLI), reasoning events
- `src/main/run-stream.ts` — Runs API parsing
- `src/main/gatewayPrompt.ts` — sudo/secret approval flow
- `src/main/default-models.ts` — seed model kuat
- `src/shared/messaging-platforms.ts` — `MESSAGING_TOOLSET_DEFINITIONS` (termasuk `moa`)

### `gezyhive` (target edit)
- `src/server/config.ts` — semua cap/threshold (L216-340 kompaktif, L308-338 size caps, L453-484 tools/llm)
- `src/server/services/agent-engine.ts` — agentic loop, `maskOldToolResults` (L774-913), `runStreamStep` wiring
- `src/server/services/stream-runner.ts` — per-step consumer, pre-narration guard, signed thinking
- `src/server/services/prompt-builder.ts` — 27 blok sistem prompt (sumber kebenaran block order)
- `src/server/services/llm-cache-hints.ts` — `buildSegmentedMessages` (cache breakpoint)
- `src/server/services/compacting.ts` — summarize riwayat
- `src/server/services/memory.ts` + `embeddings.ts` — RAG hybrid
- `src/server/services/playwright-manager.ts` — fondasi browser automation
- `src/server/services/mini-app-backend.ts` — isolasi/permission (dasar `code_execution`)
- `src/server/services/tool-output-spill.ts` — spill ke file
- `src/server/tools/register.ts` — sumber kebenaran tool inventory + family
- `src/server/tools/tool-helper.ts` — `tool()` helper
- `src/server/tools/shell-tools.ts`, `filesystem-tools.ts`, `browse-tools.ts` — pola implementasi
- `src/server/tools/think-tool.ts` — pola reasoning tool
- `src/server/llm/llm/*` — provider primitives (`LLMProvider.chat()`)

### Dokumen arsitektur `gezyhive` (wajib baca sebelum menyentuh area terkait)
- `prompt-system.md` — assembly 27 blok + toolsEnabled gate + sub-agent shape
- `compacting.md` — algoritma compacting + memory extraction
- `sse.md` — emit↔handle rules, sync-bug traps
- `api.md`, `schema.md`, `config.md`, `structure.md`, `files.md`, `queenie.md`

---

## 8. Risiko & Catatan Implementasi

1. **`computer_use` berbahaya** — kontrol desktop bisa hapus file/klik destructive. Default disabled, opt-in via toolbox, `destructive: true`, mungkin butuh approval flow (mirip `gatewayPrompt.ts`-nya `gezyhd`). Pertimbangkan dry-run + screenshot-preview sebelum aksi.
2. **Cap output & cache Anthropic** — perubahan kriteria trim harus tetap stabil per-message (cache-safe). Komentar `config.ts:308` sudah menjamin ini; pertahankan.
3. **`moa` cost** — N panggilan + synthesizer = N+1× token cost. Berikan budget control (`maxModels`, default 3) dan bisa pakai model murah untuk synthesizer.
4. **`code_execution` keamanan** — sandbox wajib (process/namespace isolation); jangan share filesystem workspace tanpa scope. Mini-app-backend punya permission model — adaptor.
5. **Jangan regresi keunggulan `gezyhive`** (§4) — terutama prompt caching, RAG hybrid, pre-narration guard.
6. **Backend Python `gezyhd` tidak bisa diverifikasi** — beberapa klaim reasoning loop asli adalah inferensi. Implementasi vs-nya tidak bisa di-copy langsung.

---

## 9. Langkah Validasi Berikutnya

Sebelum/ngeset implementasi, validasi hipotesis di `gezyhive` dengan model sama:
- [ ] Jalankan tugas panjang standar (mis. debug repo multi-file) di `gezyhive` vs `gezyhd`, model sama, hitung langkah & keberhasilan.
- [ ] Set `TOOL_RESULT_SIZE_CAP_TOKENS=0` (disable cap) → apakah `gezyhive` membaik pada tugas panjang? (isolasi variabel degradasi §3.2)
- [ ] Audit `resolveConfiguratorModel` Queenie — model apa yang benar-benar dipilih saat onboarding (pastikan bukan model lemah).
- [ ] Profil token context `gezyhive` vs `gezyhd` di tengah percakapan (kalibrasi `agent-engine.ts` sudah track `apiContextTokens`).

---

*Dokumen ini dibuat sebagai bahan kerja read-only. Implementasi harus dilakukan terpisah dengan commit bertahap, typecheck + test (`bun run typecheck && bun run test`) sebelum merge.*