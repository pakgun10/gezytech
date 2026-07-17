# Catatan Proyek GezyTech (Hivekeep)

> Dibuat: 2026-07-16
> Status: Container berjalan di VPS, CI/CD siap

---

## 📌 Info Penting

### Akses
- **URL**: `https://aios.gezytech.web.id`
- **Port mapping**: VPS 4178 → container 3000
- **VPS**: `107.172.27.102`, user `pgun`

### Docker
- Container name: `gezy`
- Image: `ghcr.io/pakgun10/gezytech:latest`
- Compose file: `docker/docker-compose.prod.yml`
- Network: `pgunNet` (external)
- Volume: `gezy-data` (persistent di `/app/data`)

### Build
- ⚠️ **JANGAN build di VPS** — RAM 2GB tidak cukup (`exit code 137` OOM)
- Build **HARUS** lewat GitHub Actions (CI/CD)

---

## ✅ Yang Sudah Selesai

### CI/CD
- [x] CI workflow: typecheck → test → build → validate Docker
- [x] Docker build & push ke GHCR (tiap push master/main)
- [x] Release workflow: gate → multi-arch build → merge → GitHub Release
- [x] Deploy step: SSH ke VPS + `docker compose pull && up -d`

### VPS
- [x] Docker terinstall (29.6.1)
- [x] Container gezy berjalan
- [x] Docker login ke GHCR (token pakgun10)
- [x] Git pull otomatis setelah CI

---

## ❌ Yang Belum / Masalah

### 1. GitHub Secrets (PENTING!)
Deploy otomatis gagal karena 3 secret belum diisi:
- Buka https://github.com/pakgun10/gezytech/settings/secrets/actions
- Tambahkan:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `107.172.27.102` |
| `VPS_USER` | `pgun` |
| `VPS_SSH_KEY` | `cat ~/.ssh/id_ed25519` (private key) |

### 2. ENCRYPTION_KEY tidak persisten
Saat ini `ENCRYPTION_KEY` di-export manual. Simpan permanen:
```bash
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> ~/gezytech/.env
```

### 3. Warning variabel opsional
Variabel Telegram/WhatsApp tidak diset (tidak fatal):
```
OWNER_TELEGRAM_USER_ID
TELEGRAM_ALLOWED_USERS
OWNER_WHATSAPP_USER_ID
GEZY_WHATSAPP_ALLOWED_USERS
```

