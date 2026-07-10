/**
 * Google Drive tools untuk GezyTech.
 *
 * send_gdrive    — upload file ke Google Drive user
 * list_gdrive    — lihat daftar file/folder
 * download_gdrive — download file dari Drive ke workspace
 * search_gdrive  — cari file di Drive
 */

import { tool } from "@/server/tools/tool-helper";
import { z } from "zod";
import { resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import type { ToolRegistration } from "@/server/tools/types";
import { resolveToolWorkspace } from "@/server/tools/workspace";
import {
  uploadFile,
  listFiles,
  downloadFile,
  searchFiles,
  resolveFolderId,
  isConnected,
} from "@/server/services/google-drive";
import { createLogger } from "@/server/logger";

const log = createLogger("tools:gdrive");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function getUserId(ctx: any): string {
  // ctx adalah ToolExecutionContext dari tool factory
  return ctx?.userId ?? ctx?.agentId ?? "unknown";
}

// ─── send_gdrive ──────────────────────────────────────────────────────────────

export const sendGdriveTool: ToolRegistration = {
  availability: ["main"],
  concurrencySafe: false,
  create: (ctx) =>
    tool({
      description:
        "Upload a file to the user's Google Drive and get a shareable link. " +
        "The file can come from the agent workspace, inline content, or a URL. " +
        "The user must have connected their Google Drive in Settings first. " +
        "Uploaded files are automatically shared (anyone with the link can view). " +
        "Use folder to specify a target folder path (e.g., 'Laporan/2026') or Drive folder ID.",
      inputSchema: z.object({
        source: z
          .enum(["workspace", "content"])
          .describe("Source of the file: 'workspace' (agent workspace file) or 'content' (inline text/base64)"),
        path: z
          .string()
          .optional()
          .describe("Workspace file path. Required when source='workspace'."),
        content: z
          .string()
          .optional()
          .describe("Inline text or base64 content. Required when source='content'."),
        filename: z.string().describe("Name for the file in Drive (e.g., 'report.pdf')"),
        mimeType: z
          .string()
          .optional()
          .describe("MIME type (e.g., 'application/pdf'). Auto-detected if omitted."),
        folder: z
          .string()
          .optional()
          .describe("Target folder path (e.g., 'Laporan/2026') or Drive folder ID. Uploads to root if omitted."),
      }),
      execute: async (args) => {
        const userId = getUserId(ctx);

        // Check connection
        const connected = await isConnected(userId);
        if (!connected) {
          return {
            success: false,
            error:
              "Google Drive is not connected. Please connect your Google Drive in Settings first.",
          };
        }

        try {
          let fileContent: Buffer;

          // Resolve source
          if (args.source === "workspace") {
            if (!args.path) {
              return { success: false, error: "path is required when source='workspace'" };
            }
            const workspace = resolveToolWorkspace(ctx as any);
            const absPath = resolve(workspace, args.path);
            if (!absPath.startsWith(workspace)) {
              return { success: false, error: "Path must be within the workspace" };
            }
            if (!existsSync(absPath)) {
              return { success: false, error: `File not found: ${args.path}` };
            }
            fileContent = await readFile(absPath);
          } else if (args.source === "content") {
            if (!args.content) {
              return { success: false, error: "content is required when source='content'" };
            }
            // Try base64 decode if looks like base64
            try {
              fileContent = Buffer.from(args.content, "base64");
              // If decoded content looks like valid text, check if it was actually text
            } catch {
              fileContent = Buffer.from(args.content, "utf-8");
            }
          } else {
            return { success: false, error: `Unknown source: ${args.source}` };
          }

          if (fileContent.length > MAX_FILE_SIZE) {
            return {
              success: false,
              error: `File too large (${(fileContent.length / 1024 / 1024).toFixed(1)} MB). Max is 100 MB.`,
            };
          }

          // Resolve folder
          const folderId = await resolveFolderId(userId, args.folder).catch((err) => {
            throw err; // re-throw folder resolution errors
          });

          // Upload
          const file = await uploadFile(userId, fileContent, args.filename, args.mimeType, folderId ?? undefined);

          return {
            success: true,
            fileId: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            webViewLink: file.webViewLink,
            webContentLink: file.webContentLink,
            folder: folderId ?? "root",
          };
        } catch (err: any) {
          log.error({ userId, err: err.message }, "send_gdrive failed");
          return { success: false, error: err.message };
        }
      },
    }),
};

// ─── list_gdrive ──────────────────────────────────────────────────────────────

export const listGdriveTool: ToolRegistration = {
  availability: ["main"],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        "List files and folders in the user's Google Drive. " +
        "Use folder to narrow to a specific folder (path or ID). " +
        "Use query to filter by name (e.g., 'report' finds files with 'report' in the name). " +
        "Returns up to 50 items sorted by most recently modified.",
      inputSchema: z.object({
        folder: z.string().optional().describe("Folder path or Drive folder ID. Lists root if omitted."),
        query: z.string().optional().describe("Filter files by name (partial match)."),
        limit: z.number().min(1).max(50).default(50).describe("Max items to return (1-50)."),
      }),
      execute: async (args) => {
        const userId = getUserId(ctx);

        const connected = await isConnected(userId);
        if (!connected) {
          return {
            success: false,
            error: "Google Drive is not connected. Please connect your Google Drive in Settings first.",
          };
        }

        try {
          const folderId = await resolveFolderId(userId, args.folder).catch((err) => {
            throw err;
          });

          const files = await listFiles(userId, folderId ?? undefined, args.query, args.limit);

          return {
            success: true,
            count: files.length,
            folder: folderId ?? "root",
            files: files.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: f.size,
              webViewLink: f.webViewLink,
              modifiedTime: f.modifiedTime,
              isFolder: f.mimeType === "application/vnd.google-apps.folder",
            })),
          };
        } catch (err: any) {
          log.error({ userId, err: err.message }, "list_gdrive failed");
          return { success: false, error: err.message };
        }
      },
    }),
};

