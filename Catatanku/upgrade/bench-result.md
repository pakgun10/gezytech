# Benchmark Baseline (I-00) — Hasil & Rekomendasi

> **Status:** SCAFFOLD SIAP-JALAN. Bagian Setup + spek benchmark + perintah + SQL pengukuran sudah lengkap. **Hanya tabel hasil + analisis + rekomendasi yang HARUS Anda isi setelah run** (angka TIDAK boleh dibuat-buat). Sumber protokol: PRD §6.2 + issues `issues-kecerdasan-gezyhive.md` I-00.

## Tujuan
Konfirmasi hipotesis M2 (cap output `toolResultSizeCapTokens` menyebabkan kehilangan konteks pada tugas yang butuh tool output besar), dengan **provider & model sama** untuk `gezyhive` vs `gezyhd`. Sebelum/sesudah perbaikan I-01/I-02.

## Setup (harus identik antar perlakuan)
- Provider: DeepSeek
- Model: `deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-chat`
- `gezyhive` commit: __________ (catat `git -C gezyhive rev-parse --short HEAD` sebelum run)
- `gezyhd` / hermes-agent versi: 001-gezy
- Mesin (OS/RAM): Ubuntu 24.04 / 8GB
- Tanggal: 07-07-2026
- DB gezyhive: `./data/gezy.db` (default `${GEZY_DATA_DIR ?? './data'}/gezy.db`; override via `GEZY_DATA_DIR`/`DB_PATH`)
- Agent di `gezyhive`: pakai **1 Agent yang sama** di tiap perlakuan, model = `deepseek-v4-pro`. Pastikan provider DeepSeek + model sudah ter-config (Queenie onboarding selesai) DAN tool `read_file`, `run_shell`, `search` tersedia di toolbox agent.

---

## Prep — build materi benchmark SEKALI (deterministik, reproducible)

Jalankan generator ini di luar repo `gezyhive` (mis. `~/bench-gezy/`). Buat sekali; file yang sama dipakai semua perlakuan biar hanya variabel cap yang beda.

### 1) Folder bench + Probe-1/2 (single **large** tool output — inti M2)
```bash
mkdir -p ~/bench-gezy && cd ~/bench-gezy
cat > bench-gen.ts <<'TS'
// Generate a ~256KB file of integers (one per line) -> forces a single
// read_file result that exceeds the 30k-token keep-window cap.
import { writeFileSync } from 'node:fs'
const N = 65000                       // ~ lines
let sum = 0n
const out: string[] = []
for (let i = 0; i < N; i++) {
  // pseudo-random but deterministic per index
  const v = ((i * 1103515245 + 12345) % 9000) + 100 // 100..9099
  sum += BigInt(v)
  out.push(`${v}`)
}
writeFileSync('numbers.txt', out.join('\n') + '\n', 'utf8')
writeFileSync('numbers.expected.txt', `${sum}\n`, 'utf8')
console.log('wrote numbers.txt', out.join('').length, 'chars; expected sum=', sum.toString())
TS
bun bench-gen.ts
# Catat angka sum yang tercetak (untuk verifikasi jawaban agent):
# EXPECTED_SUM = __________
```
> `numbers.txt` ≈ 300KB ≈ 80k token → pasti lebih besar dari cap 30000 (dan 60000), jadi perbedaan cap-on vs cap-off menampakkan diri. Kunci sum tersebut sebagai `EXPECTED_SUM` - itu angka yang HARUS agent hasilkan.

### 2) Probe-3 (general capability, cap-agnostik) - repo kecil bug-fix
```bash
cd ~/bench-gezy && mkdir -p probe3 && cd probe3
cat > package.json <<'JSON'
{ "name":"probe3","version":"1.0.0","type":"module","scripts":{"test":"bun test"}}
JSON
cat > maxvalue.ts <<'TS'
// Find the largest integer in `arr`. (DELIBERATE BUG: returns the min.)
export function maxValue(arr: number[]): number {
  return arr.reduce((m, v) => (v < m ? v : m), arr[0] ?? 0)
}
// Decoys kept so a single `grep maxValue` lands on >1 line; the real one
// above is what the tests exercise.
export function _maxValueUnused(arr: number[]): number { return arr.length ? Math.max(...arr) : 0 }
TS
cat > maxvalue.test.ts <<'TS'
import { test, expect } from 'bun:test'
import { maxValue } from './maxvalue'
test('maxValue basic', () => {
  expect(maxValue([3, 1, 4, 1, 5])).toBe(5)
  expect(maxValue([2, 2])).toBe(2)
  expect(maxValue([-1, -5, -3])).toBe(-1)
  expect(maxValue([42])).toBe(42)
})
TS
bun test || true     # at this point: should FAIL (bug present) — confirms baseline
# Expected post-fix: `bun test` -> 1 pass / 0 fail.
```
> Probe-3 bertujuan kontrol: memastikan perubahan cap TIDAK merusak tugas normal. Sukses = `bun test` hijau.

