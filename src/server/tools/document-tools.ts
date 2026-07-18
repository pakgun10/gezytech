import { z } from "zod";
import { tool } from "@/server/tools/tool-helper";
import { createLogger } from "@/server/logger";
import { createFileFromContent } from "@/server/services/file-storage";
import { markdownToPdf } from "@/server/services/document-render";
import { markdownToDocxBuffer } from "@/server/services/document-render-docx";
import { playwrightManager } from "@/server/services/playwright-manager";
import { resolveToolWorkspace } from "@/server/tools/workspace";
import { resolve } from "path";
import { readFile } from "fs/promises";
import type { ToolRegistration } from "@/server/tools/types";

const log = createLogger("tools:document");

/**
 * generate_pdf — render markdown (with LaTeX math via `$…$` / `$$…$$` /
 * ```math``` fences) into a shareable PDF document, returns a shareable URL.
 *
 * Rendering happens in a headless Chromium page (Playwright) — math is rendered
 * to MathML so Chromium's native MathML engine draws it in the PDF. Fully
 * offline (no external fonts/CDN). Available to main agents only.
 *
 * The tool always registers but returns a runtime error when no headless
 * browser is available (so the Agent knows the capability exists and can tell
 * the user to enable it).
 */
export const generatePdfTool: ToolRegistration = {
  availability: ["main"],
  create: (ctx) =>
    tool({
      description:
        "Render markdown content (headings, lists, tables, code blocks, and LaTeX math with $...$ / $$...$$ / ```math``` fences) into a PDF document and get a shareable URL. Use this for substantial written deliverables (reports, study notes, physics/math solutions) instead of dumping long content in a chat message. Always share the URL with the user afterwards.",
      inputSchema: z.object({
        content: z
          .string()
          .describe(
            "Markdown source of the document. Supports GFM tables, task lists, fenced code, and LaTeX math.",
          ),
        title: z
          .string()
          .optional()
          .describe(
            "Document title (used for the browser tab / PDF metadata and as filename fallback).",
          ),
        filename: z
          .string()
          .optional()
          .describe(
            'Shareable file name (without extension). Defaults to the title or "document".',
          ),
        format: z
          .enum(["A4", "Letter"])
          .optional()
          .describe("Page size. Default: A4."),
        landscape: z
          .boolean()
          .optional()
          .describe("Landscape orientation. Default: false (portrait)."),
      }),
      execute: async (args) => {
        if (!playwrightManager.isEnabled) {
          return {
            error:
              "PDF generation unavailable — the headless browser is disabled. Ask the user to set WEB_BROWSING_HEADLESS_ENABLED=true and ensure Chromium is installed in the container.",
          };
        }

        const content = args.content?.trim();
        if (!content) return { error: "content is required (markdown)." };

        try {
          const { buffer } = await markdownToPdf(content, args.title, {
            format: args.format,
            landscape: args.landscape,
          });

          const baseName =
            (args.filename || args.title || "document")
              .trim()
              .replace(/[^a-zA-Z0-9._-]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .slice(0, 80) || "document";

          const stored = await createFileFromContent(
            ctx.agentId,
            baseName,
            buffer.toString("base64"),
            "application/pdf",
            {
              isBase64: true,
              createdByAgentId: ctx.agentId,
              description: args.title,
            },
          );

          log.info(
            { agentId: ctx.agentId, size: buffer.length },
            "PDF generated + stored",
          );
          return stored;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to generate PDF";
          log.error(
            { error: err, agentId: ctx.agentId },
            "generate_pdf failed",
          );
          return { error: message };
        }
      },
    }),
};

export const generateDocxTool: ToolRegistration = {
  availability: ["main"],
  create: (ctx) =>
    tool({
      description:
        "Render markdown content (headings, lists, tables, code blocks, and LaTeX math with $...$ / $$...$$ / ```math``` fences) into a Word (.docx) document with native editable equations (OMML), and get a shareable URL.\n\n" +
        "USE CASES:\n" +
        "- RPP/RPM/Modul Ajar (Kurikulum Merdeka): generate_docx({title: 'RPP Matematika Kelas 7', ...})\n" +
        "- Laporan penelitian / bahan ajar: generate_docx({...})\n" +
        "- Study notes / physics/math solutions with equations\n\n" +
        "FOR LONG DOCUMENTS (>400 lines markdown):\n" +
        "1. write_file('rpp_part1.md', ...), write_file('rpp_part2.md', ...)\n" +
        "2. run_shell('cat rpp_part2.md >> rpp_part1.md')\n" +
        "3. generate_docx({source: 'workspace', path: 'rpp_part1.md', ...})\n\n" +
        "BEFORE generating RPP, always READ reference files from file storage:\n" +
        "1. list_stored_files() to see available references\n" +
        "2. download_stored_file(name='CP.pdf') → read_file() — KUTIP CP, jangan mengarang\n" +
        "3. download_stored_file(name='PPM.pdf') → read_file() — 8 DPL + 3 Prinsip + 3 Pengalaman + 4 Kerangka PM\n" +
        "4. download_stored_file(name='atp.docx') → read_file() — ikuti alur TP\n" +
        "5. download_stored_file(name='rpm.docx') → read_file() — tiru format contoh\n\n" +
        "RPP must have 15 components: Identitas, CP, TP, DPL (8 dimensi), Model/Pendekatan/Metode, Prinsip PM, Pengalaman PM, Kerangka PM, Langkah Pembelajaran, Asesmen, KKTP, LKPD, Media/Sumber, Refleksi, Pengayaan & Remedial, Glosarium, Tanda Tangan, Lampiran.\n\n" +
        "VERIFICATION: run_shell('python3 -c \"import zipfile; ...\"') to check OMML equations.\n\n" +
        "Always share the returned URL with the user.",
      inputSchema: z.object({
        source: z
          .enum(["content", "workspace"])
          .default("content")
          .describe(
            "'content' for inline markdown, 'workspace' to read from a workspace file (use for very long documents).",
          ),
        content: z
          .string()
          .optional()
          .describe(
            'Markdown source of the document. Required when source="content".',
          ),
        path: z
          .string()
          .optional()
          .describe('Workspace file path. Required when source="workspace".'),
        title: z
          .string()
          .optional()
          .describe(
            "Document title (used for metadata and as filename fallback).",
          ),
        filename: z
          .string()
          .optional()
          .describe(
            'Shareable file name (without extension). Defaults to the title or "document".',
          ),
      }),
      execute: async (args) => {
        let content: string;

        if (args.source === "workspace") {
          if (!args.path)
            return { error: 'path is required when source="workspace".' };
          const workspace = resolveToolWorkspace(ctx as any);
          const absPath = resolve(workspace, args.path);
          if (!absPath.startsWith(workspace))
            return { error: "Path must be within the workspace." };
          try {
            content = await readFile(absPath, "utf-8");
          } catch {
            return { error: `File not found: ${args.path}` };
          }
        } else {
          content = args.content ?? "";
        }

        if (!content.trim())
          return { error: "content is required (markdown)." };

        try {
          const buffer = await markdownToDocxBuffer(content, args.title);

          const baseName =
            (args.filename || args.title || "document")
              .trim()
              .replace(/[^a-zA-Z0-9._-]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .slice(0, 80) || "document";

          const stored = await createFileFromContent(
            ctx.agentId,
            baseName,
            buffer.toString("base64"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            {
              isBase64: true,
              createdByAgentId: ctx.agentId,
              description: args.title,
            },
          );

          log.info(
            { agentId: ctx.agentId, size: buffer.length },
            "DOCX generated + stored",
          );
          return stored;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to generate document";
          log.error(
            { error: err, agentId: ctx.agentId },
            "generate_docx failed",
          );
          return { error: message };
        }
      },
    }),
};
