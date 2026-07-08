import { useState, useEffect, useCallback } from 'react'

interface TokenStats {
  input: number
  output: number
  total: number
  count: number
}

let globalRefresh = 0
let globalSetRefresh: ((v: number) => void) | null = null

export function triggerTokenRefresh() {
  globalRefresh++
  globalSetRefresh?.(globalRefresh)
}

export function TokenBar() {
  const [stats, setStats] = useState<TokenStats>({ input: 0, output: 0, total: 0, count: 0 })
  const [, setTick] = useState(0)

  globalSetRefresh = setTick

  const fetchStats = useCallback(() => {
    fetch('/api/token-usage')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats, globalRefresh])

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Progress bar */}
      <div style={{
        width: 120, height: 8, background: '#e5e5e5', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min((stats.total / 5000) * 100, 100)}%`,
          height: '100%', background: '#2563eb', borderRadius: 4,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
        {formatTokens(stats.total)} tokens
      </span>
    </div>
  )
}