---

## Prompt yang dikirim ke agent (identik tiap perlakuan)

> Workspace agent `gezyhive` = `~/bench-gezy` agar `read_file`/`run_shell` bisa akses `numbers.txt` & `probe3/`. Bila tidak bisa, mount file ke workspace agent atau pakai workspace path yang sudah ada dan sesuaikan prompt.

**Probe-1 (satu kali):**
```
Tolong baca SELURUH isi file ~/bench-gezy/numbers.txt dengan satu pemanggilan tool read_file, lalu hitung jumlah (sum) semua bilangan bulat di dalamnya. Jawab HANYA angka sum-nya, tanpa penjelasan.
```
- **Kunci benar**: = `EXPECTED_SUM` (dari generator). Sukses = angka cocok.
- Catat juga berapa kali agent memanggil `read_file`/grep atas numbers.txt ( repetisi karena konteks hilang).

**Probe-2 (retensi, ~2 turn setelah Probe-1):**
Kirim 1-2 turn pengisi lalu:
```
Berapa sum yang kamu hitung dari numbers.txt barusan? Jawab HANYA angkanya, tanpa membaca file lagi.
```
- Sukses = menjawab angka benar **tanpa** memanggil read_file/grep ulang (retention).

**Probe-3 (di sesi berbeda, cap-relevan tidak):**
```
Di folder ~/bench-gezy/probe3/, tes di maxvalue.test.ts gagal. Baca kode maxvalue.ts, temukan bug, perbaiki, lalu jalankan `bun test` sampai hijau. Beri tahu hasil test akhir.
```
- Sukses = `bun test` 1 pass / 0 fail.

---

## Cara menjalankan 5 perlakuan (provider & agent yang sama tiap run)

> Setiap perlakuan: restart server dengan env cap berbeda, kirim prompt yang sama, catat hasil. Pakai model `deepseek-v4-pro` di agent `gezyhive` dan `deepseek-v4-pro` di `gezyhd` agar adil.

```bash
cd /home/pgun/dev/gezy/gezyhive

# [PENTING] pastikan tidak ada antrian agent dari run sebelumnya:
#   hapus workspace queue / gunakan agent baru bila perlu.

# A) cap-ON default 30000 (cabang saat ini — SUDAH termasuk fix I-01 head+tail)
TOOL_RESULT_SIZE_CAP_TOKENS=30000 bun src/server/index.ts
# B) cap-ON naik ke 60000 (simulasi I-02)
TOOL_RESULT_SIZE_CAP_TOKENS=60000 bun src/server/index.ts
# C) cap-OFF (validasi cepat M2)
TOOL_RESULT_SIZE_CAP_TOKENS=0      bun src/server/index.ts
# D) gezyhd (kontrol) — jalankan hermes-desktop DeepSeek/deepseek-v4-pro, prompt sama.
#    [ADJUST path/perintah start hermes-desktop Anda]
# E) [OPSIONAL, isolasi fix I-01] pre-I-01, cap 30000:
#      git -C gezyhive stash   # singkirkan I-01/I-30
#      TOOL_RESULT_SIZE_CAP_TOKENS=30000 bun src/server/index.ts
#      (lalu: git -C gezyhive stash pop untuk mengembalikan)
```
> Catatan: run prod (`bun src/server/index.ts`) cukup untuk engine; tak perlu UI. Bila provider/api key membaca dotenv, pastikan `.env` DeepSeek ada.

---

## Pengukuran (copy-pasteable, dijalankan setelah tiap run)

Setelah satu perlakuan selesai, jalankan milik `gezyhive` SQL ini di terminal terpisah (ganti `<AGENT_ID>` dan `<RUN_START_EPOCH_MS>`). Ini grounded di schema (`messages.metadata` JSON punya `stepCount` & `toolCalls`; tabel `llm_usage` punya token + `step_count`).

