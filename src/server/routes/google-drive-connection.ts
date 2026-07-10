/**
 * Google Drive OAuth2 connection routes.
 *
 * GET  /api/connections/google-drive/auth      — redirect ke Google OAuth
 * GET  /api/connections/google-drive/callback   — handle OAuth callback
 * GET  /api/connections/google-drive/status     — cek status koneksi
 * POST /api/connections/google-drive/disconnect — putus koneksi
 */

import { Hono } from "hono";
import type { AppVariables } from "@/server/app";
import {
  getAuthUrl,
  exchangeCode,
  saveToken,
  isConnected,
  deleteToken,
} from "@/server/services/google-drive";
import { createLogger } from "@/server/logger";
import { authMiddleware } from "@/server/auth/middleware";
import { v4 as uuid } from "uuid";

const log = createLogger("routes:google-drive-connection");

// Store pending OAuth states in memory (expires when server restarts — acceptable)
const pendingStates = new Map<string, string>(); // state → userId

const app = new Hono<{ Variables: AppVariables }>();

// Semua route butuh auth
app.use("/*", authMiddleware);

// ─── GET /auth — redirect ke Google ──────────────────────────────────────────

app.get("/auth", (c) => {
  const user = c.get("user") as { id: string };
  if (!user?.id) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const state = uuid();
  pendingStates.set(state, user.id);

  // Auto-expire state after 10 minutes
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);

  const authUrl = getAuthUrl(state);
  return c.redirect(authUrl);
});

// ─── GET /callback — handle OAuth callback ────────────────────────────────────

app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    log.warn({ error }, "Google OAuth error");
    return c.redirect(
      `${getPublicUrl()}/settings?gdrive=error&reason=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return c.redirect(
      `${getPublicUrl()}/settings?gdrive=error&reason=missing_params`,
    );
  }

  const userId = pendingStates.get(state);
  pendingStates.delete(state);

  if (!userId) {
    log.warn({ state }, "Invalid or expired OAuth state");
    return c.redirect(`${getPublicUrl()}/settings?gdrive=error&reason=expired`);
  }

  const result = await exchangeCode(code);
  if (!result) {
    return c.redirect(
      `${getPublicUrl()}/settings?gdrive=error&reason=token_exchange_failed`,
    );
  }

  await saveToken(userId, result.tokens);
  log.info({ userId, email: result.email }, "Google Drive connected");

  return c.redirect(
    `${getPublicUrl()}/settings?gdrive=connected&email=${encodeURIComponent(result.email)}`,
  );
});

// ─── GET /status — cek status ────────────────────────────────────────────────

app.get("/status", async (c) => {
  const user = c.get("user") as { id: string };
  if (!user?.id) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const connected = await isConnected(user.id);
  return c.json({ connected });
});

// ─── POST /disconnect — putus koneksi ────────────────────────────────────────

app.post("/disconnect", async (c) => {
  const user = c.get("user") as { id: string };
  if (!user?.id) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  await deleteToken(user.id);
  log.info({ userId: user.id }, "Google Drive disconnected");

  return c.json({ success: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPublicUrl(): string {
  return process.env.PLATFORM_URL ?? "http://localhost:5174";
}

export { app as googleDriveConnectionRoutes };
