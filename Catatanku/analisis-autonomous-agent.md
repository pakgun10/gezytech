# Analisis Kemampuan Autonomous Agent pada Hivekeep

> Audit dilakukan 5 Juli 2026 — berbasis kode sumber `gezyhive` tanpa modifikasi.

## Ringkasan

**Ya, bot/agent dalam aplikasi ini SUDAH memiliki banyak kemampuan autonomous.** Arsitekturnya dirancang secara eksplisit untuk mendukung agen yang beroperasi secara otonom melalui tiga mekanisme utama: **Cron Jobs (terjadwal)**, **Webhooks (trigger eksternal)**, dan **Sub-tasks (delegasi)**. Platform ini memiliki guardrails yang jelas untuk menjaga "human in the loop" tanpa sepenuhnya menghilangkan otonomi.

---

## 1. Mekanisme Autonomy yang Sudah Ada

### 1.1 Cron Jobs — Otonomi Terjadwal ✅

Seorang Agent dapat membuat cron job melalui tool `create_cron` yang tersedia di main session. Cron dieksekusi oleh scheduler in-process (croner).

**Cara kerja:**

1. Agent memanggil `create_cron(name, schedule, task_description, ...)`
2. Cron dibuat dengan status `requiresApproval: true` — **perlu disetujui user dulu**
3. Setelah disetujui, cron fire sesuai jadwal dan spawn sub-agent
4. Sub-agent mengeksekusi `task_description`, lalu memanggil `update_task_status("completed")`
5. **Default**: hasil bersifat **informational** — tidak memicu LLM turn pada parent agent
6. **Opsional**: `trigger_parent_turn: true` membuat parent agent "bangun" untuk bereaksi terhadap hasil

**Konfigurasi saat ini:**

| Parameter | Env Var | Default |
|-----------|---------|---------|
| Max active crons | `CRONS_MAX_ACTIVE` | 50 |
| Max concurrent executions | `CRONS_MAX_CONCURRENT_EXEC` | 5 |
| Server timezone | `GEZY_TIMEZONE` | system / UTC |

**Kesimpulan: Cron = otonomi terjadwal nyata, tapi dengan approval gate.**

---

### 1.2 Webhooks — Otonomi Trigger Eksternal ✅

Webhook adalah endpoint HTTP inbound (`/api/webhooks/incoming/:id`) yang memungkinkan layanan eksternal memicu agent.

**Dispatch modes:**

| Mode | Deskripsi |
|------|-----------|
| `conversation` | Payload diinjeksi ke main session agent → LLM turn |
| `task` | Payload spawn sub-agent task dengan template prompt |

**Fitur keamanan:**

| Mekanisme | Nilai |
|-----------|-------|
| Token secret | SHA-256, hanya ditampilkan sekali saat creation |
| Rate limit | 60 calls/menit per webhook |
| Max payload | 1 MB |
| Max per agent | 20 webhook |
| Filter payload | Simple (dot-path + allow-list) atau Advanced (regex) |

**Konfigurasi:**

| Parameter | Env Var | Default |
|-----------|---------|---------|
| Max per agent | `WEBHOOKS_MAX_PER_KIN` | 20 |
| Max payload | `WEBHOOKS_MAX_PAYLOAD_BYTES` | 1 MB |
| Rate limit | `WEBHOOKS_RATE_LIMIT_PER_MINUTE` | 60 |
| Log retention | `WEBHOOKS_LOG_RETENTION_DAYS` | 30 |

**Kesimpulan: Webhook = otonomi penuh, sistem eksternal bisa trigger agent kapan saja.**

---

### 1.3 Sub-tasks — Otonomi Delegasi ✅

Agent dapat mendelegasikan pekerjaan ke sub-agent melalui tool spawning.

| Tool | Deskripsi | Availability |
|------|-----------|-------------|
| `spawn_self` | Clone diri sendiri dengan misi spesifik | **main + sub-agent** |
| `spawn_agent` | Spawn agent lain sebagai sub-agent | **main + sub-agent** |

**Pola rekursif (router → worker):**

Sub-agent **bisa** spawn sub-agent lagi — `availability: ['main', 'sub-agent']`. Ini memungkinkan pola:

```
Agent utama → spawn researcher → researcher spawn sub-researchers → ...
```

Dibatasi oleh **max depth = 3** (dapat dikonfigurasi via `TASKS_MAX_DEPTH`).

**Dua mode spawn:**

| Mode | Perilaku |
|------|----------|
| `await` | Hasil child memicu **LLM turn baru** pada parent |
| `async` | Hasil bersifat informational, **tidak ada turn baru** |

