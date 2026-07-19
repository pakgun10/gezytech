#!/usr/bin/env bash
# Wrapper for pm2 — runs the gezytech server with Bun
export NODE_ENV=production
export PORT=3000
export HOST=0.0.0.0
exec /home/pgun/.bun/bin/bun run src/server/index.ts
