import { Hono } from "hono";
import type { AppVariables } from "@/server/app";
import { createLogger } from "@/server/logger";
import { authMiddleware } from "@/server/auth/middleware";
import {
  listBooks,
  getBook,
  createBookRecord,
  updateBookProposal,
  updateBookStatus,
  deleteBook,
  saveSpine,
  getSpine,
  createPageShell,
  getPage,
  listPages,
  savePage,
  getBlocks,
  insertBlock,
  updateBlock,
  deleteBlock,
} from "@/server/services/book";
import { generateProposal, summarizeKBs } from "@/server/agents/book/ideation";
import { synthesizeSpine } from "@/server/agents/book/spine";
import { compilePage } from "@/server/agents/book/compiler";
import { exploreSourcesForBook } from "@/server/services/book/rag";
import {
  setupBookSSE,
  getOrCreateEventBus,
  removeEventBus,
} from "@/server/services/book/sse";
import {
  exportBookToDocx,
  exportBookToPdf,
} from "@/server/services/book/export";
import { bookProposalSchema, spineSchema } from "@gezy/sdk";
import { config } from "@/server/config";
import { pickAnyLLMModel } from "@/server/llm/core/resolve";
import { runOneShot } from "@/server/llm/core/run-oneshot";

const log = createLogger("routes:books");

/**
 * LLM call wrapper that uses the project's provider connection system
 * ("Manage your provider connections" in settings) instead of raw
 * OPENAI_API_KEY env vars. Falls back to any available LLM provider.
 */
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const resolved = await pickAnyLLMModel();
  if (!resolved) {
    throw new Error(
      "No LLM provider configured. Go to Settings → Provider Connections and add at least one LLM provider.",
    );
  }

  // Pick a JSON-capable model: prefer gpt-4o-mini or any model the user has configured
  const preferredModels = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
  let targetResolved = resolved;
  for (const modelId of preferredModels) {
    try {
      const { resolveLLM } = await import("@/server/llm/core/resolve");
      targetResolved = await resolveLLM({
        modelId,
        providerId: resolved.providerRow.id,
      });
      break;
    } catch {
      // Try next model
    }
  }

  const result = await runOneShot(targetResolved, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return result.text;
}

export const bookRoutes = new Hono<{ Variables: AppVariables }>();

// ─── Book CRUD ───────────────────────────────────────────────────────────────

bookRoutes.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ books: await listBooks(user.id) });
});

bookRoutes.get("/:id", authMiddleware, async (c) => {
  const book = await getBook(c.req.param("id")!);
  if (!book) return c.json({ error: "Book not found" }, 404);
  return c.json({ book });
});

bookRoutes.delete("/:id", authMiddleware, async (c) => {
  await deleteBook(c.req.param("id")!);
  removeEventBus(c.req.param("id")!);
  return c.json({ ok: true });
});

// ─── Pipeline ────────────────────────────────────────────────────────────────

// Stage 1: Create book + ideation
bookRoutes.post("/", authMiddleware, async (c) => {
  const body = await c.req.json();
  const { userIntent, knowledgeBaseIds = [], language = "en" } = body;

  if (!userIntent || userIntent.length < 10) {
    return c.json({ error: "userIntent must be at least 10 characters" }, 400);
  }

  const user = c.get("user");

  // Create draft book
  const book = await createBookRecord(
    user.id,
    "Generating...",
    language,
    knowledgeBaseIds,
  );
  const bus = getOrCreateEventBus(book.id);

  // Run ideation
  bus.emit("ideation_started", book.id);

  try {
    const proposal = await generateProposal(
      {
        userIntent,
        knowledgeBaseIds,
        kbSummaries: summarizeKBs(knowledgeBaseIds),
        language,
      },
      callLLM,
    );

    await updateBookProposal(book.id, proposal);
    bus.emit("proposal_ready", book.id, { proposal });

    return c.json({ bookId: book.id, proposal });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, bookId: book.id }, "Failed to generate proposal");
    bus.emit("error", book.id, { message });

    // Determine appropriate status code
    const status = message.includes("LLM call failed") ? 502 : 500;
    const code = message.includes("LLM call failed")
      ? "LLM_ERROR"
      : "PROPOSAL_FAILED";
    return c.json({ error: { code, message } }, status as 500 | 502);
  }
});

