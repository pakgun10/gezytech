/**
 * Google Drive service layer untuk GezyTech.
 *
 * Menyediakan OAuth2 token management (simpan di Vault) dan operasi Drive API.
 */

import { google } from "googleapis";
import {
  getSecretValue,
  createSecret,
  updateSecretValueByKey,
} from "@/server/services/vault";
import { createLogger } from "@/server/logger";
import { PassThrough } from "stream";

const log = createLogger("services:google-drive");
let _oauth2Client: any = null;
function getOAuthClient(): any {
  if (!_oauth2Client) {
    _oauth2Client = createOAuthClient();
    log.info(
      { clientId: getClientId().slice(0, 20) + "..." },
      "OAuth2 client initialized",
    );
  }
  return _oauth2Client;
}

// ─── Config ───────────────────────────────────────────────────────────────────

function getClientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function getClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}
function getRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:3002/api/connections/google-drive/callback"
  );
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    getClientId(),
    getClientSecret(),
    getRedirectUri(),
  );
}

// ─── Token Key Pattern ────────────────────────────────────────────────────────

function tokenKey(userId: string): string {
  return `gdrive_token_${userId}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GDriveToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  scope: string;
  token_type: string;
  connected_at: number;
  google_email: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink: string | null;
  webContentLink: string | null;
  modifiedTime: string | null;
  parents: string[] | null;
}

// ─── Token Management ─────────────────────────────────────────────────────────

/** Simpan atau update token GDrive user di vault */
export async function saveToken(
  userId: string,
  token: GDriveToken,
): Promise<void> {
  const key = tokenKey(userId);
  const value = JSON.stringify(token);
  const existing = await getSecretValue(key);

  if (existing) {
    await updateSecretValueByKey(key, value);
    log.debug({ userId }, "GDrive token updated in vault");
  } else {
    await createSecret(
      key,
      value,
      undefined,
      `Google Drive token for user ${userId}`,
    );
    log.info({ userId }, "GDrive token saved to vault");
  }
}

/** Ambil token GDrive user dari vault */
export async function getToken(userId: string): Promise<GDriveToken | null> {
  const key = tokenKey(userId);
  const raw = await getSecretValue(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GDriveToken;
  } catch {
    log.error({ userId }, "GDrive token corrupted in vault");
    return null;
  }
}

/** Hapus token GDrive user dari vault */
export async function deleteToken(userId: string): Promise<void> {
  const key = tokenKey(userId);
  const { deleteSecret } = await import("@/server/services/vault");
  const { getSecretByKey } = await import("@/server/services/vault");
  const secret = await getSecretByKey(key);
  if (secret) {
    await deleteSecret(secret.id);
    log.info({ userId }, "GDrive token deleted from vault");
  }
}

/** Cek apakah user sudah connect GDrive */
export async function isConnected(userId: string): Promise<boolean> {
  const token = await getToken(userId);
  return token !== null;
}

/** Cek dan refresh token jika expired */
export async function refreshTokenIfNeeded(
  userId: string,
): Promise<GDriveToken | null> {
  const token = await getToken(userId);
  if (!token) return null;

  // Jika belum expired (buffer 5 menit), return existing
  if (token.expires_at > Date.now() + 5 * 60 * 1000) {
    return token;
  }

  // Refresh
  try {
    getOAuthClient().setCredentials({
      refresh_token: token.refresh_token,
    });
    const { credentials } = await getOAuthClient().refreshAccessToken();

    const updated: GDriveToken = {
      ...token,
      access_token: credentials.access_token ?? token.access_token,
      expires_at: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    };

    await saveToken(userId, updated);
    log.debug({ userId }, "GDrive token refreshed");
    return updated;
  } catch (err: any) {
    log.error({ userId, err: err.message }, "Failed to refresh GDrive token");
    return null;
  }
}

// ─── OAuth2 Helpers ───────────────────────────────────────────────────────────

/** Generate Google OAuth2 authorization URL */
export function getAuthUrl(state: string): string {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/drive.file",
    prompt: "consent", // always get refresh_token
    state,
  });
}

/** Exchange authorization code for tokens */
export async function exchangeCode(code: string): Promise<{
  tokens: GDriveToken;
  email: string;
} | null> {
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken({
      code,
      redirect_uri: getRedirectUri(),
    });

    log.info(
      {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiry: tokens.expiry_date,
        scope: tokens.scope,
        tokenType: tokens.token_type,
      },
      "OAuth token exchange response",
    );

    if (!tokens.access_token || !tokens.refresh_token) {
      log.error(
        {
          hasAccess: !!tokens.access_token,
          hasRefresh: !!tokens.refresh_token,
        },
        "Missing access_token or refresh_token from Google",
      );
      return null;
    }

    // Get user email — may fail if only drive.file scope, handle gracefully
    client.setCredentials(tokens);
    let email = "unknown@gmail.com";
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const { data } = await oauth2.userinfo.get();
      email = data.email ?? email;
    } catch {
      // userinfo scope not granted — use placeholder, token is still valid
      log.debug("userinfo.get() failed (expected with drive.file scope only)");
    }

    const gdriveToken: GDriveToken = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date ?? Date.now() + 3600 * 1000,
      scope: tokens.scope ?? "https://www.googleapis.com/auth/drive.file",
      token_type: tokens.token_type ?? "Bearer",
      connected_at: Date.now(),
      google_email: email,
    };

    return { tokens: gdriveToken, email };
  } catch (err: any) {
    log.error(
      {
        err: err.message,
        code: err.code,
        errors: err.errors,
        stack: err.stack?.split("\n")[0],
        redirectUri: getRedirectUri(),
        clientId: getClientId().slice(0, 30) + "...",
      },
      "Failed to exchange OAuth code",
    );
    return null;
  }
}

// ─── Drive API Helpers ────────────────────────────────────────────────────────

/** Dapatkan authenticated Drive client untuk user */
async function getDriveClient(userId: string) {
  const token = await refreshTokenIfNeeded(userId);
  if (!token)
    throw new Error(
      "Google Drive not connected. Ask user to connect in Settings first.",
    );

  getOAuthClient().setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
  });

  return google.drive({ version: "v3", auth: getOAuthClient() });
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadFile(
  userId: string,
  fileContent: Buffer,
  filename: string,
  mimeType?: string,
  folderId?: string,
): Promise<DriveFile> {
  const drive = await getDriveClient(userId);

  const media = {
    mimeType: mimeType ?? "application/octet-stream",
    body: new PassThrough(),
  };
  // googleapis needs a stream, not buffer — pipe buffer through PassThrough
  const buf = Buffer.isBuffer(fileContent)
    ? fileContent
    : Buffer.from(fileContent);
  (media.body as PassThrough).end(buf);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: folderId ? [folderId] : undefined,
    },
    media: media,
    fields:
      "id, name, mimeType, size, webViewLink, webContentLink, modifiedTime, parents",
  });

  // Make file shareable (anyone with link can view)
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  log.info(
    { userId, fileId: res.data.id, filename, size: res.data.size },
    "File uploaded to GDrive",
  );

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size ? Number(res.data.size) : null,
    webViewLink: res.data.webViewLink ?? null,
    webContentLink: res.data.webContentLink ?? null,
    modifiedTime: res.data.modifiedTime ?? null,
    parents: res.data.parents ?? null,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listFiles(
  userId: string,
  folderId?: string,
  query?: string,
  limit: number = 50,
): Promise<DriveFile[]> {
  const drive = await getDriveClient(userId);

  const qParts: string[] = ["trashed = false"];
  if (folderId) {
    qParts.push(`'${folderId}' in parents`);
  }
  if (query) {
    qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
  }

  const res = await drive.files.list({
    q: qParts.join(" and "),
    pageSize: Math.min(limit, 100),
    fields:
      "files(id, name, mimeType, size, webViewLink, webContentLink, modifiedTime, parents)",
    orderBy: "modifiedTime desc",
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    size: f.size ? Number(f.size) : null,
    webViewLink: f.webViewLink ?? null,
    webContentLink: f.webContentLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    parents: f.parents ?? null,
  }));
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function downloadFile(
  userId: string,
  fileId: string,
): Promise<{ content: Buffer; filename: string; mimeType: string }> {
  const drive = await getDriveClient(userId);

  // Get metadata
  const meta = await drive.files.get({
    fileId,
    fields: "name, mimeType, size",
  });

  // Download content
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  const content = Buffer.from(res.data as ArrayBuffer);

  log.debug(
    { userId, fileId, filename: meta.data.name, size: content.length },
    "File downloaded from GDrive",
  );

  return {
    content,
    filename: meta.data.name ?? "untitled",
    mimeType: meta.data.mimeType ?? "application/octet-stream",
  };
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchFiles(
  userId: string,
  query: string,
  limit: number = 20,
  mimeTypeFilter?: string,
): Promise<DriveFile[]> {
  const drive = await getDriveClient(userId);

  const qParts: string[] = ["trashed = false"];
  qParts.push(`fullText contains '${query.replace(/'/g, "\\'")}'`);
  if (mimeTypeFilter) {
    qParts.push(`mimeType contains '${mimeTypeFilter.replace(/'/g, "\\'")}'`);
  }

  const res = await drive.files.list({
    q: qParts.join(" and "),
    pageSize: Math.min(limit, 100),
    fields:
      "files(id, name, mimeType, size, webViewLink, webContentLink, modifiedTime, parents)",
    orderBy: "modifiedTime desc",
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    size: f.size ? Number(f.size) : null,
    webViewLink: f.webViewLink ?? null,
    webContentLink: f.webContentLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    parents: f.parents ?? null,
  }));
}

// ─── Folder Resolution ────────────────────────────────────────────────────────

/**
 * Resolve folder path atau ID ke folderId.
 * - Folder ID (25+ alphanumeric) → langsung return
 * - Path seperti "Laporan/2026" → resolve nested
 * - undefined/null → root (null)
 */
export async function resolveFolderId(
  userId: string,
  folder?: string | null,
): Promise<string | null> {
  if (!folder) return null;

  // Jika berupa Drive ID (alphanumeric, 25+ karakter)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(folder)) return folder;

  // Resolve path
  const parts = folder.split("/").filter(Boolean);
  let parentId: string | null = null;

  for (const name of parts) {
    const files = await listFiles(userId, parentId ?? undefined, undefined, 50);
    const folderMatch = files.find(
      (f) =>
        f.name.toLowerCase() === name.toLowerCase() &&
        f.mimeType === "application/vnd.google-apps.folder",
    );

    if (!folderMatch) {
      throw new Error(
        `Folder "${name}" not found${parentId ? ` inside parent folder` : ""}. ` +
          `Use list_gdrive to see available folders.`,
      );
    }
    parentId = folderMatch.id;
  }

  return parentId;
}

// no longer export oauth2Client
