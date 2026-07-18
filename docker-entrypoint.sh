#!/bin/sh
set -e

echo "Running database migrations..."
cd /app && bun run db:migrate

echo "Starting server..."
exec bun run src/server/index.ts
