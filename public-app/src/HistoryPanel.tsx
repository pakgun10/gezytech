import { useState, useEffect } from 'react'

interface HistoryMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: number
}

export function HistoryPanel({ onSelect }: { onSelect?: (msgs: HistoryMessage[]) => void }) {
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/chat/history')
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages.reverse())
      })
      .finally(() => setLoading(false))
  }, [open])

  // Group messages into conversations: each user message starts a new conversation
  const conversations = messages.reduce((acc, msg) => {
    if (msg.role === 'user') {
      acc.unshift({ id: msg.id, preview: msg.content.slice(0, 80), timestamp: msg.timestamp })
    }
    return acc
  }, [] as Array<{ id: string; preview: string; timestamp: number }>)

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '6px 12px', background: open ? '#2563eb' : '#f3f4f6',
          color: open ? '#fff' : '#374151', border: 'none', borderRadius: 6,
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}
      >
        💬 History {conversations.length > 0 ? `(${conversations.length})` : ''}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          width: 320, maxHeight: 500, overflow: 'auto',
          background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10,
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e5e5', fontWeight: 600, fontSize: 13 }}>
            Conversation History
          </div>
          <div style={{ padding: 4 }}>
            {loading && <p style={{ padding: 12, color: '#999', fontSize: 13 }}>Loading...</p>}
            {!loading && conversations.length === 0 && (
              <p style={{ padding: 12, color: '#999', fontSize: 13 }}>No conversations yet.</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  // Find messages starting from this conversation
                  const idx = messages.findIndex((m) => m.id === conv.id)
                  if (idx >= 0 && onSelect) {
                    onSelect(messages.slice(0, idx + 1).reverse())
                  }
                  setOpen(false)
                }}
                style={{
                  padding: '8px 10px', cursor: 'pointer', borderRadius: 6,
                  borderBottom: '1px solid #f3f4f6', fontSize: 13,
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ color: '#374151', marginBottom: 2 }}>
                  {conv.preview}{conv.preview.length >= 80 ? '...' : ''}
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  {formatTime(conv.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
