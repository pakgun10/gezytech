import { describe, it, expect } from 'bun:test'

// consolidation.ts's core algorithms are not exported, so we recreate them
// here for isolated testing (same approach as hooks/index.test.ts).
// This tests the pure computational logic: cosine similarity, cluster finding,
// and union-find grouping.

// ─── Recreated pure functions from consolidation.ts ──────────────────────────

interface MemoryRow {
  id: string
  content: string
  category: string
  subject: string | null
  importance: number | null
  consolidationGeneration: number
  embedding: Buffer | null
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function findSimilarClusters(
  mems: MemoryRow[],
  threshold: number,
): Array<[MemoryRow, MemoryRow]> {
  const pairs: Array<[MemoryRow, MemoryRow]> = []

  for (let i = 0; i < mems.length; i++) {
    const a = mems[i]!
    if (!a.embedding) continue

    const vecA = new Float32Array(a.embedding.buffer, a.embedding.byteOffset, a.embedding.byteLength / 4)

    for (let j = i + 1; j < mems.length; j++) {
      const b = mems[j]!
      if (!b.embedding) continue

      const vecB = new Float32Array(b.embedding.buffer, b.embedding.byteOffset, b.embedding.byteLength / 4)

      const similarity = cosineSimilarity(vecA, vecB)
      if (similarity >= threshold) {
        pairs.push([a, b])
      }
    }
  }

  return pairs
}

function clusterPairs(pairs: Array<[MemoryRow, MemoryRow]>): MemoryRow[][] {
  const parent = new Map<string, string>()
  const memMap = new Map<string, MemoryRow>()

  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id)
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!))
    return parent.get(id)!
  }

  function union(a: string, b: string) {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const [a, b] of pairs) {
    memMap.set(a.id, a)
    memMap.set(b.id, b)
    union(a.id, b.id)
  }

  const groups = new Map<string, MemoryRow[]>()
  for (const [id, mem] of memMap) {
    const root = find(id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(mem)
  }

  return Array.from(groups.values()).filter((g) => g.length >= 2)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a Buffer from a Float32Array (simulates DB embedding storage). */
function toEmbeddingBuffer(values: number[]): Buffer {
  const f32 = new Float32Array(values)
  return Buffer.from(f32.buffer)
}

function makeMemory(
  id: string,
  embedding: number[] | null,
  overrides?: Partial<MemoryRow>,
): MemoryRow {
  return {
    id,
    content: `memory ${id}`,
    category: 'fact',
    subject: null,
    importance: 5,
    consolidationGeneration: 0,
    embedding: embedding ? toEmbeddingBuffer(embedding) : null,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([0, 1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10)
  })

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([-1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10)
  })

  it('returns 0 when one vector is all zeros', () => {
    const a = new Float32Array([1, 2, 3])
    const zero = new Float32Array([0, 0, 0])
    expect(cosineSimilarity(a, zero)).toBe(0)
  })

  it('returns 0 when both vectors are all zeros', () => {
    const zero = new Float32Array([0, 0, 0])
    expect(cosineSimilarity(zero, zero)).toBe(0)
  })

  it('is symmetric', () => {
    const a = new Float32Array([1, 3, -5])
    const b = new Float32Array([4, -2, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10)
  })

  it('handles unit vectors correctly', () => {
    const a = new Float32Array([1 / Math.sqrt(2), 1 / Math.sqrt(2)])
    const b = new Float32Array([1, 0])
    // cos(45°) ≈ 0.7071
    expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2), 5)
  })

  it('is scale-invariant', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([2, 4, 6]) // 2 * a
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10)
  })

  it('handles negative scale factor', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([-2, -4, -6]) // -2 * a
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10)
  })

  it('handles high-dimensional vectors', () => {
    const dim = 1536 // typical embedding dimension
    const a = new Float32Array(dim)
    const b = new Float32Array(dim)
    for (let i = 0; i < dim; i++) {
      a[i] = Math.sin(i)
      b[i] = Math.sin(i + 0.01) // very similar
    }
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0.99)
    expect(sim).toBeLessThanOrEqual(1.0)
  })
})

