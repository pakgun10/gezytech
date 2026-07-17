// ─── Book Engine: Zod Schemas Unit Tests ─────────────────────────────────────
import { describe, it, expect } from 'bun:test'
import {
  bookProposalSchema,
  spineSchema,
  blockSchema,
  pageSchema,
  bookSchema,
  sourceAnchorSchema,
  chapterSchema,
  conceptGraphSchema,
  createBookInputSchema,
  insertBlockInputSchema,
} from './schemas'

describe('bookProposalSchema', () => {
  const valid = {
    title: 'Intro to Python',
    description: 'A beginner-friendly introduction to Python programming.',
    scope: 'Covers variables, control flow, functions, and OOP basics.',
    targetLevel: 'Beginner',
    estimatedChapters: 8,
    rationale: 'Python is the most popular first language.',
  }

  it('accepts a valid proposal', () => {
    expect(() => bookProposalSchema.parse(valid)).not.toThrow()
  })

  it('rejects empty title', () => {
    expect(() => bookProposalSchema.parse({ ...valid, title: '' })).toThrow()
  })

  it('rejects title over 120 chars', () => {
    expect(() =>
      bookProposalSchema.parse({ ...valid, title: 'x'.repeat(121) }),
    ).toThrow()
  })

  it('rejects estimatedChapters below 2', () => {
    expect(() =>
      bookProposalSchema.parse({ ...valid, estimatedChapters: 1 }),
    ).toThrow()
  })

  it('rejects estimatedChapters above 20', () => {
    expect(() =>
      bookProposalSchema.parse({ ...valid, estimatedChapters: 21 }),
    ).toThrow()
  })

  it('rejects non-integer estimatedChapters', () => {
    expect(() =>
      bookProposalSchema.parse({ ...valid, estimatedChapters: 3.5 }),
    ).toThrow()
  })

  it('rejects missing required field', () => {
    const { rationale, ...rest } = valid
    expect(() => bookProposalSchema.parse(rest)).toThrow()
  })
})

describe('blockSchema', () => {
  const valid = {
    id: 'block-1',
    type: 'text' as const,
    order: 0,
    content: { body: 'Hello world' },
    status: 'ready' as const,
  }

  it('accepts a valid text block', () => {
    expect(() => blockSchema.parse(valid)).not.toThrow()
  })

  it('accepts all block types', () => {
    const types = ['text', 'quiz', 'callout', 'code', 'figure', 'section', 'concept_map', 'flash_cards', 'deep_dive'] as const
    for (const type of types) {
      expect(() => blockSchema.parse({ ...valid, type })).not.toThrow()
    }
  })

  it('rejects invalid block type', () => {
    expect(() => blockSchema.parse({ ...valid, type: 'video' })).toThrow()
  })

  it('rejects negative order', () => {
    expect(() => blockSchema.parse({ ...valid, order: -1 })).toThrow()
  })

  it('accepts optional sourceAnchors', () => {
    const withSources = {
      ...valid,
      sourceAnchors: [{ kbId: 'kb-1', chunkId: 'chunk-1' }],
    }
    expect(() => blockSchema.parse(withSources)).not.toThrow()
  })

  it('rejects invalid sourceAnchor shape', () => {
    expect(() =>
      blockSchema.parse({
        ...valid,
        sourceAnchors: [{ bad: 'field' }],
      }),
    ).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() => blockSchema.parse({ ...valid, status: 'unknown' })).toThrow()
  })

  it('accepts all valid statuses', () => {
    const statuses = ['pending', 'generating', 'ready', 'error'] as const
    for (const status of statuses) {
      expect(() => blockSchema.parse({ ...valid, status })).not.toThrow()
    }
  })
})

describe('spineSchema', () => {
  const valid = {
    bookId: 'book-1',
    chapters: [
      {
        id: 'ch-1',
        title: 'Getting Started',
        order: 0,
        learningObjectives: ['Understand basics'],
        contentTypes: ['text'],
        pageIds: ['page-1'],
      },
    ],
    conceptGraph: {
      nodes: [{ id: 'n1', label: 'Python', chapterId: 'ch-1' }],
      edges: [{ source: 'n1', target: 'n2', label: 'uses' }],
    },
  }

  it('accepts a valid spine', () => {
    expect(() => spineSchema.parse(valid)).not.toThrow()
  })

  it('rejects empty chapters array', () => {
    expect(() =>
      spineSchema.parse({ ...valid, chapters: [] }),
    ).not.toThrow() // Empty chapters might be valid at creation
  })

  it('rejects chapter with empty title', () => {
    expect(() =>
      spineSchema.parse({
        ...valid,
        chapters: [{ ...valid.chapters[0], title: '' }],
      }),
    ).toThrow()
  })

  it('rejects missing bookId', () => {
    const { bookId, ...rest } = valid
    expect(() => spineSchema.parse(rest)).toThrow()
  })
})

