import { getDb, type SoulRequest } from './db'

// ─── SOUL Request CRUD ───

export function createSoulRequest(params: { userId: string; soulText: string }): SoulRequest {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = Date.now()

  db.run(
    'INSERT INTO soul_requests (id, user_id, soul_text, status, created_at) VALUES (?,?,?,?,?)',
    [id, params.userId, params.soulText, 'pending', now]
  )
  return getSoulRequestById(id)!
}

export function getSoulRequestById(id: string): SoulRequest | null {
  return getDb().query<SoulRequest, [string]>(
    'SELECT id, user_id as userId, soul_text as soulText, status, admin_note as adminNote, created_at as createdAt, reviewed_at as reviewedAt FROM soul_requests WHERE id=?'
  ).get(id) ?? null
}

export function listSoulRequestsByUser(userId: string): SoulRequest[] {
  return getDb().query<SoulRequest, [string]>(
    'SELECT id, user_id as userId, soul_text as soulText, status, admin_note as adminNote, created_at as createdAt, reviewed_at as reviewedAt FROM soul_requests WHERE user_id=? ORDER BY created_at DESC'
  ).all(userId)
}

export function listAllSoulRequests(): SoulRequest[] {
  return getDb().query<SoulRequest, []>(
    'SELECT id, user_id as userId, soul_text as soulText, status, admin_note as adminNote, created_at as createdAt, reviewed_at as reviewedAt FROM soul_requests ORDER BY created_at DESC'
  ).all()
}

export function approveSoulRequest(id: string, adminNote?: string): SoulRequest | null {
  const db = getDb()
  const now = Date.now()
  db.run(
    'UPDATE soul_requests SET status=?, admin_note=?, reviewed_at=? WHERE id=?',
    ['approved', adminNote ?? null, now, id]
  )
  return getSoulRequestById(id)
}

export function rejectSoulRequest(id: string, adminNote?: string): SoulRequest | null {
  const db = getDb()
  const now = Date.now()
  db.run(
    'UPDATE soul_requests SET status=?, admin_note=?, reviewed_at=? WHERE id=?',
    ['rejected', adminNote ?? null, now, id]
  )
  return getSoulRequestById(id)
}
