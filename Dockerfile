# ─── Build stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY public-app/package.json ./public-app/
COPY platform-app/package.json ./platform-app/

RUN bun install

# Copy source code and build
COPY . .
RUN bun run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM oven/bun:1.3-slim

WORKDIR /app

# Copy package files and install only (cached layer when deps don't change)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/

# Install dependencies fresh in slim image
RUN bun install

# Copy built app and source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public-app ./public-app
COPY --from=builder /app/platform-app ./platform-app
COPY --from=builder /app/start-pm2.sh ./start-pm2.sh
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory and set env
RUN mkdir -p /app/data
ENV GEZY_DATA_DIR=/app/data
ENV HOST=0.0.0.0

EXPOSE 3002

CMD ["/app/docker-entrypoint.sh"]