**Konfigurasi:**

| Parameter | Env Var | Default |
|-----------|---------|---------|
| Max depth | `TASKS_MAX_DEPTH` | 3 |
| Max concurrent | `TASKS_MAX_CONCURRENT` | 10 |
| Max request_input | `TASKS_MAX_REQUEST_INPUT` | 3 |
| Max inter-agent requests | `TASKS_MAX_INTER_KIN_REQUESTS` | 3 |
| Inter-agent timeout | `TASKS_INTER_KIN_RESPONSE_TIMEOUT_MS` | 300000 (5 menit) |

**Kesimpulan: Task dapat membuat rantai delegasi berlapis (max 3 level).**

---

### 1.4 Inter-Agent Communication ✅

Tersedia di main session:

```
send_message({ slug, message, type: 'request' | 'inform' })
reply({ request_id, message })  // Selalu informational (no ping-pong)
list_kins()  // Discover agent lain
```

- `request` = mengharapkan respons, `inform` = one-way notification
- Rate-limited, max 3 request per task
- Timeout 5 menit untuk response
- `reply` selalu `inform` untuk mencegah ping-pong loop

---

## 2. Loop Autonomous yang Mungkin Terjadi

### 2.1 Cron + trigger_parent_turn + spawn_self = Self-Sustaining Loop 🔄

```
┌─────────────────────────────────────────────────────────┐
│  Cron fires → spawn sub-agent → selesaikan tugas        │
│       ↓ trigger_parent_turn = true                      │
│  Parent agent bangun → baca hasil → spawn task baru     │
│       ↓                                                 │
│  Task baru selesai (await mode) → parent dapat turn lagi│
│       ↓                                                 │
│  Parent bisa spawn lagi...                              │
└─────────────────────────────────────────────────────────┘
```

**Batasan:** Setiap langkah membutuhkan LLM call (biaya token), max depth 3 untuk rantai task, dan user tetap bisa mematikan cron kapan saja.

### 2.2 Webhook + Task Mode = Autonomous Pipeline 🔄

```
┌──────────────────────────────────────────────────────────┐
│  GitHub POST /api/webhooks/incoming/xxx                  │
│       ↓ dispatch: task                                   │
│  Sub-agent triages issue → spawn_self untuk riset        │
│       ↓ await mode                                       │
│  Parent menerima hasil → generate report                 │
│       ↓                                                  │
│  Post comment ke GitHub                                  │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Pola "Agent Swarm" 🔄

```
Agent A (orchestrator)
  → spawn Agent B (researcher)
      → spawn Agent C (analyst)
          → spawn Agent D (writer)
              ❌ max depth 3 tercapai
