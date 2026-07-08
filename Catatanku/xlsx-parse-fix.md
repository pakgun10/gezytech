# Fitur: Bot Bisa Baca XLSX — read_file Spreadsheet Extraction

> Dibuat: 8 Jul 2026 · Status: **IMPLEMENTED (belum commit)** · Prioritas: sedang

## Masalah

File `.xlsx` (Excel 2007+ / OOXML spreadsheet) dideteksi sebagai **binary** oleh tool `read_file` karena mengandung null bytes di header ZIP. Tool `read_file` hanya punya special-case untuk `.pdf` — semua file binary lainnya langsung ditolak:

```
Binary file detected. Use run_shell to inspect binary files.
```

Akibatnya, Agent terpaksa fallback ke `run_code` / `run_shell` untuk parse XML di dalam arsip ZIP secara manual. Pendekatan ini tidak andal — Agent harus tahu struktur OOXML (shared strings, worksheet XML, rels), dan sering tidak bisa membaca xlsx dengan lengkap (sheet terlewat, formula tidak ter-resolve, format sel hilang).

## Solusi

Tambah handler khusus `.xlsx` / `.xlsm` di branch binary file `read_file`, persis seperti pattern PDF yang sudah ada. Pakai library `exceljs` untuk parse spreadsheet → konversi ke TSV text yang bisa dibaca Agent.

### Output format

```
=== Sheet: Employees (4 rows × 3 cols) ===
Name	Age	Department
Alice	30	Engineering
Bob	25	Marketing
Charlie	35	Engineering

=== Sheet: Summary (2 rows × 2 cols) ===
Total	Average
90	30
```

- Satu section per worksheet, dipisahkan baris kosong
- Header section: `=== Sheet: <name> (<rows> rows × <cols> cols) ===`
- Cell values dipisahkan tab (`\t`)
- Mendukung: shared strings, formula results (computed value), dates (ISO format), rich-text cells (concatenated runs)
- Pagination via `offset` / `limit` (sama seperti text file & PDF)

## Yang diubah

### 1. New file: `src/server/tools/xlsx-parser.ts`

Module parser terpisah. `exceljs` di-load via dynamic `import()` (lazy-load) — hanya dimuat saat file `.xlsx` benar-benar dibaca, tidak membebani startup.

```ts
export async function parseXlsxToText(buffer: Buffer): Promise<{
  text: string
  sheets: { name: string; rows: number; cols: number }[]
}>
```

Menangani cell types:
| Type | Handling |
|---|---|
| `null` / `undefined` | String kosong |
| `string` / `number` | `String(v)` |
| `Date` | `v.toISOString()` |
| Rich text (`{ richText: [...] }`) | Concatenate `r.text` runs |
| Formula (`{ result: ... }`) | `String(result)` (computed value, bukan formula text) |
| Hyperlink (`{ text: ... }`) | `String(text)` |
| Lainnya | `String(v)` fallback |

### 2. Modified: `src/server/tools/filesystem-tools.ts`

| Perubahan | Detail |
|---|---|
| Import | `import { parseXlsxToText } from '@/server/tools/xlsx-parser'` |
| Tool description | Update: "...extract data from an XLSX spreadsheet" |
| Binary handler block | Tambah branch `.xlsx` / `.xlsm` setelah branch `.pdf`, sebelum rejection "Binary file detected" |
| Return fields | `success`, `content`, `path`, `totalLines`, `startLine`, `endLine`, `language: 'text'`, `note`, `truncated`, duplicate detection (sama seperti PDF & text) |

### 3. Modified: `src/server/tools/filesystem-tools.test.ts`

2 test baru:
- `extracts data from XLSX files` — verifikasi multi-sheet parsing, tab-separated output, sheet metadata di `note`
- `supports offset/limit on XLSX files` — verifikasi pagination bekerja, `truncated` benar

### 4. `package.json` — dependency baru

```json
"exceljs": "^4.4.0"
```

## Arsitektur