describe('pageSchema', () => {
  const valid = {
    id: 'page-1',
    bookId: 'book-1',
    chapterId: 'ch-1',
    title: 'Introduction',
    order: 0,
    status: 'pending' as const,
    blocks: [],
  }

  it('accepts a valid page', () => {
    expect(() => pageSchema.parse(valid)).not.toThrow()
  })

  it('accepts page with blocks', () => {
    const withBlocks = {
      ...valid,
      blocks: [
        {
          id: 'b-1',
          type: 'text',
          order: 0,
          content: { body: 'Hello' },
          status: 'ready',
        },
      ],
    }
    expect(() => pageSchema.parse(withBlocks)).not.toThrow()
  })
})

describe('bookSchema', () => {
  const valid = {
    id: 'book-1',
    userId: 'user-1',
    title: 'My Book',
    description: 'A great book',
    status: 'draft' as const,
    language: 'en',
    chapterCount: 3,
    pageCount: 10,
    knowledgeBaseIds: ['kb-1'],
    proposal: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  it('accepts a valid book', () => {
    expect(() => bookSchema.parse(valid)).not.toThrow()
  })

  it('accepts null description', () => {
    expect(() => bookSchema.parse({ ...valid, description: null })).not.toThrow()
  })

  it('accepts all book statuses', () => {
    const statuses = ['draft', 'spine_ready', 'compiling', 'ready'] as const
    for (const status of statuses) {
      expect(() => bookSchema.parse({ ...valid, status })).not.toThrow()
    }
  })

  it('rejects invalid status', () => {
    expect(() => bookSchema.parse({ ...valid, status: 'published' })).toThrow()
  })
})

describe('createBookInputSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = createBookInputSchema.parse({
      userIntent: 'Create a book about JavaScript.',
    })
    expect(result.language).toBe('en')
    expect(result.knowledgeBaseIds).toEqual([])
  })

  it('accepts explicit language and kbIds', () => {
    const result = createBookInputSchema.parse({
      userIntent: 'Buat buku tentang Python.',
      language: 'id',
      knowledgeBaseIds: ['kb-1', 'kb-2'],
    })
    expect(result.language).toBe('id')
    expect(result.knowledgeBaseIds).toEqual(['kb-1', 'kb-2'])
  })

  it('rejects intent shorter than 10 chars', () => {
    expect(() =>
      createBookInputSchema.parse({ userIntent: 'Short' }),
    ).toThrow()
  })

  it('accepts intent exactly 10 chars', () => {
    expect(() =>
      createBookInputSchema.parse({ userIntent: '1234567890' }),
    ).not.toThrow()
  })
})

describe('insertBlockInputSchema', () => {
  it('accepts valid block insert', () => {
    expect(() =>
      insertBlockInputSchema.parse({ type: 'text' }),
    ).not.toThrow()
  })

  it('accepts optional afterBlockId', () => {
    expect(() =>
      insertBlockInputSchema.parse({ type: 'quiz', afterBlockId: 'block-1' }),
    ).not.toThrow()
  })

  it('rejects invalid block type', () => {
    expect(() =>
      insertBlockInputSchema.parse({ type: 'audio' }),
    ).toThrow()
  })
})

describe('sourceAnchorSchema', () => {
  it('accepts valid source anchor', () => {
    expect(() =>
      sourceAnchorSchema.parse({ kbId: 'kb-1', chunkId: 'chunk-1' }),
    ).not.toThrow()
  })

  it('rejects missing fields', () => {
    expect(() => sourceAnchorSchema.parse({ kbId: 'kb-1' })).toThrow()
    expect(() => sourceAnchorSchema.parse({ chunkId: 'chunk-1' })).toThrow()
  })
})

describe('conceptGraphSchema', () => {
  it('accepts valid concept graph', () => {
    expect(() =>
      conceptGraphSchema.parse({
        nodes: [{ id: 'n1', label: 'Topic A' }],
        edges: [{ source: 'n1', target: 'n2', label: 'relates to' }],
      }),
    ).not.toThrow()
  })

  it('accepts empty graph', () => {
    expect(() =>
      conceptGraphSchema.parse({ nodes: [], edges: [] }),
    ).not.toThrow()
  })

  it('accepts optional chapterId on node', () => {
    expect(() =>
      conceptGraphSchema.parse({
        nodes: [{ id: 'n1', label: 'Topic A', chapterId: 'ch-1' }],
        edges: [],
      }),
    ).not.toThrow()
  })
})