### 4. Domain & SSL
- `aios.gezytech.web.id` perlu SSL (Let's Encrypt via Nginx reverse proxy)
- Atau Cloudflare Tunnel

---

## 🚀 Perintah Penting

### Update aplikasi (manual)
```bash
cd ~/gezytech
git pull
export ENCRYPTION_KEY=$(cat .env | grep ENCRYPTION_KEY | cut -d= -f2)
docker compose -f docker/docker-compose.prod.yml pull
docker compose -f docker/docker-compose.prod.yml up -d
```

### Cek status container
```bash
docker ps | grep gezy
docker logs gezy --tail 50
```

### Restart container
```bash
cd ~/gezytech
docker compose -f docker/docker-compose.prod.yml restart
```

### Lihat log real-time
```bash
docker logs -f gezy
```

---

## ⚠️ Jangan Dilakukan

| Aksi | Alasan |
|------|--------|
| `docker build` di VPS | RAM 2GB tidak cukup, akan OOM |
| `bun run build` di VPS | Sama — butuh 8GB RAM |
| Ganti branch `master` ke `main` | Workflow sudah support keduanya |
| Hapus volume `gezy-data` | Data user akan hilang |

---

## 🔧 Setup Nginx Reverse Proxy (Besok)

```bash
sudo tee /etc/nginx/sites-available/aios > /dev/null << 'EOF'
server {
    listen 80;
    server_name aios.gezytech.web.id;

    location / {
        proxy_pass http://127.0.0.1:4178;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/aios /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d aios.gezytech.web.id
```

---

## 📅 Rencana Besok

1. Isi GitHub Secrets untuk auto-deploy
2. Setup Nginx + SSL untuk `aios.gezytech.web.id`
3. Set ENCRYPTION_KEY permanen di `.env`
4. Tes auto-deploy: push → CI → container update
5. (Opsional) Setup Telegram/WhatsApp channel

---

*Catatan ini dibuat oleh Zed AI Agent pada 2026-07-16.*
## 📱 public-app & platform-app Setup

> public-app → chat.gezytech.web.id (port 3003)
> platform-app → platform.gezytech.web.id (port 3004)

=========================================================
### 1. Build Kedua App

```bash
cd ~/gezytech

# Build public-app (chat)
cd public-app
bun install
bun run build

# Build platform-app (platform)
cd ../platform-app
bun install
bun run build
```

### 2. Jalankan Backend Server (PM2)

```bash
# Install pm2
sudo apt install npm -y
sudo npm install -g pm2

# public-app backend (port 3003)
cd ~/gezytech/public-app
GEZYTECH_URL=http://localhost:3002 pm2 start server/index.ts --name chat-backend --interpreter ~/.bun/bin/bun

# platform-app backend (port 3004)
cd ~/gezytech/platform-app
GEZYTECH_URL=http://localhost:3002 pm2 start server/index.ts --name platform-backend --interpreter ~/.bun/bin/bun

# Auto-start saat reboot
pm2 save
pm2 startup
```

### 3. Nginx — chat + platform

```bash
sudo tee /etc/nginx/sites-available/chat > /dev/null << 'NGXEOF'
server {
    listen 80;
    server_name chat.gezytech.web.id;

    root /home/pgun/gezytech/public-app/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGXEOF

sudo tee /etc/nginx/sites-available/platform > /dev/null << 'NGXEOF'
server {
    listen 80;
    server_name platform.gezytech.web.id;

    root /home/pgun/gezytech/platform-app/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGXEOF

sudo ln -sf /etc/nginx/sites-available/chat /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Cloudflare DNS

| Record | Type | Value | Proxy |
|--------|------|-------|-------|
| `chat` | A | `107.172.27.102` | 🟠 Orange |
| `platform` | A | `107.172.27.102` | 🟠 Orange |

### 5. Akses

- `https://chat.gezytech.web.id`
- `https://platform.gezytech.web.id`

### 6. Cek Status

```bash
pm2 status
docker ps | grep gezy
```

## 🔧 Penting: PM2 + Bun + NODE_ENV

### PM2 tidak kompatibel dengan Bun untuk file .ts
PM2 gagal menjalankan `server/index.ts` via Bun karena `ProcessContainerForkBun.js` menggunakan `require()` (Node.js), bukan `import` (Bun). **Jangan pakai PM2 untuk Bun server**, gunakan `nohup` atau `systemd`.

### Cara menjalankan chat-backend:
```bash
pkill -f "server/index.ts" 2>/dev/null
sleep 1
cd ~/gezytech/public-app
git pull
PORT=3003 DEV_MODE=true NODE_ENV=production GEZYTECH_URL=http://localhost:3002 \
  nohup bun run server/index.ts > /tmp/chat.log 2>&1 &
```

### ⚠️ NODE_ENV=production WAJIB
Tanpa `NODE_ENV=production`, cookie `session` tidak akan diset dengan `domain=.gezytech.web.id`, sehingga session TIDAK shared antar subdomain.

## 🍪 Cookie Sharing Antar Subdomain

Agar `chat.gezytech.web.id` dan `platform.gezytech.web.id` sharing session:

1. Chat-backend set cookie dengan `domain: ".gezytech.web.id"` (hanya jika `NODE_ENV=production`)
2. Platform-backend verifikasi session ke chat-backend (`GEZYTECH_URL=http://localhost:3003`)

## 📋 Daftar Service yang Harus Jalan

| Service | Port | Cara Jalan |
|---------|------|------------|
| GezyTech Utama (Docker) | 4178→3000 | `docker compose -f docker/docker-compose.prod.yml up -d` |
| Chat Backend | 3003 | `nohup bun run server/index.ts` |
| Platform Backend | 3004 | `pm2 start server/index.ts --name platform-backend --interpreter ~/.bun/bin/bun` |

## 🚀 Quick Start (Setelah Reboot)

```bash
# 1. Docker
cd ~/gezytech
export ENCRYPTION_KEY=$(grep ENCRYPTION_KEY .env | cut -d= -f2 2>/dev/null || openssl rand -hex 32)
docker compose -f docker/docker-compose.prod.yml up -d

# 2. Chat Backend
cd ~/gezytech/public-app
PORT=3003 DEV_MODE=true NODE_ENV=production GEZYTECH_URL=http://localhost:3002 \
  nohup bun run server/index.ts > /tmp/chat.log 2>&1 &

# 3. Platform Backend
cd ~/gezytech/platform-app
PORT=3004 GEZYTECH_URL=http://localhost:3003 \
  pm2 start server/index.ts --name platform-backend --interpreter ~/.bun/bin/bun
pm2 save
```
