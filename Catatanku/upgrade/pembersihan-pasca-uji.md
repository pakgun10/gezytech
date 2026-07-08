# Catatan Pembersihan Pasca-Pengujian

> Dibuat: 2026-07-07
> Terkait: `pengujian-live.md`, seluruh tes §1–§8
> Agent: Wati (ID `d28b40db-9f1b-46e8-afe8-a7a01384ee71`)

---

## 1. File Yang Dibuat Selama Pengujian

### 1.1 Workspace Agent Wati

```
./data/workspaces/d28b40db-9f1b-46e8-afe8-a7a01384ee71/
├── numbers.txt                                  # 318 KB — file benchmark (65000 baris)
├── test-git-commit.txt                          # File dummy tes git-committer skill
└── .tool-outputs/
    ├── screenshot-1783412008150.png             # Screenshot dari pengujian sebelumnya (Audrey)
    └── screenshot-1783434972680.png             # Screenshot Tes 4.1 (Wati)
```

| File | Dibuat di tes | Ukuran | Perlu dihapus? |
|---|---|---|---|
| `numbers.txt` | Setup §0.4, Tes 1.1–1.3 | 318 KB | ✅ Ya — hanya untuk benchmark |
| `test-git-commit.txt` | Tes 5.5 (git-committer) | ~50 B | ✅ Ya — dummy |
| `screenshot-1783412008150.png` | Sebelum upgrade (Audrey) | ~350 KB | Opsional |
| `screenshot-1783434972680.png` | Tes 4.1 (screenshot) | ~350 KB | Opsional |

### 1.2 Folder Benchmark (`~/bench-gezy/`)

```
/home/pgun/bench-gezy/
├── bench-gen.ts                                 # Script generator numbers.txt
├── numbers.txt                                  # 318 KB — file angka (65000 baris)
├── numbers.expected.txt                         # 10 B — kunci jawaban (298512500)
├── secret.txt                                   # File dari benchmark sebelumnya
└── secret-gen.ts                                # Script dari benchmark sebelumnya
```

| File | Dibuat di | Alasan hapus |
|---|---|---|
| `bench-gen.ts` | Setup §0.4 | Hanya untuk generate numbers.txt |
| `numbers.txt` | Setup §0.4 | 318 KB, tidak diperlukan lagi |
| `numbers.expected.txt` | Setup §0.4 | 10 byte, kunci jawaban |
| `secret-gen.ts` | Benchmark sebelumnya | File lama, tidak terkait tes hari ini |
| `secret.txt` | Benchmark sebelumnya | File lama, tidak terkait tes hari ini |

**Rekomendasi**: Hapus seluruh folder `~/bench-gezy/` — 640 KB. Kalau mau simpan script generator untuk benchmark masa depan, pindahkan ke `Catatanku/`.

### 1.3 Repo Root (`gezyhive/`)

```
./test-scratch.txt                               # Dummy dari Tes 5.5
```

| File | Status |
|---|---|
| `test-scratch.txt` | ✅ Sudah di-`.gitignore` + unstage. Hapus fisik opsional (`rm test-scratch.txt`). |

### 1.4 Dokumen Baru (JANGAN dihapus)

```
./Catatanku/upgrade/pengujian-live.md            # Dokumen pengujian — keep!
```

---

## 2. Perubahan Database (State)

Semua perubahan ini terjadi di `./data/gezy.db`:

| Perubahan | Nilai sebelum | Nilai sesudah | Perlu dikembalikan? |
|---|---|---|---|
| Nama agent | `Audrey` | `Wati` | Opsional — kalau mau |
| Slug agent | `audrey` | `wati` | Opsional — kalau mau |
| Character (SOUL) | "To the point, no basa-basi..." | `''` (kosong) | Opsional — tapi ini hasil I-61 yang benar |
| Skill systematic-debugger | Aktif | Nonaktif | Opsional — enable kembali kalau perlu |

### Cara mengembalikan (kalau mau)

```sql
-- Kembalikan nama
UPDATE agents SET name='Audrey', slug='audrey' WHERE id='d28b40db-9f1b-46e8-afe8-a7a01384ee71';

-- Enable systematic-debugger
INSERT INTO agent_skills (skill_id, agent_id, created_at) 
SELECT id, 'd28b40db-9f1b-46e8-afe8-a7a01384ee71', strftime('%s','now')*1000 
FROM skills WHERE name='systematic-debugger' AND NOT EXISTS (
  SELECT 1 FROM agent_skills WHERE agent_id='d28b40db-9f1b-46e8-afe8-a7a01384ee71' AND skill_id=skills.id
);

-- Soal character: biarkan kosong (default template) atau isi manual via UI tab SOUL
```

---

## 3. Perintah Pembersihan Cepat

### Pembersihan minimal (rekomendasi)

```bash
cd /home/pgun/dev/gezy/gezyhive

# Hapus file workspace Wati
WORKSPACE="./data/workspaces/d28b40db-9f1b-46e8-afe8-a7a01384ee71"
rm -f "$WORKSPACE/numbers.txt"
rm -f "$WORKSPACE/test-git-commit.txt"

# Hapus seluruh folder benchmark
rm -rf ~/bench-gezy

# Hapus fisik test-scratch.txt (opsional, sudah di-gitignore)
rm -f ./test-scratch.txt
```

**Total dibersihkan**: ~1.3 MB (workspace 736KB + benchmark 640KB).

### Pembersihan full (termasuk screenshot + DB rollback)

```bash
cd /home/pgun/dev/gezy/gezyhive

# Hapus workspace Wati — semua
rm -rf ./data/workspaces/d28b40db-9f1b-46e8-afe8-a7a01384ee71/*
rm -rf ./data/workspaces/d28b40db-9f1b-46e8-afe8-a7a01384ee71/.tool-outputs

# Hapus benchmark
rm -rf ~/bench-gezy

# Hapus test-scratch
rm -f ./test-scratch.txt

# DB rollback (opsional)
sqlite3 ./data/gezy.db "UPDATE agents SET name='Audrey', slug='audrey' WHERE id='d28b40db-9f1b-46e8-afe8-a7a01384ee71';"
```

---

## 4. Yang Aman Ditinggalkan

Item ini tidak masalah kalau tidak dibersihkan:

| Item | Dampak kalau tidak dibersihkan |
|---|---|
| Screenshot PNG di workspace | Hanya konsumsi ~700KB disk |
| Character kosong | Default SOUL template aktif — ini perilaku yang benar |
| Nama Wati | Cuma kosmetik, tidak pengaruh fungsi |
| Benchmark folder | 640 KB di home, tidak digunakanserver |

---

*Dokumen ini adalah bagian dari `Catatanku/upgrade/`. Setelah dibersihkan, centang di bawah:*

- [ ] Pembersihan selesai dijalankan
- [ ] DB dikembalikan ke state semula (kalau diinginkan)
