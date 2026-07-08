import { getDb, type User, type Session } from './db'

// ─── Password ───

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash)
}

// ─── Users ───

export function getUserByEmail(email: string): User | null {
  return getDb().query<User, [string]>(
    'SELECT id, email, password_hash as passwordHash, display_name as displayName, agent_slug as agentSlug, created_at as createdAt, updated_at as updatedAt FROM users WHERE email=?'
  ).get(email) ?? null
}

export function getUserById(id: string): User | null {
  return getDb().query<User, [string]>(
    'SELECT id, email, password_hash as passwordHash, display_name as displayName, agent_slug as agentSlug, created_at as createdAt, updated_at as updatedAt FROM users WHERE id=?'
  ).get(id) ?? null
}

export async function createUser(params: {
  email: string
  password: string
  displayName?: string
  agentSlug: string
}): Promise<User> {
  const db = getDb()
  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(params.password)
  const now = Date.now()

  db.run(
    'INSERT INTO users (id, email, password_hash, display_name, agent_slug, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
    [id, params.email, passwordHash, params.displayName ?? '', params.agentSlug, now, now]
  )
  return getUserById(id)!
}

export function listUsers(): User[] {
  return getDb().query<User, []>(
    'SELECT id, email, password_hash as passwordHash, display_name as displayName, agent_slug as agentSlug, created_at as createdAt, updated_at as updatedAt FROM users ORDER BY created_at DESC'
  ).all()
}

// ─── Sessions ───

export function createSession(userId: string): Session {
  const db = getDb()
  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  const now = Date.now()

  db.run(
    'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?,?,?,?,?)',
    [id, userId, token, expiresAt, now]
  )
  return { id, userId, token, expiresAt, createdAt: now }
}

export function verifySession(token: string): Session | null {
  const session = getDb().query<Session, [string]>(
    'SELECT id, user_id as userId, token, expires_at as expiresAt, created_at as createdAt FROM sessions WHERE token=? AND expires_at > ?'
  ).get(token, Date.now()) ?? null

  return session
}

export function deleteSession(token: string): void {
  getDb().run('DELETE FROM sessions WHERE token=?', [token])
}

// ─── Seed (dev mode) ───

export async function seedDevUser(): Promise<User> {
  const existing = getUserByEmail('dev@gezy.tech')
  if (existing) return existing

  return createUser({
    email: 'dev@gezy.tech',
    password: 'devpass',
    displayName: 'Dev User',
    agentSlug: process.env.DEV_AGENT_SLUG ?? 'wati',
  })
}
