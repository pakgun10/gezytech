# Panduan Run Benchmark I-00 (langkah demi langkah)

> Ikuti berurutan. Setiap perlakuan = ulangi blok "Kirim + Ukur" dengan env cap berbeda. Angka hasil diisi ke `bench-result.md`.

## 0. Sekali saja — siapkan materi & kunci

```bash
mkdir -p ~/bench-gezy && cd ~/bench-gezy
cat > bench-gen.ts <<'TS'
import { writeFileSync } from 'node:fs'
const N = 65000
let sum = 0n
const out: string[] = []
for (let i = 0; i < N; i++) {
  const v = ((i * 1103515245 + 12345) % 9000) + 100
  sum += BigInt(v)
  out.push(`${v}`)
}
writeFileSync('numbers.txt', out.join('\n') + '\n', 'utf8')
writeFileSync('numbers.expected.txt', `${sum}\n`, 'utf8')
console.log('sum=' + sum.toString())
TS
bun bench-gen.ts
# → mencetak "sum=298512500"  (KUNCI JAWABAN Probe-1 = 298512500)

# Probe-3 repo:
mkdir -p probe3 && cd probe3
printf '%s\n' '{ "name":"probe3","version":"1.0.0","type":"module","scripts":{"test":"bun test"}}' > package.json
cat > maxvalue.ts <<'TS'
export function maxValue(arr: number[]): number {
  return arr.reduce((m, v) => (v < m ? v : m), arr[0] ?? 0)
}
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
cd ~
```

## 1. Sekali — catat commit & agent-id, taruh file di workspace agent

```bash
cd /home/pgun/dev/gezy/gezyhive
git rev-parse --short HEAD              # catat ke bench-result.md "commit"

# ambil agent-id (pilih satu agent yang modelnya = deepseek-v4-pro):
sqlite3 ./data/gezy.db "SELECT id, name, model FROM agents;"
# → misal dapat AGENT_ID=abc-123 . tempatkan file:
AGENT_ID=<isi>  # contoh: AGENT_ID=abc-123
WS=~/bench-gezy                 # file ada di sini; path absolut jalan di read_file
```
> Bila `read_file` ternyata tidak bisa baca path luar workspace, salin ke workspace agent:
> ```bash
> WSBASE=${WORKSPACE_BASE_DIR:-./data/workspaces}
> mkdir -p "$WSBASE/$AGENT_ID" && cp -r ~/bench-gezy/* "$WSBASE/$AGENT_ID/"
> WS="$WSBASE/$AGENT_ID"
> ```

## 2. Nyala server — perlakuan A (cap=30000)

```bash
cd /home/pgun/dev/gezy/gezyhive
TOOL_RESULT_SIZE_CAP_TOKENS=30000 bun run dev      # UI + API; pakai untuk kirim prompt
# (di terminal kedua untuk SQL) catat waktu mulai:
date +%s%3     # → RUN_START (milidetik), contoh 1720320000000 — catat!
```

## 3. Kirim prompt Probe-1 (di UI browser, kirim ke agent itu)

```
Tolong baca SELURUH isi file /home/pgun/bench-gezy/numbers.txt (atau ~/bench-gezy/numbers.txt) dengan SATU pemanggilan tool read_file, lalu hitung jumlah (sum) semua bilangan di dalamnya. Jawab HANYA angkanya.
```
- Setelah agent jawab → catat angkanya.
- **Sum benar?** = apakah = 298512500 ? (isi Ya/Tidak di tabel Probe-1 baris A).

## 4. Probe-2 (retensi) — kirim 2 turn pengisi dulu

Kirim (turn pengisi 1): `Hari ini cuaca bagus.`  
Setelah agent balas, kirim (turn pengisi 2): `Aku suka kopi.`  
Setelah balas, kirim (probe retensi):
```
Berapa sum yang kamu hitung dari numbers.txt barusan? Jawab HANYA angkanya, jangan baca file lagi.
```
- **Jawab benar tanpa re-read?** = jawab 298512500 dan tidak muncul bubble `read_file`/`grep` baru.

## 5. Probe-3 (sesi/turn baru) — kirim ke agent yang sama, turn berikut:
```
Di folder /home/pgun/bench-gezy/probe3/ tes di maxvalue.test.ts gagal. Baca maxvalue.ts, temukan bug, perbaiki, lalu jalankan `bun test` sampai hijau. Laporkan hasil test akhir.
```
- Nanti agent pakai `run_shell`/`edit_file`/`read_file`. Tunggu sampai selesai.

