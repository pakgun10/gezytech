// ─── Book Engine: TypeScript Types ────────────────────────────────────────────

export type BookStatus = 'draft' | 'spine_ready' | 'compiling' | 'ready';
export type PageStatus = 'pending' | 'generating' | 'ready' | 'error';
export type BlockStatus = 'pending' | 'generating' | 'ready' | 'error';

export type BlockType =
  | 'text'
  | 'quiz'
  | 'callout'
  | 'code'
  | 'figure'
  | 'section'
  | 'concept_map'
  | 'flash_cards'
  | 'deep_dive';

export interface BookProposal {
  title: string;
  description: string;
  scope: string;
  targetLevel: string;
  estimatedChapters: number;
  rationale: string;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  learningObjectives: string[];
  contentTypes: string[];
  pageIds: string[];
}

export interface ConceptNode {
  id: string;
  label: string;
  chapterId?: string;
}

export interface ConceptEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ConceptGraph {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export interface Spine {
  bookId: string;
  chapters: Chapter[];
  conceptGraph: ConceptGraph;
}

export interface SourceAnchor {
  kbId: string;
  chunkId: string;
}

export interface Block {
  id: string;
  type: BlockType;
  order: number;
  content: Record<string, unknown>;
  status: BlockStatus;
  sourceAnchors?: SourceAnchor[];
}

export interface Page {
  id: string;
  bookId: string;
  chapterId: string;
  title: string;
  order: number;
  status: PageStatus;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: BookStatus;
  language: string;
  chapterCount: number;
  pageCount: number;
  knowledgeBaseIds: string[];
  proposal: BookProposal | null;
  createdAt: number;
  updatedAt: number;
}

export interface SourceChunk {
  kbId: string;
  chunkId: string;
  text: string;
  relevance: number;
}

/** SSE event types emitted during book compilation */
export type BookEventType =
  | 'ideation_started'
  | 'proposal_ready'
  | 'exploration_started'
  | 'exploration_ready'
  | 'spine_synthesis_started'
  | 'spine_round'
  | 'spine_ready'
  | 'page_compile_started'
  | 'block_started'
  | 'block_ready'
  | 'page_ready'
  | 'book_ready'
  | 'error';
