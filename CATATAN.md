# Catatan Proyek GezyTech

> Dibuat: 2026-07-16 | Update: 2026-07-17
> Status: Semua service live, session sharing OK

---

## 📌 Subdomain & Akses

| Subdomain | Aplikasi | Port | Runtime |
|-----------|----------|------|---------|
| `aios.gezytech.web.id` | GezyTech Utama | 4178→3000 | Docker |
| `chat.gezytech.web.id` | Public Chat | 443→80→3003 | systemd + Bun |
| `platform.gezytech.web.id` | Platform Dashboard | 443→80→3004 | PM2 + Bun |
| `info.gezytech.web.id` | Blog Hugo | 443→80 | Nginx static |

VPS: `107.172.27.102` | User: `pgun`

---

## 🔧 Systemd Service — Chat Backend

**Chat-backend WAJIB pakai systemd**, bukan PM2. PM2 tidak kompatibel dengan Bun untuk file `.ts`.

### Buat service:
```bash
sudo tee /etc/systemd/system/chat-backend.service > /dev/null << 'EOF'
[Unit]
Description=GezyTech Chat Backend
After=network.target docker.service

[Service]
Type=simple
User=pgun
WorkingDirectory=/home/pgun/gezytech/public-app
Environment="PORT=3003"
Environment="DEV_MODE=true"
Environment="NODE_ENV=production"
Environment="GEZYTECH_URL=http://localhost:3002"
ExecStart=/home/pgun/.bun/bin/bun run server/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now chat-backend
```

### Cek:
```bash
sudo systemctl status chat-backend
curl -s http://127.0.0.1:3003/api/health
```

### ⚠️ NODE_ENV=production WAJIB
Tanpa ini, cookie `session` tidak diset dengan `domain=.gezytech.web.id` → session TIDAK shared antar subdomain.

---

## 🔧 PM2 — Platform Backend

Platform backend bisa pakai PM2 karena lebih toleran dengan Bun.

```bash
cd ~/gezytech/platform-app
PORT=3004 GEZYTECH_URL=http://localhost:3003 pm2 start server/index.ts --name platform-backend --interpreter ~/.bun/bin/bun
pm2 save
pm2 startup
```

---

## 🔧 Docker — GezyTech Utama

```bash
cd ~/gezytech
export ENCRYPTION_KEY=$(grep ENCRYPTION_KEY .env 2>/dev/null | cut -d= -f2 || openssl rand -hex 32)
docker compose -f docker/docker-compose.prod.yml up -d
```

---

## 🍪 Cookie Sharing

Chat + Platform sharing session via cookie domain `.gezytech.web.id`.

- **Chat-backend**: `domain: ".gezytech.web.id"` saat `NODE_ENV=production`
- **Platform-backend**: `GEZYTECH_URL=http://localhost:3003` (verifikasi session ke chat-backend)

---

## 🌐 Nginx Config

### aios.gezytech.web.id
```
proxy_pass http://127.0.0.1:4178
```

### chat.gezytech.web.id
```
root /home/pgun/gezytech/public-app/dist
try_files $uri /index.html
proxy_pass http://127.0.0.1:3003 (untuk /api/)
```

### platform.gezytech.web.id
```
root /home/pgun/gezytech/platform-app/dist
try_files $uri /index.html
proxy_pass http://127.0.0.1:3004 (untuk /api/)
```

---

## 🚀 Quick Start Setelah Reboot

```bash
# 1. Docker
cd ~/gezytech
export ENCRYPTION_KEY=$(grep ENCRYPTION_KEY .env 2>/dev/null | cut -d= -f2 || openssl rand -hex 32)
docker compose -f docker/docker-compose.prod.yml up -d

# 2. Chat + Platform — auto-start via systemd/PM2
# (sudah enable di atas, akan jalan otomatis)

# 3. Cek
sudo systemctl status chat-backend
pm2 status
docker ps | grep gezy
```

---

## 👤 Akun

### Chat (chat.gezytech.web.id):
- `dev@gezy.tech` / `devpass` (DEV_MODE)
- `gunantotestee@gmail.com` / `MyloveEniku`

### GezyTech Utama (aios.gezytech.web.id):
- `gunantotestee@gmail.com` / `MyloveEniku`

### Buat akun baru di GezyTech Utama (via API):
```bash
curl -X POST http://localhost:4178/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"email@contoh.com","password":"password123","name":"Nama"}'
```

### Buat user baru:
```bash
cd ~/gezytech/public-app
cat > create-user.ts << 'EOF'
import { createUser } from "./server/auth";
const user = await createUser({
  email: "email@example.com",
  password: "password",
  displayName: "Nama",
  agentSlug: "wati",
});
console.log("User created:", user.email);
EOF
DEV_MODE=true bun run create-user.ts
```

---

## 🔑 GitHub Secrets (untuk CI/CD deploy)

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `107.172.27.102` |
| `VPS_USER` | `pgun` |
| `VPS_SSH_KEY` | Private SSH key |

---

## 📅 Belum Selesai

- [ ] GitHub Secrets diisi (biar auto-deploy jalan)
- [ ] Telegram/WhatsApp channel setup
- [ ] Cloudflare DNS untuk `chat` dan `platform` (sudah di-set, cek orange cloud)
- [ ] Platform-app: tombol login redirect ke chat (sudah fix, cek cache)

---

*Catatan ini dibuat oleh Zed AI Agent.*