## 6. Ukur + isi tabel baris A (di terminal kedua)

```bash
DB=./data/gezy.db
AGENT_ID=<isi>
RUN_START=<isi nomor tadi>
# (1) langkah + tool-call pesan asisten terakhir:
sqlite3 "$DB" "SELECT json_extract(metadata,'\$.stepCount') AS steps, json_array_length(tool_calls) AS tool_calls FROM messages WHERE agent_id='$AGENT_ID' AND role='assistant' ORDER BY created_at DESC LIMIT 1;"
# (2) tool paling sering dipakai sejak RUN_START:
sqlite3 "$DB" "WITH t AS (SELECT value->>'name' AS name FROM messages, json_each(tool_calls) WHERE agent_id='$AGENT_ID' AND role='assistant' AND created_at>=$RUN_START) SELECT name, COUNT(*) n FROM t GROUP BY name ORDER BY n DESC LIMIT 5;"
# (3) token total:
sqlite3 "$DB" "SELECT COALESCE(SUM(total_tokens),0), COALESCE(SUM(step_count),0) FROM llm_usage WHERE agent_id='$AGENT_ID' AND created_at>=$RUN_START;"
# (4) jumlah read_file/grep di Probe-2 (retensi):
sqlite3 "$DB" "SELECT COUNT(*) FROM (SELECT value->>'name' AS name FROM messages m, json_each(m.tool_calls) WHERE m.agent_id='$AGENT_ID' AND m.role='assistant' AND m.created_at>=$RUN_START) WHERE name IN ('read_file','grep');"
# Probe-3 sukses:
cd ~/bench-gezy/probe3 && bun test   # hijau = PASS
```
Isi **baris A** di 3 tabel `bench-result.md`.

## 7. Stop server, jalankan perlakuan B (cap=60000)
```bash
# Ctrl-C di terminal server, lalu:
TOOL_RESULT_SIZE_CAP_TOKENS=60000 bun run dev
date +%s%3      # RUN_START baru, catat
# ulangi langkah 3–6, isi baris B.
```

## 8. Perlakuan C (cap=0)
```bash
TOOL_RESULT_SIZE_CAP_TOKENS=0 bun run dev
# ulangi, isi baris C.
```

## 9. Perlakuan D — gezyhd (kontrol)
- Jalankan hermes-desktop dengan provider DeepSeek & model deepseek-v4-pro.
- Kirim prompt yang sama (Probe-1/2/3). Catat: sum benar? langkah (dari log TUI hermes)? token (dashboard DeepSeek)?
- Isi baris D (boleh isi manual; bila tak terukur, tulis "manual" di Catatan).

## 10. Perlakuan E (OPSIONAL — isolasi fix I-01 head/tail)
```bash
git stash                 # singkirkan I-01/I-30 dulu
TOOL_RESULT_SIZE_CAP_TOKENS=30000 bun run dev
# run Probe-1 & 2 saja, isi baris E.
git stash pop             # kembalikan perubahan
```

## 11. Keputusan + cap default (isi di bench-result.md "Analisis" & "Rekomendasi")
- **M2 CONFIRMED?** = `C` benar & `A` salah → YA.  
- **Rasio langkah A/C** = steps_A ÷ steps_C (mis 12 ÷ 4 = 3×).  
- **Cap default baru** = pakai capaian di mana hasil menyamai `C` (mis. bila 60000 udah sebagus 0 → 60000).  
- **Adaptif %** = mis. `50% × contextWindow` (DeepSeek ~128k → 64000).

---

## Ringkasan cepat: apa diisi di mana
| Diisi | Dari mana | Contoh |
|---|---|---|
| "Sum benar?" (tabel) | banding jawaban agent dgn 298512500 | Ya |
| Langkah / tool-call | SQL #1 | steps=6, tool_calls=8 |
| Repetisi baca file | SQL #2 | read_file: 2 |
| Token total | SQL #3 | 52000 |
| Probe-3 hijau? | `bun test` di probe3 | PASS |
| M2 CONFIRMED? | C benar & A salah | YA |
| Cap default baru | pilih 60000 bila B ≈ C | 60000 |

Selesai semua → kirim balik ke saya angka A/B/C, dan saya lanjut potong sesuai ke **I-02** (cap adaptif) sesuai rekomendasi.