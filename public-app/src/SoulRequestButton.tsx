import { useState, useEffect } from 'react'

interface SoulRequest {
  id: string
  soulText: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null
  createdAt: number
}

export function SoulRequestButton() {
  const [open, setOpen] = useState(false)
  const [soulText, setSoulText] = useState('')
  const [requests, setRequests] = useState<SoulRequest[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/soul-requests')
      .then((r) => r.json())
      .then((data) => setRequests(data.requests ?? []))
      .catch(() => {})
  }, [open])

  const handleSubmit = async () => {
    if (soulText.length < 10) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/soul-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soulText }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      setSoulText('')
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

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); setSuccess(false) }}
        style={{
          padding: '6px 12px', background: open ? '#7c3aed' : '#f3f4f6',
          color: open ? '#fff' : '#374151', border: 'none', borderRadius: 6,
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}
      >
        ✨ Persona {requests.filter((r) => r.status === 'pending').length > 0 ? '(pending)' : ''}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 360, maxHeight: 500, overflow: 'auto',
          background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10,
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e5e5', fontWeight: 600, fontSize: 14 }}>
            ✨ Request Persona Change
          </div>

          {success ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 14, color: '#16a34a', fontWeight: 600 }}>Request submitted!</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                Admin akan meninjau permintaanmu. Kamu akan diberi tahu kalau sudah di-approve.
              </p>
              <button
                onClick={() => setSuccess(false)}
                style={{ marginTop: 12, padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                Submit another
              </button>
            </div>
          ) : (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
                Tulis persona/SOUL yang kamu inginkan untuk agent. Admin akan meninjau dan menerapkannya.
              </p>
              <textarea
                value={soulText}
                onChange={(e) => setSoulText(e.target.value)}
                placeholder={`Tulis persona agent yang kamu inginkan...\n\nContoh:\nKamu adalah asisten yang ramah dan suka bercanda. Kamu selalu menyapa dengan "Halo sahabatku!" dan menggunakan emoji sesekali.`}
                rows={5}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: soulText.length < 10 ? '#dc2626' : '#6b7280' }}>
                  {soulText.length}/10 min characters
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || soulText.length < 10}
                  style={{
                    padding: '8px 16px', background: '#7c3aed', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer',
                    fontSize: 14, fontWeight: 600, opacity: soulText.length < 10 ? 0.5 : 1,
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
                  <div style={{ color: '#374151', marginBottom: 2 }}>
                    {req.soulText.slice(0, 100)}{req.soulText.length > 100 ? '...' : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: statusColor(req.status), fontWeight: 600 }}>
                      {req.status.toUpperCase()}
                    </span>
                    <span style={{ color: '#999' }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
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
