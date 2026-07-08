import { useState, useEffect } from 'react'

interface ToolRequest {
  id: string
  toolName: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null
  createdAt: number
}

// Common tools that users might want to request
const SUGGESTED_TOOLS = [
  'web_search', 'browse_url', 'generate_image', 'generate_pdf', 'generate_docx',
  'generate_xlsx', 'ocr_file', 'browser_navigate', 'browser_screenshot',
  'send_email', 'create_event', 'create_cron', 'text_to_speech', 'transcribe_audio',
]

export function ToolRequestButton() {
  const [open, setOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState('')
  const [reason, setReason] = useState('')
  const [requests, setRequests] = useState<ToolRequest[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [customTool, setCustomTool] = useState('')

  useEffect(() => {
    if (!open) return
    fetch('/api/tool-requests')
      .then((r) => r.json())
      .then((data) => setRequests(data.requests ?? []))
      .catch(() => {})
  }, [open])

  const handleSubmit = async () => {
    const toolName = selectedTool || customTool
    if (!toolName) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tool-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, reason: reason || undefined }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      setSelectedTool('')
      setCustomTool('')
      setReason('')
      const data = await res.json()
      setRequests((prev) => [data.request, ...prev])
    } catch {
      alert('Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const statusColor = (s: string) => {
    if (s === 'approved') return '#16a34a'
    if (s === 'rejected') return '#dc2626'
    return '#f59e0b'
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); setSuccess(false) }}
        style={{
          padding: '6px 12px', background: open ? '#d97706' : '#f3f4f6',
          color: open ? '#fff' : '#374151', border: 'none', borderRadius: 6,
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}
      >
        🔧 Tools {pendingCount > 0 ? `(${pendingCount})` : ''}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 360, maxHeight: 500, overflow: 'auto',
          background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10,
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e5e5', fontWeight: 600, fontSize: 14 }}>
            🔧 Request Tool Access
          </div>

          {success ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 14, color: '#16a34a', fontWeight: 600 }}>Request submitted!</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                Admin akan meninjau permintaan tool-mu.
              </p>
              <button onClick={() => setSuccess(false)} style={{ marginTop: 12, padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                Submit another
              </button>
            </div>
          ) : (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
                Pilih tool yang ingin kamu request, atau ketik manual nama tool-nya.
              </p>

              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #ddd',
                  borderRadius: 8, fontSize: 13, marginBottom: 8, background: '#fff',
                }}
              >
                <option value="">-- Pilih tool --</option>
                {SUGGESTED_TOOLS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <input
                type="text"
                value={customTool}
                onChange={(e) => setCustomTool(e.target.value)}
                placeholder="Atau ketik nama tool kustom..."
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #ddd',
                  borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box',
                }}
              />

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Alasan kenapa butuh tool ini (opsional)"
                rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || (!selectedTool && !customTool)}
                  style={{
                    padding: '8px 16px', background: '#d97706', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer',
                    fontSize: 14, fontWeight: 600,
                    opacity: (!selectedTool && !customTool) ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          )}

          {requests.length > 0 && (
            <div style={{ borderTop: '1px solid #e5e5e5', padding: 8 }}>
              <div style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
                Your Requests
              </div>
              {requests.map((req) => (
                <div key={req.id} style={{ padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{req.toolName}</span>
                    <span style={{ color: statusColor(req.status), fontWeight: 600, fontSize: 11 }}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                  {req.reason && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {req.reason.slice(0, 80)}
                    </div>
                  )}
                  {req.adminNote && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>
                      Admin: {req.adminNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