```

---

## 3. Guardrails & Safety Boundaries 🛡️

| # | Mekanisme | Guardrail | Hardcoded? | Bisa Dikonfigurasi? |
|---|-----------|-----------|-----------|---------------------|
| 1 | Agent-created crons | **Harus disetujui user** (`requires_approval`) | ✅ (di `createCron`) | ❌ |
| 2 | Task depth | Max 3 level (`TASKS_MAX_DEPTH`) | ❌ | ✅ |
| 3 | Inter-agent requests | Max 3 per task | ❌ | ✅ |
| 4 | Webhook rate limit | 60/menit per webhook | ❌ | ✅ |
| 5 | Cron concurrent exec | Max 5 (`CRONS_MAX_CONCURRENT_EXEC`) | ❌ | ✅ |
| 6 | Active crons | Max 50 (`CRONS_MAX_ACTIVE`) | ❌ | ✅ |
| 7 | User message priority | 100 vs agent 50 | ✅ (di `config`) | ❌ |
| 8 | Cron tasks | **Tidak bisa `prompt_human`** | ✅ (disabled in cron context) | ❌ |
| 9 | Inter-agent reply | Selalu `inform` (no ping-pong) | ✅ (di `replyTool`) | ❌ |
| 10 | Agent management tools | `HARD_EXCLUDED_FROM_SUBKIN` | ✅ (di `tasks.ts`) | ❌ |
| 11 | MCP admin tools | `HARD_EXCLUDED_FROM_SUBKIN` | ✅ (di `tasks.ts`) | ❌ |
| 12 | Custom tool admin | `HARD_EXCLUDED_FROM_SUBKIN` | ✅ (di `tasks.ts`) | ❌ |
| 13 | Cron admin tools | `HARD_EXCLUDED_FROM_SUBKIN` | ✅ (di `tasks.ts`) | ❌ |

### Daftar lengkap `HARD_EXCLUDED_FROM_SUBKIN`

Tools ini **tidak bisa dipanggil oleh sub-agent** (hanya main agent):

```
respond_to_task, cancel_task, list_tasks,
reply,
create_cron, update_cron, delete_cron, list_crons,
add_mcp_server, update_mcp_server, remove_mcp_server, list_mcp_servers,
create_custom_tool, write_custom_tool_file, run_custom_tool_setup,
test_custom_tool, update_custom_tool, delete_custom_tool, list_custom_tools,
create_tool_domain, update_tool_domain, delete_tool_domain,
create_agent, update_agent, delete_agent, get_agent_details
```

---

## 4. Apa yang TIDAK Bisa Dilakukan Secara Autonomous

| # | Kemampuan | Kenapa Tidak Bisa |
|---|-----------|-------------------|
| 1 | ❌ Agent menyetujui cron buatannya sendiri | `requires_approval` hardcoded, harus user |
| 2 | ❌ Agent membuat agent baru | `create_agent` di `HARD_EXCLUDED_FROM_SUBKIN` |
| 3 | ❌ Agent mengubah tool config miliknya sendiri | Tidak ada tool untuk self-modification |
| 4 | ❌ Agent mem-bypass approval gate | Hardcoded di `createCron` |
| 5 | ❌ Agent self-enqueue ke queue sendiri | Tidak ada mekanisme bawaan |
| 6 | ❌ Agent mengubah system prompt miliknya | Tidak ada tool untuk ini |
| 7 | ❌ Agent membuat provider AI baru | Tidak ada tool untuk ini |
| 8 | ❌ Sub-agent mengakses cron/webhook admin | `HARD_EXCLUDED_FROM_SUBKIN` |

---

## 5. Analisis Khusus: Bisakah Agent Membuat Skill Baru Secara Autonomous?

Pertanyaan kritis: **apakah agent bisa menciptakan kemampuan baru untuk dirinya sendiri tanpa campur tangan manusia?** Jawabannya **YA, dengan syarat** — dan ini adalah temuan yang perlu diperhatikan.

### 5.1 Dua Jenis "Skill" di Hivekeep

| Jenis Skill | Tool | Mekanisme |
|-------------|------|-----------|
| **Custom Tool** | `create_custom_tool` | Script dalam bahasa apapun (Python, Node, Bash, dll) yang dipanggil oleh LLM |
| **MCP Server** | `add_mcp_server` | Server eksternal via Model Context Protocol yang mengekspos sekumpulan tool |

### 5.2 Custom Tool: BISA Dibuat Tanpa Approval ⚠️

Tool `create_custom_tool` **tidak memiliki approval gate**:

```typescript
// src/server/tools/custom-tool-tools.ts, line 116
createdBy: 'agent',  // ← langsung active, tidak ada requires_approval
```

Custom tool yang dibuat langsung **aktif** dan bisa digunakan. Tidak seperti cron yang butuh `requires_approval`, custom tool tidak memiliki mekanisme persetujuan sama sekali.

**Syarat:** Hanya **main agent** yang bisa memanggil `create_custom_tool` (availability: `['main']`). Sub-agent **tidak bisa** — tool ini ada di `HARD_EXCLUDED_FROM_SUBKIN`.

### 5.3 MCP Server: BISA, Tapi Defaultnya Butuh Approval ✅

Tool `add_mcp_server` memiliki approval gate yang bisa dikonfigurasi:

```typescript
// src/server/tools/mcp-tools.ts, line 41
const status = config.mcp.requireApproval ? 'pending_approval' : 'active'
```

Default: **`MCP_REQUIRE_APPROVAL=true`** — server dibuat dalam status `pending_approval` dan tidak bisa digunakan sampai user menyetujui dari UI.

```bash
# Jika di-set false, agent bisa langsung menggunakan MCP server:
export MCP_REQUIRE_APPROVAL=false  # ⚠️ tidak direkomendasikan
```

### 5.4 Jalur Autonomous: Cron → trigger_parent_turn → Buat Skill 🔴

Inilah jalur lengkap bagaimana agent bisa **menciptakan skill baru secara autonomous**:

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: User menyetujui cron (ini satu-satunya human gate)      │
│    Cron: "0 */6 * * *" + trigger_parent_turn: true              │
│          ↓                                                        │
│ STEP 2: Cron fire → spawn sub-agent task                         │
│    Sub-agent (depth=1) melakukan pekerjaan rutin                 │
│          ↓                                                        │
│ STEP 3: Sub-agent selesai → panggil update_task_status()          │
│    Karena trigger_parent_turn: true                               │
│    → hasil di-enqueue ke main agent queue                         │
│          ↓                                                        │
│ STEP 4: Main agent BANGUN — dapat LLM turn penuh                 │
│    INI ADALAH MAIN AGENT TURN DENGAN AKSES PENUH                 │
│    → bisa panggil create_custom_tool() ← NO APPROVAL NEEDED      │
│    → bisa panggil write_custom_tool_file()                        │
│    → bisa panggil run_custom_tool_setup()                         │
│          ↓                                                        │
│ STEP 5: SKILL BARU AKTIF 🆕                                       │
│    Agent sekarang punya kemampuan baru: custom_<slug>             │
│    Langsung bisa dipakai di turn berikutnya                       │
│          ↓                                                        │
│ STEP 6: Agent bisa spawn sub-agent dengan toolbox baru            │
│    Yang mencakup custom tool yang baru dibuat                     │
│    → self-improving agent loop                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 5.5 Workflow Pembuatan Skill oleh Agent

```typescript
// Agent memanggil create_custom_tool:
create_custom_tool({
  slug: "weather_fetcher",
  name: "Weather Fetcher",
  description: "Fetch current weather for a given city",
  parameters: '{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}',
  language: "python",
  code: `
import json, sys
import requests

def main():
    args = json.loads(sys.stdin.read())
    city = args["city"]
    resp = requests.get(f"https://api.weather.example/{city}")
    print(json.dumps(resp.json()))

if __name__ == "__main__":
    main()
  `.trim(),
  domainSlug: "custom"
})
// → Tool "custom_weather_fetcher" LANGSUNG AKTIF

