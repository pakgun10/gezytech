// ─── Book Engine: Service Layer ──────────────────────────────────────────────
import { db } from "@/server/db/index";
import {
  books,
  bookSpines,
  bookChapters,
  bookPages,
  bookBlocks,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { v7 as uuid } from "uuid";
import type {
  Book,
  BookProposal,
  Spine,
  Page,
  Block,
  BlockType,
} from "@gezy/sdk";

// ─── Book CRUD ───────────────────────────────────────────────────────────────

export async function listBooks(userId: string): Promise<Book[]> {
  const rows = db.select().from(books).where(eq(books.userId, userId)).all();
  return rows.map(mapBook);
}

export async function getBook(bookId: string): Promise<Book | null> {
  const row = db.select().from(books).where(eq(books.id, bookId)).get();
  return row ? mapBook(row) : null;
}

export async function createBookRecord(
  userId: string,
  title: string,
  language: string = "en",
  knowledgeBaseIds: string[] = [],
): Promise<Book> {
  const now = new Date();
  const book = {
    id: uuid(),
    userId,
    title,
    description: null,
    status: "draft" as const,
    language,
    chapterCount: 0,
    pageCount: 0,
    knowledgeBaseIds: JSON.stringify(knowledgeBaseIds),
    proposal: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(books)
    .values(book as any)
    .run();
  return mapBook(book);
}

export async function updateBookProposal(
  bookId: string,
  proposal: BookProposal,
): Promise<void> {
  const now = new Date();
  db.update(books)
    .set({
      title: proposal.title,
      description: proposal.description,
      proposal: JSON.stringify(proposal),
      chapterCount: proposal.estimatedChapters,
      status: "spine_ready",
      updatedAt: now as any,
    })
    .where(eq(books.id, bookId))
    .run();
}

export async function updateBookStatus(
  bookId: string,
  status: string,
  extra: Partial<{ pageCount: number; chapterCount: number }> = {},
): Promise<void> {
  const now = new Date();
  const set: Record<string, unknown> = { status, updatedAt: now };
  if (extra.pageCount !== undefined) set.pageCount = extra.pageCount;
  if (extra.chapterCount !== undefined) set.chapterCount = extra.chapterCount;
  db.update(books).set(set).where(eq(books.id, bookId)).run();
}

export async function deleteBook(bookId: string): Promise<void> {
  db.delete(books).where(eq(books.id, bookId)).run();
}

// ─── Spine CRUD ──────────────────────────────────────────────────────────────

export async function saveSpine(spine: Spine): Promise<void> {
  const existing = db
    .select()
    .from(bookSpines)
    .where(eq(bookSpines.bookId, spine.bookId))
    .get();
  const data = {
    bookId: spine.bookId,
    conceptGraph: JSON.stringify(spine.conceptGraph),
    createdAt: new Date(),
  };
  if (existing) {
    db.update(bookSpines)
      .set({ conceptGraph: data.conceptGraph })
      .where(eq(bookSpines.bookId, spine.bookId))
      .run();
  } else {
    db.insert(bookSpines)
      .values({ id: uuid(), ...data } as any)
      .run();
  }

  // Upsert chapters
  for (const ch of spine.chapters) {
    const chRow = db
      .select()
      .from(bookChapters)
      .where(
        and(eq(bookChapters.bookId, spine.bookId), eq(bookChapters.id, ch.id)),
      )
      .get();
    const chData = {
      bookId: spine.bookId,
      title: ch.title,
      order: ch.order,
      learningObjectives: JSON.stringify(ch.learningObjectives),
      contentTypes: JSON.stringify(ch.contentTypes),
      pageIds: JSON.stringify(ch.pageIds),
    };
    if (chRow) {
      db.update(bookChapters)
        .set(chData)
        .where(eq(bookChapters.id, ch.id))
        .run();
    } else {
      db.insert(bookChapters)
        .values({ id: ch.id, ...chData })
        .run();
    }
  }
}

export async function getSpine(bookId: string): Promise<Spine | null> {
  const spineRow = db
    .select()
    .from(bookSpines)
    .where(eq(bookSpines.bookId, bookId))
    .get();
  if (!spineRow) return null;

  const chapterRows = db
    .select()
    .from(bookChapters)
    .where(eq(bookChapters.bookId, bookId))
    .all();
  const chapters = chapterRows
    .sort((a, b) => a.order - b.order)
    .map((row) => ({
      id: row.id,
      title: row.title,
      order: row.order,
      learningObjectives: JSON.parse(row.learningObjectives ?? "[]"),
      contentTypes: JSON.parse(row.contentTypes ?? "[]"),
      pageIds: JSON.parse(row.pageIds ?? "[]"),
    }));

  return {
    bookId,
    chapters,
    conceptGraph: JSON.parse(spineRow.conceptGraph),
  };
}

// ─── Page CRUD ───────────────────────────────────────────────────────────────

export async function createPageShell(
  bookId: string,
  chapterId: string,
  title: string,
  order: number,
): Promise<{ id: string }> {
  const now = new Date();
  const page = {
    id: uuid(),
    bookId,
    chapterId,
    title,
    order,
    status: "pending" as const,
    blocks: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(bookPages)
    .values(page as any)
    .run();
  return { id: page.id };
}

export async function getPage(bookId: string, pageId: string) {
  const row = db
    .select()
    .from(bookPages)
    .where(and(eq(bookPages.bookId, bookId), eq(bookPages.id, pageId)))
    .get();
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.bookId,
    chapterId: row.chapterId,
    title: row.title,
    order: row.order,
    status: row.status,
    blocks: row.blocks ? JSON.parse(row.blocks) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPages(bookId: string) {
  const rows = db
    .select()
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId))
    .all();
  return rows
    .sort((a, b) => a.order - b.order)
    .map((row) => ({
      id: row.id,
      bookId: row.bookId,
      chapterId: row.chapterId,
      title: row.title,
      order: row.order,
      status: row.status,
      blocks: row.blocks ? JSON.parse(row.blocks) : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}

export async function savePage(
  pageId: string,
  updates: { status?: string; blocks?: Block[] },
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.blocks !== undefined) set.blocks = JSON.stringify(updates.blocks);
  db.update(bookPages).set(set).where(eq(bookPages.id, pageId)).run();
}

export async function deletePage(bookId: string, pageId: string) {
  db.delete(bookPages)
    .where(and(eq(bookPages.bookId, bookId), eq(bookPages.id, pageId)))
    .run();
}

// ─── Block CRUD ──────────────────────────────────────────────────────────────

export async function insertBlock(pageId: string, block: Block): Promise<void> {
  db.insert(bookBlocks)
    .values({
      id: block.id,
      pageId,
      type: block.type,
      order: block.order,
      content: JSON.stringify(block.content),
      status: block.status,
      sourceAnchors: block.sourceAnchors
        ? JSON.stringify(block.sourceAnchors)
        : null,
    })
    .run();
}

export async function updateBlock(
  blockId: string,
  updates: {
    content?: Record<string, unknown>;
    status?: string;
    order?: number;
  },
) {
  const set: Record<string, unknown> = {};
  if (updates.content !== undefined)
    set.content = JSON.stringify(updates.content);
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.order !== undefined) set.order = updates.order;
  db.update(bookBlocks).set(set).where(eq(bookBlocks.id, blockId)).run();
}

export async function deleteBlock(blockId: string): Promise<void> {
  db.delete(bookBlocks).where(eq(bookBlocks.id, blockId)).run();
}

export async function getBlocks(pageId: string): Promise<Block[]> {
  const rows = db
    .select()
    .from(bookBlocks)
    .where(eq(bookBlocks.pageId, pageId))
    .all();
  return rows
    .sort((a, b) => a.order - b.order)
    .map((row) => ({
      id: row.id,
      type: row.type as BlockType,
      order: row.order,
      content: JSON.parse(row.content),
      status: row.status as Block["status"],
      sourceAnchors: row.sourceAnchors
        ? JSON.parse(row.sourceAnchors)
        : undefined,
    }));
}

// ─── Mapping Helpers ─────────────────────────────────────────────────────────

function mapBook(row: Record<string, unknown>): Book {
  return {
    id: row.id as string,
    userId: row.userId as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as Book["status"],
    language: row.language as string,
    chapterCount: row.chapterCount as number,
    pageCount: row.pageCount as number,
    knowledgeBaseIds: JSON.parse((row.knowledgeBaseIds as string) ?? "[]"),
    proposal: row.proposal ? JSON.parse(row.proposal as string) : null,
    createdAt: row.createdAt as number,
    updatedAt: row.updatedAt as number,
  };
}
