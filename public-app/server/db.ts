import { Database } from 'bun:sqlite'

const DB_PATH = process.env.DB_PATH ?? './data/app.db'

let _db: Database | null = null

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH, { create: true })
    _db.run('PRAGMA journal_mode=WAL')
    _db.run('PRAGMA foreign_keys=ON')
  }
  return _db
}

export interface User {
  id: string
  email: string
  passwordHash: string
  displayName: string
  agentSlug: string
  createdAt: number
  updatedAt: number
}

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: number
  createdAt: number
}

export interface ToolRequest {
  id: string
  userId: string
  toolName: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null
  createdAt: number
  reviewedAt: number | null
}

export interface SoulRequest {
  id: string
  userId: string
  soulText: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null
  createdAt: number
  reviewedAt: number | null
}

export interface TokenUsage {
  id: string
  userId: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  createdAt: number
}
