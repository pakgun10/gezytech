# ─── Build stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY public-app/package.json ./public-app/
COPY platform-app/package.json ./platform-app/

RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN bun run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM oven/bun:1.3-slim

WORKDIR /app

# Copy built app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public-app ./public-app
COPY --from=builder /app/platform-app ./platform-app
COPY --from=builder /app/start-pm2.sh ./start-pm2.sh
COPY --from=builder /app/node_modules ./node_modules

# Create data directory and set env
RUN mkdir -p /app/data
ENV GEZY_DATA_DIR=/app/data

EXPOSE 3002

CMD ["bun", "run", "src/server/index.ts"]
