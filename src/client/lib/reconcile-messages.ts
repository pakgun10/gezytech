/**
 * Merge a chat:message arriving over SSE into the current message list,
 * handling multi-device sync + optimistic reconciliation in one place.
 *
 * The server broadcasts every incoming user message (so other devices and group
 * members see it in real-time). The originating web client already rendered an
 * optimistic bubble keyed by a client-generated reconciliation token; the server
 * echoes that token back as `reconcileId`. Three outcomes:
 *
 *   1. We already hold this message by its real id (a duplicate SSE, or the
 *      chat:done refetch raced ahead) → no-op, return `prev` unchanged.
 *   2. The token matches an optimistic bubble WE sent from this device → replace
 *      that bubble in place (preserving list order). This is what makes
 *      photo-only sends reconcile, where matching by content is impossible.
 *   3. Otherwise it's genuinely new (another device / another member) → append.
 */
export function mergeIncomingMessage<T extends { id: string }>(
  prev: T[],
  message: T,
  reconcileId?: string | null,
): T[] {
  if (prev.some((m) => m.id === message.id)) return prev
  if (reconcileId && prev.some((m) => m.id === reconcileId)) {
    return prev.map((m) => (m.id === reconcileId ? message : m))
  }
  return [...prev, message]
}