// Stage 2: Spine synthesis
bookRoutes.post("/:id/spine", authMiddleware, async (c) => {
  const bookId = c.req.param("id")!;
  const book = await getBook(bookId);
  if (!book) return c.json({ error: "Book not found" }, 404);

  const bus = getOrCreateEventBus(bookId);
  bus.emit("spine_synthesis_started", bookId);

  try {
    // Explore KBs
    bus.emit("exploration_started", bookId);
    const chunks = await exploreSourcesForBook(bookId, book.knowledgeBaseIds);
    bus.emit("exploration_ready", bookId, { chunkCount: chunks.length });

    // Synthesize
    const spine = await synthesizeSpine(
      book.proposal!,
      chunks,
      book.language,
      callLLM,
      (label: string, payload: unknown) =>
        bus.emit("spine_round" as any, bookId, {
          round: label,
          ...(payload as object),
        }),
    );

    await saveSpine(spine);
    await updateBookStatus(bookId, "spine_ready", {
      chapterCount: spine.chapters.length,
    });
    bus.emit("spine_ready", bookId, { chapterCount: spine.chapters.length });

    return c.json({ spine });
  } catch (err) {
    bus.emit("error", bookId, { message: String(err) });
    throw err;
  }
});

bookRoutes.get("/:id/spine", authMiddleware, async (c) => {
  const spine = await getSpine(c.req.param("id")!);
  if (!spine) return c.json({ error: "Spine not found" }, 404);
  return c.json({ spine });
});

// Stage 3: Compile
bookRoutes.post("/:id/compile", authMiddleware, async (c) => {
  const bookId = c.req.param("id")!;
  const book = await getBook(bookId);
  const spine = await getSpine(bookId);
  if (!book || !spine) return c.json({ error: "Book or spine not found" }, 404);

  const bus = getOrCreateEventBus(bookId);

  // Create page shells if needed
  const existingPages = await listPages(bookId);
  if (existingPages.length === 0) {
    for (const chapter of spine.chapters) {
      const { id } = await createPageShell(
        bookId,
        chapter.id,
        chapter.title,
        chapter.order,
      );
      chapter.pageIds = [id];
    }
    await saveSpine(spine);
  }

  await updateBookStatus(bookId, "compiling");

  // Compile pages (background — returns immediately, status via SSE)
  const pages = await listPages(bookId);

  // Start compilation asynchronously
  (async () => {
    for (const page of pages) {
      if (page.status === "ready") continue;
      try {
        const chapter = spine.chapters.find((c) => c.id === page.chapterId);
        if (!chapter) continue;

        const compiled = await compilePage(
          bookId,
          chapter,
          page as any,
          book.knowledgeBaseIds,
          book.language,
          bus,
        );
        await savePage(compiled.id, {
          status: "ready",
          blocks: compiled.blocks,
        });
      } catch (err) {
        log.error({ err }, `Failed to compile page ${page.id}`);
        await savePage(page.id, { status: "error" });
      }
    }

    await updateBookStatus(bookId, "ready", { pageCount: pages.length });
    bus.emit("book_ready", bookId, { pageCount: pages.length });
  })();

  return c.json({ compiling: true, pageCount: pages.length });
});

// Compile single page
bookRoutes.post("/:id/pages/:pageId/compile", authMiddleware, async (c) => {
  const { id: bookId, pageId } = c.req.param();
  const book = await getBook(bookId!);
  const spine = await getSpine(bookId!);
  const page = await getPage(bookId!, pageId!);
  if (!book || !spine || !page) return c.json({ error: "Not found" }, 404);

  const bus = getOrCreateEventBus(bookId!);
  const chapter = spine.chapters.find((ch) => ch.id === page.chapterId);
  if (!chapter) return c.json({ error: "Chapter not found" }, 404);

  const compiled = await compilePage(
    bookId!,
    chapter,
    page as any,
    book.knowledgeBaseIds,
    book.language,
    bus,
  );
  await savePage(compiled.id, { status: "ready", blocks: compiled.blocks });

  return c.json({ page: compiled });
});

