# Analisis: Sessions Menu Menampilkan Seluruh History

## Lokasi kode yang relevan

- Frontend (public-app):
  - `/home/pgun/dev/gezy/gezytech/public-app/src/ChatPage.tsx`
  - `/home/pgun/dev/gezy/gezytech/public-app/src/HistoryPanel.tsx`
- Backend proxy (public-app):
  - `/home/pgun/dev/gezy/gezytech/public-app/server/index.ts`
  - `/home/pgun/dev/gezy/gezytech/public-app/server/gezytech-client.ts`
- Backend gezytech (API asli):
  - `/home/pgun/dev/gezy/gezytech/src/server/routes/messages.ts`
  - `/home/pgun/dev/gezy/gezytech/src/server/routes/quick-sessions.ts`

## Root cause

1. **Public-app menyimpan daftar session sendiri**, di tabel lokal `chat_sessions` (SQLite public-app), terpisah dari tabel `quick_sessions` milik gezytech.
2. **History selalu di-load tanpa filter session**:  
   `ChatPage.tsx` memanggil `GET /api/chat/history`, yang di proxy ke  
   `GET /api/agents/{agentSlug}/messages?limit=100`.  
   Endpoint gezytech tersebut sengaja mem-filter `messages.sessionId IS NULL`, artinya hanya mengembalikan pesan yang **tidak** terikat session. Jadi semua history utama muncul sekaligus.
3. **Saat klik session, frontend tidak memuat history session tersebut**:  
   `handleSelectHistory()` hanya melakukan `setMessages(allMessages)` — menampilkan ulang semua pesan. Komentar di kode:  
   `// For now, show all messages (agent remembers everything via compacting)`.
4. **Kirim pesan juga tidak mengirim `sessionId`**:  
   `POST /api/chat` → `sendChatMessage()` → `POST /api/agents/{slug}/messages` tanpa `sessionId`. Akibatnya pesan baru masuk ke conversation utama (sessionId NULL), bukan ke session yang sedang aktif.

Jadi behaviour saat ini memang by-design sementara: session hanya sebagai label/title, tidak memisahkan data pesan.

## Apakah bisa dibuat per-session history?

**Bisa.** Gezytech sudah punya dukungan penuh untuk quick-session:

- Tabel `quick_sessions` dan `messages.sessionId` sudah ada di schema.
- API tersedia:
  - `POST /api/agents/:agentId/quick-sessions` → buat session
  - `GET /api/agents/:agentId/quick-sessions` → list session
  - `GET /api/quick-sessions/:id` → detail session (termasuk load messages-nya)
- `enqueueMessage()` di gezytech sudah menerima `sessionId`.
- Agent-engine sudah mengelola context per quick-session.

Yang perlu diubah:

1. **Public-app server** (`index.ts` + `gezytech-client.ts`):
   - Ganti `/api/session/new` dan `/api/sessions` dari tabel lokal menjadi proxy ke gezytech quick-sessions API.
   - Modifikasi `POST /api/chat` agar menerima `sessionId` dari body dan meneruskannya ke `sendChatMessage()`.
   - Modifikasi `GET /api/chat/history` agar menerima query `sessionId` dan meneruskannya ke gezytech.
2. **Gezytech backend** (`src/server/routes/messages.ts`):
   - `POST /api/agents/:agentId/messages`: terima `sessionId` dari body dan teruskan ke `enqueueMessage()`.
   - `GET /api/agents/:agentId/messages`: jika query `sessionId` diberikan, filter `messages.sessionId = sessionId` (bukan `IS NULL`).
3. **Frontend public-app** (`ChatPage.tsx` + `HistoryPanel.tsx`):
   - Saat klik session, panggil `GET /api/chat/history?sessionId=...`.
   - Saat kirim pesan, sertakan `sessionId` aktif.
   - Sesuaikan state agar `messages` berisi pesan session yang sedang dibuka, bukan `allMessages`.

## Catatan migrasi

Tabel `chat_sessions` di public-app akan menjadi redundan setelah migrasi ke gezytech `quick_sessions`. Jika ada data session lama yang ingin dipertahankan, perlu migrasi eksplisit. Jika belum ada data penting, tabel lokal bisa diabaikan/dihapus.

## Rekomendasi

Lakukan perubahan di 3 layer di atas agar setiap session benar-benar memiliki history tersendiri.
