import { describe, it, expect } from 'bun:test'
import { mergeIncomingMessage } from '@/client/lib/reconcile-messages'

type Msg = { id: string; content: string; files?: string[] }

describe('mergeIncomingMessage', () => {
  it('appends a genuinely new message (another device / member)', () => {
    const prev: Msg[] = [{ id: 'a', content: 'hi' }]
    const incoming: Msg = { id: 'b', content: 'from phone' }
    const next = mergeIncomingMessage(prev, incoming)
    expect(next).toEqual([
      { id: 'a', content: 'hi' },
      { id: 'b', content: 'from phone' },
    ])
  })

  it('is a no-op when the message id is already present (duplicate SSE / refetch race)', () => {
    const prev: Msg[] = [{ id: 'a', content: 'hi' }, { id: 'b', content: 'x' }]
    const incoming: Msg = { id: 'b', content: 'x' }
    const next = mergeIncomingMessage(prev, incoming, 'some-token')
    // identical reference returned — no re-render churn
    expect(next).toBe(prev)
  })

  it('replaces the optimistic bubble in place via its reconciliation token', () => {
    // Optimistic bubble keyed by the client token, then the real message arrives.
    const prev: Msg[] = [
      { id: 'msg-0', content: 'earlier' },
      { id: 'cmid-123', content: '', files: ['local-preview'] }, // photo-only, empty content
    ]
    const incoming: Msg = { id: 'real-uuid', content: '', files: ['server-file'] }
    const next = mergeIncomingMessage(prev, incoming, 'cmid-123')
    expect(next).toEqual([
      { id: 'msg-0', content: 'earlier' },
      { id: 'real-uuid', content: '', files: ['server-file'] },
    ])
    // order preserved, length unchanged (replace, not append)
    expect(next).toHaveLength(2)
  })

  it('appends when a token is present but matches no optimistic bubble', () => {
    // Receiving device never sent this message, so it has no bubble for the token.
    const prev: Msg[] = [{ id: 'a', content: 'hi' }]
    const incoming: Msg = { id: 'real-uuid', content: 'photo from PC' }
    const next = mergeIncomingMessage(prev, incoming, 'cmid-not-here')
    expect(next).toEqual([
      { id: 'a', content: 'hi' },
      { id: 'real-uuid', content: 'photo from PC' },
    ])
  })

  it('prefers id-dedup over token-replace when both could match (idempotent re-delivery)', () => {
    // Already reconciled to the real id; a second SSE with the same id + token
    // must not duplicate or resurrect the optimistic entry.
    const prev: Msg[] = [{ id: 'real-uuid', content: 'done' }]
    const incoming: Msg = { id: 'real-uuid', content: 'done' }
    const next = mergeIncomingMessage(prev, incoming, 'real-uuid')
    expect(next).toBe(prev)
  })
})