describe('findSimilarClusters', () => {
  it('returns empty for no memories', () => {
    expect(findSimilarClusters([], 0.9)).toEqual([])
  })

  it('returns empty for a single memory', () => {
    const mem = makeMemory('a', [1, 0, 0])
    expect(findSimilarClusters([mem], 0.9)).toEqual([])
  })

  it('pairs identical embeddings above threshold', () => {
    const a = makeMemory('a', [1, 0, 0])
    const b = makeMemory('b', [1, 0, 0])
    const pairs = findSimilarClusters([a, b], 0.9)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]![0].id).toBe('a')
    expect(pairs[0]![1].id).toBe('b')
  })

  it('does not pair orthogonal embeddings', () => {
    const a = makeMemory('a', [1, 0, 0])
    const b = makeMemory('b', [0, 1, 0])
    expect(findSimilarClusters([a, b], 0.5)).toEqual([])
  })

  it('skips memories without embeddings', () => {
    const a = makeMemory('a', [1, 0, 0])
    const b = makeMemory('b', null)
    const c = makeMemory('c', [1, 0.1, 0])
    const pairs = findSimilarClusters([a, b, c], 0.9)
    // a-c should be similar, b is skipped
    expect(pairs).toHaveLength(1)
    expect(pairs[0]![0].id).toBe('a')
    expect(pairs[0]![1].id).toBe('c')
  })

  it('finds multiple pairs when all are similar', () => {
    const a = makeMemory('a', [1, 0, 0])
    const b = makeMemory('b', [1, 0.01, 0])
    const c = makeMemory('c', [1, 0.02, 0])
    const pairs = findSimilarClusters([a, b, c], 0.99)
    // a-b, a-c, b-c should all be similar
    expect(pairs).toHaveLength(3)
  })

  it('respects threshold precisely', () => {
    // cos(45°) ≈ 0.707
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 1])
    // Below threshold
    expect(findSimilarClusters([a, b], 0.75)).toEqual([])
    // Above threshold
    expect(findSimilarClusters([a, b], 0.7)).toHaveLength(1)
  })
})

describe('clusterPairs', () => {
  it('returns empty for no pairs', () => {
    expect(clusterPairs([])).toEqual([])
  })

  it('creates a single cluster from one pair', () => {
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 0])
    const clusters = clusterPairs([[a, b]])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(2)
    const ids = clusters[0]!.map((m) => m.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('merges overlapping pairs into one cluster via union-find', () => {
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 0])
    const c = makeMemory('c', [1, 0])
    // a-b and b-c overlap on b → should merge into one cluster {a, b, c}
    const clusters = clusterPairs([
      [a, b],
      [b, c],
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(3)
    const ids = clusters[0]!.map((m) => m.id).sort()
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('keeps disjoint pairs as separate clusters', () => {
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 0])
    const c = makeMemory('c', [0, 1])
    const d = makeMemory('d', [0, 1])
    const clusters = clusterPairs([
      [a, b],
      [c, d],
    ])
    expect(clusters).toHaveLength(2)
    const allIds = clusters.map((cl) => cl.map((m) => m.id).sort())
    allIds.sort((x, y) => x[0]!.localeCompare(y[0]!))
    expect(allIds).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('handles transitive chains: a-b, b-c, c-d → one cluster', () => {
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 0])
    const c = makeMemory('c', [1, 0])
    const d = makeMemory('d', [1, 0])
    const clusters = clusterPairs([
      [a, b],
      [b, c],
      [c, d],
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(4)
  })

  it('handles star topology: a-b, a-c, a-d → one cluster', () => {
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 0])
    const c = makeMemory('c', [1, 0])
    const d = makeMemory('d', [1, 0])
    const clusters = clusterPairs([
      [a, b],
      [a, c],
      [a, d],
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(4)
  })

  it('handles duplicate pairs gracefully', () => {
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 0])
    const clusters = clusterPairs([
      [a, b],
      [a, b],
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(2)
  })

  it('complex graph: two clusters with bridge edge', () => {
    const a = makeMemory('a', [1, 0])
    const b = makeMemory('b', [1, 0])
    const c = makeMemory('c', [1, 0])
    const d = makeMemory('d', [1, 0])
    const e = makeMemory('e', [1, 0])
    // Cluster 1: a-b, b-c
    // Cluster 2: d-e
    // Bridge: c-d (merges into one big cluster)
    const clusters = clusterPairs([
      [a, b],
      [b, c],
      [d, e],
      [c, d],
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(5)
  })
})

describe('integration: findSimilarClusters + clusterPairs', () => {
  it('groups similar memories and separates dissimilar ones', () => {
    // Two groups of similar embeddings
    const group1 = [
      makeMemory('a1', [1, 0, 0]),
      makeMemory('a2', [1, 0.01, 0]),
      makeMemory('a3', [1, 0.02, 0]),
    ]
    const group2 = [
      makeMemory('b1', [0, 1, 0]),
      makeMemory('b2', [0, 1, 0.01]),
    ]
    const outlier = makeMemory('out', [0, 0, 1])

    const all = [...group1, ...group2, outlier]
    const pairs = findSimilarClusters(all, 0.99)
    const clusters = clusterPairs(pairs)

    // Should have 2 clusters, outlier excluded
    expect(clusters).toHaveLength(2)

    const clusterIds = clusters
      .map((cl) => cl.map((m) => m.id).sort())
      .sort((a, b) => a[0]!.localeCompare(b[0]!))

    expect(clusterIds).toEqual([
      ['a1', 'a2', 'a3'],
      ['b1', 'b2'],
    ])
  })

  it('returns no clusters when all memories are dissimilar', () => {
    const mems = [
      makeMemory('x', [1, 0, 0]),
      makeMemory('y', [0, 1, 0]),
      makeMemory('z', [0, 0, 1]),
    ]
    const pairs = findSimilarClusters(mems, 0.9)
    const clusters = clusterPairs(pairs)
    expect(clusters).toEqual([])
  })
})
