import { useState, useEffect } from 'react'

interface MemoryItem {
  id: string
  content: string
  createdAt: string
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/memory')
      .then((r) => r.json())
      .then((data) => setMemories(data.memories || []))
      .finally(() => setLoading(false))
  }, [open])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); setLoading(true) }}
        style={{
          padding: '6px 12px', background: open ? '#2563eb' : '#f3f4f6',
          color: open ? '#fff' : '#374151', border: 'none', borderRadius: 6,
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}
      >
        🧠 Memory {memories.length > 0 ? `(${memories.length})` : ''}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 320, maxHeight: 400, overflow: 'auto',
          background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10,
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e5e5', fontWeight: 600, fontSize: 13 }}>
            Agent Memory
            <span style={{ float: 'right', color: '#999', fontSize: 11 }}>
              Read-only
            </span>
          </div>
          <div style={{ padding: 8 }}>
            {loading && <p style={{ padding: 12, color: '#999', fontSize: 13 }}>Loading...</p>}
            {!loading && memories.length === 0 && (
              <p style={{ padding: 12, color: '#999', fontSize: 13 }}>Agent belum punya memory.</p>
            )}
            {memories.map((m) => (
              <div key={m.id} style={{ padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f3f4f6', lineHeight: 1.4 }}>
                {m.content}
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