```bash
DB=./data/gezy.db            # ganti jika GEZY_DATA_DIR berbeda
AGENT_ID=<AGENT_ID>
RUN_START=<RUN_START_EPOCH_MS>   # milidetik timestamp saat Anda mulai run

# 1) Langkah agent + jumlah tool-call untuk PESAN ASISTEN terakhir sesi ini:
sqlite3 "$DB" "SELECT json_extract(metadata,'\$.stepCount') AS steps, json_array_length(tool_calls) AS tool_calls, length(content) AS content_len, created_at FROM messages WHERE agent_id='$AGENT_ID' AND role='assistant' ORDER BY created_at DESC LIMIT 1;"

# 2) Repetisi: tool-call paling sering muncul di turn agent (ragged 1-row per assistant msg):
sqlite3 "$DB" "WITH tc AS (SELECT json_each.value ->> '\$.name' AS name FROM messages, json_each(messages.tool_calls) WHERE agent_id='$AGENT_ID' AND role='assistant' AND created_at>=$RUN_START) SELECT name, COUNT(*) AS n FROM tc GROUP BY name ORDER BY n DESC LIMIT 5;"

# 3) Token TOTAL agent sejak run start:
sqlite3 "$DB" "SELECT COALESCE(SUM(total_tokens),0) AS total_tokens, COALESCE(SUM(input_tokens),0) AS input_tokens, COALESCE(SUM(output_tokens),0) AS output_tokens, COALESCE(SUM(step_count),0) AS total_steps FROM llm_usage WHERE agent_id='$AGENT_ID' AND created_at>=$RUN_START;"

# 4) Untuk Probe-3 (bug-fix): sukses/lihat di probe-repo, BUKAN DB.
cd ~/bench-gezy/probe3 && bun test
```
Untuk **Probe-2 retention**: tanda sukses = agent menjawab benar **dan** tidak ada `read_file`/`grep` baru di turn probe-2. Cek dengan:
```bash
sqlite3 "$DB" "SELECT name, COUNT(*) FROM (SELECT json_each.value ->> '\$.name' AS name FROM messages m, json_each(m.tool_calls) WHERE m.agent_id='$AGENT_ID' AND m.role='assistant' AND m.created_at>=$RUN_START) t WHERE name IN ('read_file','grep','search_history') GROUP BY name;"
```
Untuk **D (gezyhd)**: ukur manual (langkah/tool-call dari log TUI hermes; token dari dashboard/bill DeepSeek). Bila tidak terukur, isi kolom `Catatan` dengan "manual" dan andalkan A/B/D/E perbandingan sukses+retensi yang lebih sederhana.

---

## Tabel hasil (ISI SETELAH RUN — jangan dibuat-buat)

### Probe-1 (single large read_file — inti M2)
| Perlakuan | Sum benar? | Berapa kali read/grep numbers.txt | Token total | Catatan |
|---|---|---|---|---|
| A. cap=30000 (+I-01) |  |  |  |  |
| B. cap=60000 (+I-01) |  |  |  |  |
| C. cap=0 (off) |  |  |  |  |
| D. gezyhd (kontrol) |  |  |  |  |
| E. [opsional] pre-I-01, cap=30000 |  |  |  |  |

### Probe-2 (retensi)
| Perlakuan | Jawab benar tanpa re-read? | Berapa kali read_file/grep di turn probe-2 | Catatan |
|---|---|---|---|
| A. cap=30000 (+I-01) |  |  |  |
| B. cap=60000 (+I-01) |  |  |  |
| C. cap=0 (off) |  |  |  |
| D. gezyhd (kontrol) |  |  |  |
| E. [opsional] pre-I-01, cap=30000 |  |  |  |

### Probe-3 (general capability — kontrol cap tidak merusak normal)
| Perlakuan | `bun test` hijau? | Langkah agent | Catatan |
|---|---|---|---|
| A. cap=30000 (+I-01) |  |  |  |
| B. cap=60000 (+I-01) |  |  |  |
| C. cap=0 (off) |  |  |  |
| D. gezyhd (kontrol) |  |  |  |

---

## Analisis (ISI SETELAH RUN) — pakai aturan keputusan berikut

