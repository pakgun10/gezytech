#!/usr/bin/env bash
# Wrapper for pm2 — runs the public-app server with Bun
export NODE_ENV=production
export PORT=3003
export HOST=0.0.0.0
export GEZYTECH_API_URL=http://127.0.0.1:3000
export GEZYTECH_SERVICE_TOKEN=dev-token-shared
export PUBLIC_WEBCHAT_URL=https://chat.gezytech.web.id/webchat/
exec /home/pgun/.bun/bin/bun run server/index.ts
