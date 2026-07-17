// ─── Book Engine: RAG Service ────────────────────────────────────────────────
import type { SourceChunk } from "@gezy/sdk";
import { db } from "@/server/db/index";
import { knowledgeSources, knowledgeChunks } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/logger";

const log = createLogger("book:rag");

/** Explore knowledge bases for content relevant to a book's topic */
export async function exploreSourcesForBook(
  bookId: string,
  knowledgeBaseIds: string[],
): Promise<SourceChunk[]> {
  if (!knowledgeBaseIds.length) return [];

  log.info(`Exploring ${knowledgeBaseIds.length} KBs for book ${bookId}`);

  const chunks: SourceChunk[] = [];

  for (const kbId of knowledgeBaseIds) {
    try {
      // Query chunks from this knowledge base
      const rows = db
        .select({
          id: knowledgeChunks.id,
          content: knowledgeChunks.content,
        })
        .from(knowledgeChunks)
        .innerJoin(
          knowledgeSources,
          eq(knowledgeChunks.sourceId as any, knowledgeSources.id) as any,
        )
        .where(eq(knowledgeSources.id, kbId))
        .limit(100)
        .all();

      for (const row of rows) {
        chunks.push({
          kbId,
          chunkId: row.id,
          text: row.content.substring(0, 2000), // Truncate for prompt
          relevance: 1.0, // Default relevance
        });
      }
    } catch (err) {
      log.warn(`Failed to explore KB ${kbId}: ${err}`);
    }
  }

  log.info(
    `Found ${chunks.length} chunks across ${knowledgeBaseIds.length} KBs`,
  );
  return chunks;
}

/** Retrieve relevant chunks for a specific block generation */
export async function retrieveForBlock(
  chapterTitle: string,
  blockType: string,
  knowledgeBaseIds: string[],
): Promise<SourceChunk[]> {
  // Simple keyword-based retrieval — in production, use embeddings + vector search
  // For now, return top chunks with basic filtering
  const allChunks = await exploreSourcesForBook("retrieval", knowledgeBaseIds);

  // Simple relevance: prefer chunks containing chapter title keywords
  const keywords = chapterTitle.toLowerCase().split(/\s+/);
  const scored = allChunks.map((chunk) => {
    const text = chunk.text.toLowerCase();
    const score =
      keywords.filter((kw) => text.includes(kw)).length / keywords.length;
    return { ...chunk, relevance: score };
  });

  return scored.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
}