### Apakah cap adalah penyebab degradasi M2? (Probe-1 & Probe-2)
- [ ] **C (cap=0) benar sum + retention tanpa re-read**, dan **A (cap=30000) salah/gagal retention** → **M2 CONFIRMED**. ✅
- [ ] Bila **A ≈ B ≈ C** (semua benar) → cap BUKAN penyebab pada probe ini; tugas terlalu kecil atau agent menemukan jalan lain (mis. langsung hitung via `run_shell` awk). ✗ → cari tugas yang benar-benar butuh konteks besar di LLM (bukan bisa jalan via shell).
- [ ] Bila **D (gezyhd) benar & retensi** dan A salah → bandingan `gezyhd` konsisten dengan hipotesis bahwa backend `gezyhd` tidak memangkas seagresif itu. → tetapi konfirmasi mesin/cap level: bandingkan ukuran output tool `gezyhd` (apakah `read_file`-nya juga penuh?).

### Efek fix I-01 (head+tail) — hanya bila E dijalankan
- E (pre-I-01, generic placeholder) vs A (+I-01, head+tail): bila A > E pada Probe-1 sum benar → I-01 membantu untuk tugas teks-besar. Bila E ≈ A → I-01 tidak membantu tugas agregasi (head+tail tak menyimpan seluruh angka) → **motivasi I-02 (naik/adaptive cap) lebih kuat daripada I-01** untuk kelas tugas ini.

### Langkah & repetisi
- [ ] A lebih banyak langkah/re-read daripada C pada Probe-1 → amnesia menambah beban kerja.
- [ ] Hitung rasio langkah A/C = __________ (mis. 2.3×) → estimasi over-head degradasi.

### Retensi observasi
- [ ] Probe-2: A perlu re-read, C/D tidak → amnesia antar-turn.

---

## Rekomendasi nilai cap default baru (untuk I-02) — ISI SETELAH RUN

Gunakan hasil probe untuk memilih. Aturan:
- Jika B (cap=60000) ≈ C (cap=0) pada Probe-1 sum benar DAN Probe-3 tetap hijau → **default naik ke 60000**. Alasan: file 256KB (~80k token) melebihi 60k juga — jadi B seharusnya TIDAK sama dengan C; bila B ≠ C, naikkan hingga setara. Lanjut:
- Threshold di mana Probe-1 mulai benar:
  - cap=30000 → ?cap=60000 → ?cap=100000 → ?cap=0.
- Untuk DeepSeek (context window ~128k): `effective = min(percent × contextWindow, absoluteCap)`. Pilih **cap adaptif** bila diperlukan tugas dengan tool output > 60k:
  - **Default `TOOL_RESULT_SIZE_CAP_TOKENS` baru**: __________ (mis. 60000) — alasan Probe-1: __________ .
  - **Adaptif %**: __________ (mis. 50% × contextWindow) — alasan: pada model window besar (128k), % mengambil alih absolute cap.
- Cap lain (naikkan bersama bila Probe-1 masih kena dampak):
  - `toolCallArgsSizeCapTokens` (8000): __________ (mis. 16000 bila write_file/edit besar kena) — alasan: __________ .
  - `assistantContentSizeCapTokens` (12000): __________ — alasan: __________ .
  - `userContentSizeCapTokens` (16000): __________ — alasan: __________ .
- Jangan sampai invalidasi prompt cache Anthropic (bila pakai Anthropic) — kriteria trim harus tetap stabil per-message. DeepSeek tidak cache jadi aman menaikkan.

---

## Catatan
- Bila `gezyhd` tak bisa dijalankan dengan provider+model persis sama, isi "Catatan" D dengan *"manual/kontrol terbatas"* dan andalkan **A vs C vs E** + Probe-3 hijau.
- Simpan prompt & repo yang dipakai (`~/bench-gezy`) + `EXPECTED_SUM` agar reproducible di sprint berikutnya; catat `git rev-parse HEAD` tiap perlakuan.
- Bila agent memilih jalan via `run_shell` (awk sum) alih-alih read_file ke LLM, Probe-1 tidak menguji cap LLM — wajib lihat **Catatan** & paksa "dengan satu pemanggilan read_file" (sudah ada di prompt). Bila masih memakai shell, tugas ini tidak valid untuk M2 — ganti prompt ke "Berdasarkan isi yang sudah kamu baca..." atau pilih tugas yang butuh reasoning terhadap isi file (bisa di­ingat di prompt).

---
*Setelah diisi, dokumen ini menjadi justifikasi nilai cap default pada I-02 dan bukti hipotesis M2.*