```
read_file(.xlsx)
  → isBinary(buffer) → true (ZIP header punya null bytes)
  → absPath.endsWith('.xlsx') || '.xlsm' → masuk branch XLSX
  → parseXlsxToText(buffer)
      → dynamic import('exceljs')
      → new Workbook().xlsx.load(buffer)
      → wb.eachSheet() → ws.eachRow() → row.getCell(c).value
      → konversi ke TSV text + sheet metadata
  → split('\n') → apply offset/limit → return content + metadata
```

**File-file kunci:**

| File | Peran |
|---|---|
| `src/server/tools/filesystem-tools.ts` | Tool `read_file` — handler XLSX extraction (branch binary) |
| `src/server/tools/xlsx-parser.ts` | Parser: `exceljs` → TSV text + sheet metadata |
| `package.json` | `"exceljs": "^4.4.0"` di dependencies |

## Verifikasi

### Lokal (dev)

- Diagnostics: 0 errors/warnings di `filesystem-tools.ts`, `xlsx-parser.ts`, `filesystem-tools.test.ts` ✅
- Tests: `bun test src/server/tools/filesystem-tools.test.ts` → **46 pass, 0 fail** ✅
  - 44 existing tests tetap pass
  - 2 test baru XLSX pass
- E2E test manual: create xlsx (multi-sheet) → `parseXlsxToText()` → verify output ✅

### VPS (perlu deploy)

```bash
docker compose pull
docker compose up -d --force-recreate gezy
```

Test E2E: kirim file `.xlsx` ke bot via Telegram → bot harus bisa `read_file` file tersebut dan membaca semua sheet + data sel dengan lengkap.

## Catatan teknis

1. **Format yang didukung**: `.xlsx` (Excel 2007+ OOXML) dan `.xlsm` (macro-enabled, same structure). **Tidak didukung**: `.xls` (format biner lama Excel 97-2003) — `exceljs` tidak support baca `.xls`. Kalau perlu, tambah library terpisah (mis. `xlsx` / SheetJS).
2. **`.ods` (OpenDocument Spreadsheet)**: tidak didukung oleh `exceljs`. Butuh library terpisah kalau diperlukan.
3. **`exceljs` di Bun**: terverifikasi compatible — roundtrip create + load + parse bekerja tanpa issue.
4. **Lazy loading**: `import('exceljs')` hanya dieksekusi saat file `.xlsx` dibaca. Tidak membebani memory startup atau tool registration.
5. **Empty cells**: baris dengan cell kosong di tengah tetap dipertahankan (`eachRow({ includeEmpty: true })`). Kolom kosong di-render sebagai string kosong (`""`).
6. **Performance**: `exceljs` parse in-process (JS murni). File 10MB (MAX_FILE_SIZE) masih reasonable. Tidak butuh system library.
7. **`edit_file` guard**: `read_file` xlsx tercatat di `recordReadPath()` — jadi Agent yang baca xlsx lalu mau edit file lain tetap lolos guard "read before edit". Tapi xlsx sendiri tidak bisa di-edit via `edit_file` (binary, bukan text).
8. **Limitasi format**: output adalah TSV flat text — formatting Excel (warna, merge cells, charts, images, conditional formatting) tidak dipertahankan. Hanya data sel yang diekstrak. Ini sesuai tujuan: Agent bisa **membaca** data spreadsheet, bukan mereplikasi formatting.
9. **`write_file` di `.ts` yang sudah ada** trigger format-on-save (single→double quote + semicolon di seluruh file). Solusi: gunakan script Python untuk edit byte-safe, bukan `edit_file` tool. (Catatan ini sama dengan item 9.3.1 di `fitur-channel-dokumen.md`.)

## Timeline

| Tanggal | Event |
|---|---|
| 8 Jul 2026 | User laporkan `read_file` tidak bisa parse `.xlsx` — Agent fallback ke `run_code` parse XML manual |
| 8 Jul 2026 | Diagnosa: `read_file` hanya special-case `.pdf` untuk binary, `.xlsx` di-reject |
| 8 Jul 2026 | Implementasi: `exceljs` + `xlsx-parser.ts` + handler di `read_file` |
| TBD | Commit + deploy VPS + test E2E |
