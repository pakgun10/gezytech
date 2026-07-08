import { getDb, type ToolRequest } from './db'

// ─── Tool Request CRUD ───

export function createToolRequest(params: { userId: string; toolName: string; reason?: string }): ToolRequest {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = Date.now()

  db.run(
    'INSERT INTO tool_requests (id, user_id, tool_name, reason, status, created_at) VALUES (?,?,?,?,?,?)',
    [id, params.userId, params.toolName, params.reason ?? null, 'pending', now]
  )
  return getToolRequestById(id)!
}

export function getToolRequestById(id: string): ToolRequest | null {
  return getDb().query<ToolRequest, [string]>(
    'SELECT id, user_id as userId, tool_name as toolName, reason, status, admin_note as adminNote, created_at as createdAt, reviewed_at as reviewedAt FROM tool_requests WHERE id=?'
  ).get(id) ?? null
}

export function listToolRequestsByUser(userId: string): ToolRequest[] {
  return getDb().query<ToolRequest, [string]>(
    'SELECT id, user_id as userId, tool_name as toolName, reason, status, admin_note as adminNote, created_at as createdAt, reviewed_at as reviewedAt FROM tool_requests WHERE user_id=? ORDER BY created_at DESC'
  ).all(userId)
}

export function listAllToolRequests(): ToolRequest[] {
  return getDb().query<ToolRequest, []>(
    'SELECT id, user_id as userId, tool_name as toolName, reason, status, admin_note as adminNote, created_at as createdAt, reviewed_at as reviewedAt FROM tool_requests ORDER BY created_at DESC'
  ).all()
}

export function approveToolRequest(id: string, adminNote?: string): ToolRequest | null {
  const db = getDb()
  const now = Date.now()
  db.run(
    'UPDATE tool_requests SET status=?, admin_note=?, reviewed_at=? WHERE id=?',
    ['approved', adminNote ?? null, now, id]
  )
  return getToolRequestById(id)
}

export function rejectToolRequest(id: string, adminNote?: string): ToolRequest | null {
  const db = getDb()
  const now = Date.now()
  db.run(
    'UPDATE tool_requests SET status=?, admin_note=?, reviewed_at=? WHERE id=?',
    ['rejected', adminNote ?? null, now, id]
  )
  return getToolRequestById(id)
}
