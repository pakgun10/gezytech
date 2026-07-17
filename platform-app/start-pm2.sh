#!/usr/bin/env bash
# Wrapper for pm2 — runs the platform-app server with Bun
exec /home/pgun/.bun/bin/bun run server/index.ts