// ─── download_gdrive ──────────────────────────────────────────────────────────

export const downloadGdriveTool: ToolRegistration = {
  availability: ["main"],
  concurrencySafe: false,
  create: (ctx) =>
    tool({
      description:
        "Download a file from the user's Google Drive to the agent workspace. " +
        "Use list_gdrive or search_gdrive to find the file ID first. " +
        "Returns the workspace path where the file was saved.",
      inputSchema: z.object({
        fileId: z.string().describe("Google Drive file ID (from list_gdrive or search_gdrive)."),
        saveAs: z
          .string()
          .optional()
          .describe("Path in the agent workspace to save the file. Uses original filename if omitted."),
      }),
      execute: async (args) => {
        const userId = getUserId(ctx);

        const connected = await isConnected(userId);
        if (!connected) {
          return {
            success: false,
            error: "Google Drive is not connected. Please connect your Google Drive in Settings first.",
          };
        }

        try {
          const result = await downloadFile(userId, args.fileId);
          const workspace = resolveToolWorkspace(ctx as any);
          const savePath = resolve(workspace, args.saveAs ?? result.filename);

          await writeFile(savePath, result.content);
          log.info({ userId, fileId: args.fileId, savePath, size: result.content.length }, "File downloaded from GDrive to workspace");

          return {
            success: true,
            path: savePath,
            filename: result.filename,
            mimeType: result.mimeType,
            size: result.content.length,
          };
        } catch (err: any) {
          log.error({ userId, err: err.message }, "download_gdrive failed");
          return { success: false, error: err.message };
        }
      },
    }),
};

// ─── search_gdrive ────────────────────────────────────────────────────────────

export const searchGdriveTool: ToolRegistration = {
  availability: ["main"],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        "Search files in the user's Google Drive by content or name. " +
        "This performs a full-text search across all files in the user's Drive. " +
        "Use mimeType to filter by file type (e.g., 'pdf', 'spreadsheet', 'document'). " +
        "Returns up to 20 results sorted by relevance.",
      inputSchema: z.object({
        query: z.string().describe("Search query (matches file name and content)."),
        limit: z.number().min(1).max(50).default(20).describe("Max results (1-50)."),
        mimeType: z.string().optional().describe("Filter by MIME type (e.g., 'application/pdf'). Partial match supported."),
      }),
      execute: async (args) => {
        const userId = getUserId(ctx);

        const connected = await isConnected(userId);
        if (!connected) {
          return {
            success: false,
            error: "Google Drive is not connected. Please connect your Google Drive in Settings first.",
          };
        }

        try {
          const files = await searchFiles(userId, args.query, args.limit, args.mimeType);

          return {
            success: true,
            count: files.length,
            query: args.query,
            files: files.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: f.size,
              webViewLink: f.webViewLink,
              modifiedTime: f.modifiedTime,
            })),
          };
        } catch (err: any) {
          log.error({ userId, err: err.message }, "search_gdrive failed");
          return { success: false, error: err.message };
        }
      },
    }),
};
