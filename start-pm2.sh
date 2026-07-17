#!/usr/bin/env bash
# Wrapper for pm2 — runs the gezytech server with Bun
exec /home/pgun/.bun/bin/bun run src/server/index.ts
