// ─── Book Engine: Export Service Unit Tests ────────────────────────────────────
//
// Tests for markdown rendering and export logic.
// DB-dependent functions (buildBookMarkdown, exportBookToDocx, exportBookToPdf)
// are NOT tested here — they require a running SQLite database.

import { describe, it, expect } from 'bun:test'
import type { Block } from '@gezy/sdk'

/**
 * Replicated from export.ts — a pure function that renders a Block to markdown.
 * We test it directly here without needing DB access.
 */
function renderBlockToMarkdown(block: Block): string {
  switch (block.type) {
    case 'text':
      return `${block.content.title ? `### ${block.content.title}\n\n` : ''}${block.content.body || ''}\n\n`
    case 'callout':
      return `> **${block.content.type || 'Note'}:** ${block.content.body}\n\n`
    case 'quiz': {
      const questions = (block.content.questions as Array<{ question: string; options?: string[]; correct_answer: string; explanation?: string }>) || []
      let quiz = `### Quiz\n\n`
      for (const q of questions) {
        quiz += `**Q:** ${q.question}\n\n`
        if (q.options) {
          for (const opt of q.options) {
            const isCorrect = opt.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
            quiz += `- ${opt}${isCorrect ? ' ✓' : ''}\n`
          }
        }
        quiz += `\n**Answer:** ${q.correct_answer}\n\n`
        if (q.explanation) {
          quiz += `*${q.explanation}*\n\n`
        }
      }
      return quiz
    }
    default:
      return `\n\n[${block.type} block]\n\n`
  }
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'b-1',
    type: 'text',
    order: 0,
    content: {},
    status: 'ready',
    ...overrides,
  }
}

describe('renderBlockToMarkdown — text block', () => {
  it('renders text block with title and body', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'text',
        content: { title: 'Introduction', body: 'Welcome to this book.' },
      }),
    )
    expect(result).toBe('### Introduction\n\nWelcome to this book.\n\n')
  })

  it('renders text block without title', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'text',
        content: { body: 'Just some content.' },
      }),
    )
    expect(result).toBe('Just some content.\n\n')
  })

  it('renders text block with empty body', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'text',
        content: { title: 'Empty' },
      }),
    )
    expect(result).toBe('### Empty\n\n\n\n')
  })

  it('renders text block with no content at all', () => {
    const result = renderBlockToMarkdown(makeBlock({ type: 'text', content: {} }))
    expect(result).toBe('\n\n')
  })
})

describe('renderBlockToMarkdown — callout block', () => {
  it('renders tip callout', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'callout',
        content: { type: 'tip', body: 'Always save your work.' },
      }),
    )
    expect(result).toBe('> **tip:** Always save your work.\n\n')
  })

  it('renders callout with default "Note" when type missing', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'callout',
        content: { body: 'Important information.' },
      }),
    )
    expect(result).toBe('> **Note:** Important information.\n\n')
  })

  it('renders definition callout', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'callout',
        content: { type: 'definition', body: 'A variable is a named storage location.' },
      }),
    )
    expect(result).toBe('> **definition:** A variable is a named storage location.\n\n')
  })

  it('renders warning callout', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'callout',
        content: { type: 'warning', body: 'Do not delete system files.' },
      }),
    )
    expect(result).toBe('> **warning:** Do not delete system files.\n\n')
  })
})

describe('renderBlockToMarkdown — quiz block', () => {
  it('renders quiz with multiple choice questions', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'quiz',
        content: {
          questions: [
            {
              question: 'What is 2+2?',
              options: ['3', '4', '5', '6'],
              correct_answer: '4',
              explanation: 'Basic arithmetic.',
            },
          ],
        },
      }),
    )
    expect(result).toContain('### Quiz')
    expect(result).toContain('**Q:** What is 2+2?')
    expect(result).toContain('- 4 ✓')
    expect(result).toContain('**Answer:** 4')
    expect(result).toContain('*Basic arithmetic.*')
  })

  it('renders quiz without options', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'quiz',
        content: {
          questions: [
            {
              question: 'Explain recursion.',
              correct_answer: 'A function that calls itself.',
            },
          ],
        },
      }),
    )
    expect(result).toContain('**Q:** Explain recursion.')
    expect(result).toContain('**Answer:** A function that calls itself.')
    // No options block
    expect(result).not.toContain('- ')
  })

  it('renders empty quiz gracefully', () => {
    const result = renderBlockToMarkdown(
      makeBlock({ type: 'quiz', content: {} }),
    )
    expect(result).toBe('### Quiz\n\n')
  })

  it('renders quiz with multiple questions', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'quiz',
        content: {
          questions: [
            { question: 'Q1?', correct_answer: 'A1' },
            { question: 'Q2?', correct_answer: 'A2', explanation: 'Because.' },
          ],
        },
      }),
    )
    expect(result).toContain('**Q:** Q1?')
    expect(result).toContain('**Answer:** A1')
    expect(result).toContain('**Q:** Q2?')
    expect(result).toContain('**Answer:** A2')
    expect(result).toContain('*Because.*')
  })

  it('case-insensitive answer matching for ✓ marker', () => {
    const result = renderBlockToMarkdown(
      makeBlock({
        type: 'quiz',
        content: {
          questions: [
            {
              question: 'Capital of France?',
              options: ['paris', 'LONDON', 'Berlin'],
              correct_answer: 'Paris',
            },
          ],
        },
      }),
    )
    expect(result).toContain('- paris ✓')
    expect(result).not.toContain('- LONDON ✓')
    expect(result).not.toContain('- Berlin ✓')
  })
})

describe('renderBlockToMarkdown — unknown/unsupported block types', () => {
  it('renders fallback for figure block', () => {
    const result = renderBlockToMarkdown(makeBlock({ type: 'figure', content: { src: 'diagram.png' } }))
    expect(result).toBe('\n\n[figure block]\n\n')
  })

  it('renders fallback for code block', () => {
    const result = renderBlockToMarkdown(makeBlock({ type: 'code' }))
    expect(result).toBe('\n\n[code block]\n\n')
  })

  it('renders fallback for concept_map block', () => {
    const result = renderBlockToMarkdown(makeBlock({ type: 'concept_map' }))
    expect(result).toBe('\n\n[concept_map block]\n\n')
  })

  it('renders fallback for flash_cards block', () => {
    const result = renderBlockToMarkdown(makeBlock({ type: 'flash_cards' }))
    expect(result).toBe('\n\n[flash_cards block]\n\n')
  })
})