// ─── Pages ───────────────────────────────────────────────────────────────────

bookRoutes.get("/:id/pages", authMiddleware, async (c) => {
  return c.json({ pages: await listPages(c.req.param("id")!) });
});

bookRoutes.get("/:id/pages/:pageId", authMiddleware, async (c) => {
  const page = await getPage(c.req.param("id")!, c.req.param("pageId")!);
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json({ page });
});

// ─── Blocks ──────────────────────────────────────────────────────────────────

bookRoutes.post("/:id/pages/:pageId/blocks", authMiddleware, async (c) => {
  const { pageId } = c.req.param();
  const body = await c.req.json();
  const { type, afterBlockId } = body;

  const existingBlocks = await getBlocks(pageId!);
  let order = existingBlocks.length;
  if (afterBlockId) {
    const idx = existingBlocks.findIndex((b) => b.id === afterBlockId);
    if (idx >= 0) order = idx + 1;
  }

  const block = {
    id: crypto.randomUUID(),
    type,
    order,
    content: {},
    status: "pending" as const,
  };

  await insertBlock(pageId!, block);

  // Return blocks sorted
  const updated = await getBlocks(pageId!);
  await savePage(pageId!, { blocks: updated });

  return c.json({ block });
});

bookRoutes.delete(
  "/:id/pages/:pageId/blocks/:blockId",
  authMiddleware,
  async (c) => {
    await deleteBlock(c.req.param("blockId")!);
    const blocks = await getBlocks(c.req.param("pageId")!);
    await savePage(c.req.param("pageId")!, { blocks });
    return c.json({ ok: true });
  },
);

// ─── SSE Stream ──────────────────────────────────────────────────────────────

bookRoutes.get("/:id/stream", authMiddleware, async (c) => {
  return setupBookSSE(c, c.req.param("id")!);
});

// ─── Export ──────────────────────────────────────────────────────────────────

bookRoutes.get("/:id/export/markdown", authMiddleware, async (c) => {
  const bookId = c.req.param("id")!;
  const book = await getBook(bookId);
  const spine = await getSpine(bookId);
  if (!book || !spine) return c.json({ error: "Book not found" }, 404);

  let md = `---\ntitle: "${book.title}"\ndescription: "${book.description || ""}"\nlanguage: ${book.language}\nchapters: ${book.chapterCount}\n---\n\n# ${book.title}\n\n${book.description || ""}\n\n`;

  for (const chapter of spine.chapters) {
    md += `\n# ${chapter.title}\n\n`;
    md += `**Learning Objectives:** ${chapter.learningObjectives.join(", ")}\n\n`;

    for (const pageId of chapter.pageIds) {
      const page = await getPage(bookId, pageId);
      if (!page) continue;
      md += `## ${page.title}\n\n`;
      for (const block of page.blocks) {
        if (block.type === "text" && block.content.body) {
          md += block.content.body + "\n\n";
        } else if (block.type === "callout" && block.content.body) {
          md += `> **${block.content.type || "Note"}:** ${block.content.body}\n\n`;
        } else if (block.type === "quiz" && block.content.questions) {
          md += "### Quiz\n\n";
          for (const q of block.content.questions as any[]) {
            md += `**Q:** ${q.question}\n\n`;
            if (q.options) {
              for (const opt of q.options) {
                md += `- ${opt}\n`;
              }
            }
            md += `\n**A:** ${q.correct_answer}\n\n`;
          }
        }
      }
    }
  }

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.md"`,
    },
  });
});

bookRoutes.get("/:id/export/docx", authMiddleware, async (c) => {
  const bookId = c.req.param("id")!;
  const book = await getBook(bookId);
  if (!book) return c.json({ error: "Book not found" }, 404);
  const buffer = await exportBookToDocx(bookId);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.docx"`,
    },
  });
});

bookRoutes.get("/:id/export/pdf", authMiddleware, async (c) => {
  const bookId = c.req.param("id")!;
  const book = await getBook(bookId);
  if (!book) return c.json({ error: "Book not found" }, 404);
  const buffer = await exportBookToPdf(bookId);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
    },
  });
});
