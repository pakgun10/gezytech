// ─── Book Engine: Compiler ────────────────────────────────────────────────────
import type { Chapter, Page, Block, BlockType, SourceChunk } from "@gezy/sdk";
import { v7 as uuid } from "uuid";
import { getOrCreateEventBus } from "@/server/services/book/sse";
import { retrieveForBlock } from "@/server/services/book/rag";
import { pickAnyLLMModel } from "@/server/llm/core/resolve";
import { runOneShot } from "@/server/llm/core/run-oneshot";

const BLOCK_PROMPTS: Record<string, string> = {
  text: `Write an educational text section for a book chapter.

Chapter: {chapterTitle}
Learning Objectives: {objectives}
Previous Blocks: {previousBlocks}
Source Materials: {sources}
Language: {language}

Write 2-4 paragraphs that explain the concept clearly. Use examples. Format as markdown.

Output JSON: { "title": "Section heading", "body": "Markdown content" }`,

  quiz: `Create quiz questions for a book chapter.

Chapter: {chapterTitle}
Learning Objectives: {objectives}
Source Materials: {sources}
Language: {language}

Create 3 multiple-choice questions. Each question must have 4 options, one correct answer, and a brief explanation.

Output JSON: { "questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation": "..."}] }`,

  callout: `Create a helpful callout (tip, definition, or key point) for a book chapter.

Chapter: {chapterTitle}
Source Materials: {sources}
Language: {language}

Create ONE concise callout.

Output JSON: { "type": "tip|warning|definition|info", "body": "Callout content (1-2 sentences)" }`,
};

/**
 * Plan which block types should appear on a given page.
 * Phase 1: text + 1-2 callouts + quiz (if assessment chapter)
 */
function planBlocks(chapter: Chapter): BlockType[] {
  const types: BlockType[] = ["text"];

  // Add callout after text
  types.push("callout");

  // Add quiz if chapter includes assessment
  if (chapter.contentTypes.includes("quiz")) {
    types.push("quiz");
  }

  return types;
}

/**
 * Compile a single page: plan blocks → generate each block → return completed page.
 */
export async function compilePage(
  bookId: string,
  chapter: Chapter,
  page: Page,
  knowledgeBaseIds: string[],
  language: string,
  bus?: ReturnType<typeof getOrCreateEventBus>,
): Promise<Page> {
  const eventBus = bus || getOrCreateEventBus(bookId);

  eventBus.emit("page_compile_started", bookId, {
    pageId: page.id,
    chapterId: chapter.id,
    title: page.title,
  });

  // Plan
  const plannedTypes = planBlocks(chapter);

  // Generate blocks sequentially
  const blocks: Block[] = [];
  for (let i = 0; i < plannedTypes.length; i++) {
    const blockType = plannedTypes[i]!;
    eventBus.emit("block_started", bookId, {
      pageId: page.id,
      blockType,
      blockIndex: i,
    });

    try {
      const block = await generateBlock(
        blockType,
        chapter,
        page,
        knowledgeBaseIds,
        language,
        blocks, // previous blocks for context
      );

      block.order = i;
      blocks.push(block);

      eventBus.emit("block_ready", bookId, {
        pageId: page.id,
        blockId: block.id,
        blockType,
        blockIndex: i,
      });
    } catch (err) {
      // Push error block
      blocks.push({
        id: uuid(),
        type: blockType,
        order: i,
        content: { error: String(err) },
        status: "error",
      });
    }
  }

  eventBus.emit("page_ready", bookId, {
    pageId: page.id,
    blockCount: blocks.length,
  });

  return {
    ...page,
    blocks,
    status: blocks.some((b) => b.status === "error") ? "error" : "ready",
  };
}

/**
 * Generate a single block using LLM + RAG via the project's provider connection system.
 */
async function generateBlock(
  type: BlockType,
  chapter: Chapter,
  page: Page,
  knowledgeBaseIds: string[],
  language: string,
  previousBlocks: Block[],
): Promise<Block> {
  const prompt = BLOCK_PROMPTS[type] ?? BLOCK_PROMPTS.text!;

  // Retrieve relevant sources
  const sources = await retrieveForBlock(chapter.title, type, knowledgeBaseIds);
  const sourceText =
    sources.length > 0
      ? sources.map((s) => s.text).join("\n\n---\n\n")
      : "No specific sources available. Use general knowledge.";

  const previousSummary =
    previousBlocks.length > 0
      ? previousBlocks
          .map(
            (b) => `[${b.type}] ${JSON.stringify(b.content).substring(0, 100)}`,
          )
          .join("\n")
      : "None (this is the first block)";

  const systemPrompt = `You generate educational content blocks. Always output valid JSON. Respond in ${language}.`;

  const userPrompt = prompt
    .replace("{chapterTitle}", chapter.title)
    .replace("{objectives}", chapter.learningObjectives.join(", "))
    .replace("{sources}", sourceText.substring(0, 3000))
    .replace("{language}", language)
    .replace("{previousBlocks}", previousSummary);

  // Use the project's provider connection system
  const resolved = await pickAnyLLMModel();
  if (!resolved) {
    throw new Error(
      "No LLM provider configured. Go to Settings → Provider Connections to add one.",
    );
  }

  const result = await runOneShot(resolved, {
    system: [{ type: "text", text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }],
      },
    ],
  });

  const raw = result.text;
  if (!raw) throw new Error("LLM call returned empty response");

  let json = raw.trim();
  if (json.startsWith("```")) {
    json = json.slice(json.indexOf("\n") + 1, json.lastIndexOf("```")).trim();
  }

  const content = JSON.parse(json);

  return {
    id: uuid(),
    type,
    order: 0, // Will be set by caller
    content,
    status: "ready",
    sourceAnchors: sources
      .slice(0, 3)
      .map((s) => ({ kbId: s.kbId, chunkId: s.chunkId })),
  };
}
