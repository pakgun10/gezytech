# Ringkasan Perintah Docker — Cleanup & Deploy VPS GezyTech

## 1. Cek Container

```bash
docker ps -a                    # Lihat semua container (running + stopped)
docker ps -a -s                 # Sama, plus ukuran writable layer tiap container
docker ps -a --filter "status=exited"   # Cuma yang exited/stopped
```

## 2. Cek Image, Volume, Disk Usage Docker

```bash
docker system df              # Ringkasan: images, containers, volumes, build cache
docker system df -v           # Detail per item (paling berguna buat lihat mana yang gede)
docker images --filter "dangling=true"   # List image dangling (<none>) saja
docker volume ls                          # List semua volume
docker volume ls -f dangling=true         # List volume yang tidak dipakai container manapun
```

## 3. Cek Disk & Memory Server

```bash
df -h        # Disk usage filesystem
free -h      # RAM & swap usage
```

## 4. Backup Volume Database (sebelum hapus)

```bash
# Backup satu volume jadi file tar.gz
docker run --rm -v NAMA_VOLUME:/data:ro -v $(pwd):/backup alpine \
  tar czf /backup/NAMA_VOLUME.tar.gz -C /data .
```
> Lihat juga script `backup_db_volumes.sh` yang sudah dibuat — backup banyak volume sekaligus otomatis.

## 5. Hapus Container & Image yang Tidak Terpakai

```bash
docker container prune        # Hapus semua container yang exited
docker stop NAMA_CONTAINER    # Stop container tertentu (misal yang crash loop)
docker rm NAMA_CONTAINER      # Hapus container tertentu

docker image prune            # Hapus image dangling (<none>) saja — AMAN, tidak sentuh image aktif
docker image prune -a         # Hapus SEMUA image yang tidak dipakai container manapun (lebih agresif)
docker rmi IMAGE_ID_atau_NAMA # Hapus image tertentu secara manual

docker volume prune           # Hapus semua volume yang tidak terpakai container manapun
```

## 6. Cek Log Container (debug, misal kasus crash loop)

```bash
docker logs NAMA_CONTAINER --tail 50
```

## 7. Alur Deploy ke VPS (pola yang dipakai untuk `gezy`)

```bash
cd ~/arcane/projects/AIOS-GEZY

# 1. Tarik image terbaru dari registry
docker compose pull

# 2. Recreate container dengan image baru
docker compose up -d --force-recreate --remove-orphans gezy

# 3. (Opsional tapi disarankan) Verifikasi container baru sehat
docker exec gezy printenv PUBLIC_URL
docker exec gezy printenv OWNER_WHATSAPP_USER_ID
# ... grep/cek lain sesuai kebutuhan ...

# 4. Bersihkan image lama yang sudah tidak terpakai (dangling)
docker image prune -f
```

> Catatan: `--force-recreate` dan `--remove-orphans` TIDAK menghapus image lama secara otomatis.
> Selalu jalankan `docker image prune -f` setelah deploy supaya image dangling tidak menumpuk.

---

## Catatan Penting

- **`docker container prune`** biasanya cuma reclaim sedikit space (container ringan) — yang gede justru di **image**.
- **Image dangling** (`<none>`) adalah sisa build/pull lama yang sudah ketiban tag baru — ini biasanya penyumbang disk penuh terbesar.
- **Selalu backup volume database dulu** sebelum `docker volume prune`, karena prune ini permanen dan tidak bisa dibatalkan.
- Setelah deploy rutin dengan pola di atas, ukuran yang ke-prune biasanya kecil (ratusan MB) karena image lama & baru berbagi banyak layer yang sama — ini normal, bukan tanda ada yang salah.
