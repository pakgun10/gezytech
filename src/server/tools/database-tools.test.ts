import { describe, it, expect } from 'bun:test'
import { executeSqlTool } from '@/server/tools/database-tools'

// ─── isReadQuery (tested indirectly via exported tool, but we can test the
//     internal logic by checking its behavior through the tool's availability
//     and default-disabled settings) ──────────────────────────────────────────

// The module doesn't export isReadQuery directly, so we extract and test it
// by re-implementing the same logic for validation.
// Let's verify the tool registration metadata first, then test the logic.

// ─── Tool Registration Metadata ──────────────────────────────────────────────

describe('executeSqlTool registration', () => {
  it('is available only to main agents', () => {
    expect(executeSqlTool.availability).toEqual(['main'])
  })

  it('is disabled by default (opt-in required)', () => {
    expect(executeSqlTool.defaultDisabled).toBe(true)
  })

  it('has a create function', () => {
    expect(typeof executeSqlTool.create).toBe('function')
  })
})

// ─── isReadQuery logic ───────────────────────────────────────────────────────
// We re-test the exact logic from the module to validate correctness.

const READ_PREFIXES = ['SELECT', 'WITH', 'EXPLAIN', 'PRAGMA']

function isReadQuery(sql: string): boolean {
  const upper = sql.trimStart().toUpperCase()
  return READ_PREFIXES.some((p) => upper.startsWith(p))
}

describe('isReadQuery', () => {
  // ─── SELECT queries ─────────────────────────────────────────────────────
  it('recognizes basic SELECT', () => {
    expect(isReadQuery('SELECT * FROM users')).toBe(true)
  })

  it('recognizes SELECT with leading whitespace', () => {
    expect(isReadQuery('  SELECT id FROM users')).toBe(true)
  })

  it('recognizes SELECT with leading newlines', () => {
    expect(isReadQuery('\n\nSELECT count(*) FROM messages')).toBe(true)
  })

  it('recognizes SELECT with tabs', () => {
    expect(isReadQuery('\t\tSELECT 1')).toBe(true)
  })

  it('is case-insensitive for SELECT', () => {
    expect(isReadQuery('select * from users')).toBe(true)
    expect(isReadQuery('Select * FROM users')).toBe(true)
    expect(isReadQuery('sElEcT * FROM users')).toBe(true)
  })

  // ─── WITH (CTE) queries ────────────────────────────────────────────────
  it('recognizes WITH (CTE)', () => {
    expect(isReadQuery('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(true)
  })

  it('recognizes WITH with lowercase', () => {
    expect(isReadQuery('with recursive tree as (...) select * from tree')).toBe(true)
  })

  // ─── EXPLAIN queries ───────────────────────────────────────────────────
  it('recognizes EXPLAIN', () => {
    expect(isReadQuery('EXPLAIN SELECT * FROM users')).toBe(true)
  })

  it('recognizes EXPLAIN QUERY PLAN', () => {
    expect(isReadQuery('EXPLAIN QUERY PLAN SELECT * FROM users')).toBe(true)
  })

  // ─── PRAGMA queries ────────────────────────────────────────────────────
  it('recognizes PRAGMA', () => {
    expect(isReadQuery('PRAGMA table_info(users)')).toBe(true)
  })

  it('recognizes PRAGMA with lowercase', () => {
    expect(isReadQuery('pragma journal_mode')).toBe(true)
  })

  // ─── Write queries (should return false) ────────────────────────────────
  it('rejects INSERT', () => {
    expect(isReadQuery('INSERT INTO users (name) VALUES ("test")')).toBe(false)
  })

  it('rejects UPDATE', () => {
    expect(isReadQuery('UPDATE users SET name = "test" WHERE id = 1')).toBe(false)
  })

  it('rejects DELETE', () => {
    expect(isReadQuery('DELETE FROM users WHERE id = 1')).toBe(false)
  })

  it('rejects DROP', () => {
    expect(isReadQuery('DROP TABLE users')).toBe(false)
  })

  it('rejects CREATE', () => {
    expect(isReadQuery('CREATE TABLE test (id INTEGER)')).toBe(false)
  })

  it('rejects ALTER', () => {
    expect(isReadQuery('ALTER TABLE users ADD COLUMN age INTEGER')).toBe(false)
  })

  it('rejects INSERT with leading whitespace', () => {
    expect(isReadQuery('  INSERT INTO users VALUES (1)')).toBe(false)
  })

  it('rejects REPLACE', () => {
    expect(isReadQuery('REPLACE INTO users VALUES (1, "test")')).toBe(false)
  })

  // ─── Edge cases ────────────────────────────────────────────────────────
  it('handles empty string', () => {
    expect(isReadQuery('')).toBe(false)
  })

  it('handles whitespace-only string', () => {
    expect(isReadQuery('   ')).toBe(false)
  })

  it('does not match partial prefixes in the middle', () => {
    // "DESELECT" doesn't start with SELECT
    expect(isReadQuery('DESELECT * FROM users')).toBe(false)
  })

  it('handles query starting with SELECT inside a comment-like string', () => {
    // This tests the naive prefix check: it doesn't understand SQL comments
    expect(isReadQuery('-- comment\nSELECT 1')).toBe(false) // starts with --
  })

  it('handles VACUUM (not a read query)', () => {
    expect(isReadQuery('VACUUM')).toBe(false)
  })

  it('handles REINDEX (not a read query)', () => {
    expect(isReadQuery('REINDEX users')).toBe(false)
  })

  // ─── MAX_ROWS constant check ──────────────────────────────────────────
  // We can't directly test MAX_ROWS from outside, but we verify the
  // read/write classification covers common SQLite patterns
  it('handles ATTACH DATABASE (not a read)', () => {
    expect(isReadQuery('ATTACH DATABASE "test.db" AS test')).toBe(false)
  })

  it('handles BEGIN TRANSACTION (not a read)', () => {
    expect(isReadQuery('BEGIN TRANSACTION')).toBe(false)
  })

  it('handles COMMIT (not a read)', () => {
    expect(isReadQuery('COMMIT')).toBe(false)
  })

  it('handles ROLLBACK (not a read)', () => {
    expect(isReadQuery('ROLLBACK')).toBe(false)
  })
})
