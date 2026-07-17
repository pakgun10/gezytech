import { z } from 'zod';

// ─── Book Engine: Zod Validation Schemas ──────────────────────────────────────

const blockTypeSchema = z.enum([
  'text',
  'quiz',
  'callout',
  'code',
  'figure',
  'section',
  'concept_map',
  'flash_cards',
  'deep_dive',
]);

export const sourceAnchorSchema = z.object({
  kbId: z.string(),
  chunkId: z.string(),
});

export const blockSchema = z.object({
  id: z.string(),
  type: blockTypeSchema,
  order: z.number().int().min(0),
  content: z.record(z.string(), z.unknown()),
  status: z.enum(['pending', 'generating', 'ready', 'error']),
  sourceAnchors: z.array(sourceAnchorSchema).optional(),
});

export const bookProposalSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string(),
  scope: z.string(),
  targetLevel: z.string(),
  estimatedChapters: z.number().int().min(2).max(20),
  rationale: z.string(),
});

export const conceptNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  chapterId: z.string().optional(),
});

export const conceptEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
});

export const conceptGraphSchema = z.object({
  nodes: z.array(conceptNodeSchema),
  edges: z.array(conceptEdgeSchema),
});

export const chapterSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  order: z.number().int().min(0),
  learningObjectives: z.array(z.string()),
  contentTypes: z.array(z.string()),
  pageIds: z.array(z.string()),
});

export const spineSchema = z.object({
  bookId: z.string(),
  chapters: z.array(chapterSchema),
  conceptGraph: conceptGraphSchema,
});

export const pageSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  chapterId: z.string(),
  title: z.string(),
  order: z.number().int().min(0),
  status: z.enum(['pending', 'generating', 'ready', 'error']),
  blocks: z.array(blockSchema),
});

export const bookSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'spine_ready', 'compiling', 'ready']),
  language: z.string(),
  chapterCount: z.number().int().min(0),
  pageCount: z.number().int().min(0),
  knowledgeBaseIds: z.array(z.string()),
  proposal: bookProposalSchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// ─── API Input Schemas ────────────────────────────────────────────────────────

export const createBookInputSchema = z.object({
  userIntent: z.string().min(10, 'Intent must be at least 10 characters'),
  knowledgeBaseIds: z.array(z.string()).default([]),
  language: z.string().default('en'),
});

export const updateProposalInputSchema = bookProposalSchema.partial();

export const updateSpineInputSchema = z.object({
  chapters: z.array(chapterSchema),
});

export const insertBlockInputSchema = z.object({
  type: blockTypeSchema,
  afterBlockId: z.string().optional(),
});

export const updateBlockContentInputSchema = z.object({
  content: z.record(z.string(), z.unknown()),
});