// Kemudian agent menulis dependensi:
write_custom_tool_file({
  slug: "weather_fetcher",
  path: "requirements.txt",
  content: "requests==2.31.0"
})

// Dan install:
run_custom_tool_setup({ slug: "weather_fetcher" })
// → pip install -r requirements.txt

// Skill siap digunakan.
```

### 5.6 Batasan dan Mitigasi

| Batasan | Detail |
|---------|--------|
| Harus main agent | Sub-agent/cron-task tidak bisa create tool |
| Perlu cron + trigger_parent_turn | Butuh mekanisme untuk "membangunkan" main agent |
| Cron harus disetujui user dulu | Human gate tetap ada di awal |
| Tool new butuh toolbox | Custom tool harus dimasukkan ke toolbox agar bisa dipakai |
| Tidak bisa self-modify prompt | Agent tidak bisa ubah karakter/soul sendiri |

### 5.7 Kesimpulan Skill Creation

| Kemampuan | Tanpa Approval? | Via Autonomous Path? |
|-----------|:---:|:---:|
| Buat custom tool (skill script) | ⚠️ **YA** | ✅ (cron → trigger_parent_turn) |
| Tulis kode custom tool | ⚠️ **YA** | ✅ |
| Install dependencies | ⚠️ **YA** | ✅ |
| Test custom tool | ⚠️ **YA** | ✅ |
| Update custom tool | ⚠️ **YA** | ✅ |
| Hapus custom tool | ⚠️ **YA** | ✅ |
| Buat MCP server | ✅ (default butuh approval) | ✅ (jika MCP_REQUIRE_APPROVAL=false) |

**⚠️ Custom tool creation adalah celah terbesar dalam arsitektur otonomi Hivekeep.** Tidak seperti cron (butuh approval) dan MCP server (default butuh approval), custom tool bisa dibuat langsung oleh main agent tanpa mekanisme persetujuan apapun. Jika dikombinasikan dengan `trigger_parent_turn` pada cron yang sudah disetujui, agent bisa menambah kemampuannya sendiri secara autonomous.

---

## 6. Risk Assessment

### Risiko Rendah 🟢

| Risk | Mitigasi yang Sudah Ada |
|------|------------------------|
| Agent menjadwalkan diri sendiri | Cron approval gate |
| Infinite recursion | Max depth 3 |
| Webhook abuse eksternal | Rate limiting + token secret |

### Risiko Menengah 🟡

| Risk | Detail | Mitigasi |
|------|--------|----------|
| Token burn loop | `trigger_parent_turn` pada cron sangat sering | Gunakan cron dengan interval minimal 1 jam |
| Mass spawning | Agent spawn 10 concurrent × 10 sub-spawn × 10 sub-sub-spawn | Kurangi `TASKS_MAX_CONCURRENT` |
| No cost cap | Tidak ada budget/cost tracking yang auto-stop | Pantau `llm_usage` table secara manual |

### Risiko Tinggi 🔴

| Risk | Detail | Kenapa Belum Ada |
|------|--------|-----------------|
| **Loop detection antar-agent** | Dua agent saling `request` tanpa henti | Max 3 request per task membatasi dalam task, tapi tidak di main session |
| **No kill switch otomatis** | Tidak ada anomaly detection (high token, rapid spawn) | Harus manual via UI/API |
| **Potensi 1000+ sub-agent** | 10 concurrent × 10 spawn × 10 depth = 1000 potential | Max depth 3 membantu, tapi concurrent bisa tinggi |
| **Self-improving agent** | Agent bisa buat custom tool via cron → trigger_parent_turn tanpa approval | Tidak ada approval gate untuk `create_custom_tool` — lihat §5 |

---

## 7. Rekomendasi Konfigurasi untuk Otonomi Terkendali

### Untuk Produksi (Safety-First):

```bash
# Batasi kedalaman task lebih ketat
export TASKS_MAX_DEPTH=2

# Kurangi concurrent tasks
export TASKS_MAX_CONCURRENT=5

# Batasi inter-agent requests
export TASKS_MAX_INTER_KIN_REQUESTS=2

# Kurangi webhook rate limit
export WEBHOOKS_RATE_LIMIT_PER_MINUTE=10

# Kurangi max active crons
export CRONS_MAX_ACTIVE=10

# Kurangi concurrent cron executions
export CRONS_MAX_CONCURRENT_EXEC=2
```

### Untuk Eksperimen (Longgar):

```bash
export TASKS_MAX_DEPTH=4
export TASKS_MAX_CONCURRENT=15
export CRONS_MAX_ACTIVE=30
export CRONS_MAX_CONCURRENT_EXEC=8
```

---

## 8. Praktik Terbaik

### 🎯 Model Selection
- **Gunakan model murah** (GPT-4o-mini, Claude Haiku, Gemini Flash) untuk cron agent
- **Model flagship** (Claude Sonnet 4, GPT-5) hanya untuk main conversation agent
- Autonomous task tidak selalu butuh reasoning depth

### 🔧 Toolboxes
- **Batasi tool surface** cron task dengan toolboxes spesifik
- Cron harian tidak perlu akses ke `create_cron`, `send_message`, dll
- Gunakan toolbox seperti `code`, `research`, `ops` sesuai kebutuhan

### ⏱️ Cron Interval
- `trigger_parent_turn: true` hanya untuk cron dengan interval ≥ 1 jam
- Cron per menit harus menggunakan mode async penuh
- Self-calibrating cron (trigger_parent_turn) mahal — gunakan bijak

### 📊 Monitoring
- Pantau dashboard **Tasks** & **Crons** secara berkala
- Periksa `llm_usage` table untuk tracking token consumption
- Set notifikasi jika ada task gagal berturut-turut

---

## 9. Kesimpulan

**Hivekeep sudah dirancang sebagai platform agent autonomous.** Kemampuan otonominya cukup matang:

| Dimensi | Status |
|---------|--------|
| Scheduled execution (cron) | ✅ Matang |
| External trigger (webhook) | ✅ Matang |
| Task delegation (sub-task) | ✅ Matang |
| Inter-agent collaboration | ✅ Matang |
| Approval gate | ✅ Matang |
| Depth limiting | ✅ Matang |
| Loop detection | ⚠️ Parsial |
| Skill creation gate (custom tools) | ❌ Tidak ada |
| Cost/budget control | ❌ Belum ada |
| Anomaly detection | ❌ Belum ada |

**Filosofi platform:** *"Biarkan agent bekerja mandiri, tapi jangan biarkan mereka lepas kendali."*

**Gap keamanan prioritas tinggi:**
1. **Skill creation tanpa approval** 🔴 — Agent bisa membuat custom tool baru tanpa persetujuan user via cron → trigger_parent_turn. Tidak ada approval gate sama sekali untuk `create_custom_tool`.
2. **Loop detection antar-agent** — Tidak ada deteksi loop eksplisit; bisa di-mitigasi dengan `TASKS_MAX_INTER_KIN_REQUESTS`
3. **Global token/cost cap** — Tidak ada mekanisme yang menghentikan agent dari konsumsi token tak terbatas
4. **Anomaly detection** — Tidak ada deteksi otomatis untuk perilaku agent abnormal (rapid spawning, high token usage, repeated failures)

Keempat gap di atas perlu diwaspadai dan di-mitigasi melalui konfigurasi ketat serta monitoring manual.
