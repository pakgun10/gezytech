/**
 * Skills system — installable instruction packs (SKILL.md) that inject
 * specialized procedures into the Agent's system prompt.
 *
 * A skill is a markdown document with optional YAML frontmatter:
 *   ---
 *   name: code-reviewer
 *   description: Systematic code review checklist
 *   category: development
 *   tags: [review, quality, checklist]
 *   ---
 *   # Code Reviewer
 *   When asked to review code, follow these steps...
 *
 * Skills are stored in the DB (`skills` table). When enabled for an Agent
 * (via `agent_skills` join table), their instruction content is injected into
 * the system prompt as a volatile `## Active skill: {name}` block by
 * `prompt-builder.ts`.
 *
 * Design mirrors `gezyhd/src/main/skills.ts` but with DB persistence, agent-level
 * enablement, and prompt-level injection (not filesystem-based like gezyhd).
 */
import { db } from '@/server/db/index'
import { skills, agentSkills } from '@/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { createLogger } from '@/server/logger'

const log = createLogger('skills')

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillRecord {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  content: string
  source: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SkillFrontmatter {
  name: string
  description: string
  category: string
  tags: string[]
}

/** Shape injected into the prompt builder for enabled skills. */
export interface ActiveSkill {
  name: string
  content: string
}

// ─── Pure helpers (exported for testing) ──────────────────────────────────────

/**
 * Parse YAML frontmatter from a SKILL.md document.
 * Extracts: name, description, category, tags (comma-separated string → array).
 * Falls back to first heading + first paragraph when no frontmatter.
 */
export function parseSkillFrontmatter(content: string): {
  frontmatter: SkillFrontmatter
  body: string
} {
  const defaultFm: SkillFrontmatter = {
    name: '',
    description: '',
    category: 'general',
    tags: [],
  }

  if (!content.startsWith('---')) {
    // No frontmatter — extract from first heading + first paragraph
    const headingMatch = content.match(/^#\s+(.+)/m)
    const paraMatch = content.match(/^(?!#)(?!---).+/m)
    return {
      frontmatter: {
        ...defaultFm,
        name: headingMatch?.[1]?.trim() ?? '',
        description: paraMatch?.[0]?.trim()?.slice(0, 200) ?? '',
      },
      body: content,
    }
  }

  const endIdx = content.indexOf('---', 3)
  if (endIdx === -1) {
    return { frontmatter: defaultFm, body: content }
  }

  const frontmatterText = content.slice(3, endIdx)
  const body = content.slice(endIdx + 3).trim()

  const fm: SkillFrontmatter = { ...defaultFm }

  const nameMatch = frontmatterText.match(/^\s*name:\s*["']?([^"'\n]+)["']?\s*$/m)
  if (nameMatch) fm.name = nameMatch[1]!.trim()

  const descMatch = frontmatterText.match(/^\s*description:\s*["']?([^"'\n]+)["']?\s*$/m)
  if (descMatch) fm.description = descMatch[1]!.trim()

  const catMatch = frontmatterText.match(/^\s*category:\s*["']?([^"'\n]+)["']?\s*$/m)
  if (catMatch) fm.category = catMatch[1]!.trim()

  const tagsMatch = frontmatterText.match(/^\s*tags:\s*\[([^\]]*)\]/m)
  if (tagsMatch) {
    fm.tags = tagsMatch[1]!
      .split(',')
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }

  // Fallback to heading if name not in frontmatter
  if (!fm.name) {
    const headingMatch = body.match(/^#\s+(.+)/m)
    if (headingMatch) fm.name = headingMatch[1]!.trim()
  }

  return { frontmatter: fm, body }
}

/**
 * Check if a skill's tags/category match the incoming message.
 * Returns a relevance score (higher = more relevant).
 * Pure — no I/O.
 */
export function skillRelevanceScore(
  skill: { tags: string[]; category: string; description: string },
  message: string,
): number {
  const msg = message.toLowerCase()
  let score = 0

  // Tag match (strongest signal)
  for (const tag of skill.tags) {
    if (msg.includes(tag.toLowerCase())) score += 3
  }

  // Category match
  if (msg.includes(skill.category.toLowerCase())) score += 2

  // Description keyword match
  const descWords = skill.description
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4)
  for (const word of descWords) {
    if (msg.includes(word)) score += 1
  }

  return score
}

/** Format the skill instruction block for prompt injection. Pure. */
export function formatSkillPromptBlock(skill: ActiveSkill): string {
  return `## Active skill: ${skill.name}\n\n${skill.content}`
}

// ─── DB operations ───────────────────────────────────────────────────────────

/** Create a skill from raw SKILL.md content. */
export function createSkillFromMarkdown(
  content: string,
  source: string = 'manual',
): SkillRecord {
  const { frontmatter, body } = parseSkillFrontmatter(content)
  const id = uuid()
  const now = new Date()

  db.insert(skills)
    .values({
      id,
      name: frontmatter.name || 'unnamed-skill',
      description: frontmatter.description,
      category: frontmatter.category,
      tags: JSON.stringify(frontmatter.tags),
      content: body,
      source,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  log.info({ id, name: frontmatter.name, source }, 'Skill created')
  return getSkill(id)!
}

/** Get a single skill by ID. */
export function getSkill(id: string): SkillRecord | null {
  const row = db.select().from(skills).where(eq(skills.id, id)).get()
  if (!row) return null
  return rowToRecord(row)
}

/** List all installed skills. */
export function listSkills(): SkillRecord[] {
  const rows = db.select().from(skills).all()
  return rows.map(rowToRecord)
}

/** Delete a skill by ID. */
export function deleteSkill(id: string): boolean {
  const existing = db.select().from(skills).where(eq(skills.id, id)).get()
  if (!existing) return false
  // Also remove from agent_skills
  db.delete(agentSkills).where(eq(agentSkills.skillId, id)).run()
  db.delete(skills).where(eq(skills.id, id)).run()
  return true
}

/** Enable a skill for a specific agent. */
export function enableSkillForAgent(skillId: string, agentId: string): void {
  // Idempotent — don't insert duplicates
  const existing = db.select().from(agentSkills)
    .where(and(eq(agentSkills.skillId, skillId), eq(agentSkills.agentId, agentId)))
    .get()
  if (existing) return

  db.insert(agentSkills)
    .values({
      skillId,
      agentId,
      createdAt: new Date(),
    })
    .run()

  log.info({ skillId, agentId }, 'Skill enabled for agent')
}

/** Disable a skill for a specific agent. */
export function disableSkillForAgent(skillId: string, agentId: string): void {
  db.delete(agentSkills)
    .where(and(eq(agentSkills.skillId, skillId), eq(agentSkills.agentId, agentId)))
    .run()
}

/** Get all active skills for an agent (enabled + skill.enabled=true). */
export function getActiveSkillsForAgent(agentId: string): ActiveSkill[] {
  const joins = db.select().from(agentSkills)
    .where(eq(agentSkills.agentId, agentId))
    .all()
  if (joins.length === 0) return []

  const skillIds = joins.map((j) => j.skillId)
  const allSkills = db.select().from(skills).all()
  const active = allSkills.filter(
    (s) => skillIds.includes(s.id) && s.enabled,
  )

  return active.map((s) => ({
    name: s.name,
    content: s.content,
  }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToRecord(row: typeof skills.$inferSelect): SkillRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    content: row.content,
    source: row.source,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ─── Built-in skills (seeded at boot) ──────────────────────────────────────────

export const BUILTIN_SKILLS: Array<{ name: string; content: string }> = [
  {
    name: 'code-reviewer',
    content: `# Code Reviewer

When asked to review code, follow this checklist:

1. **Read the full file** before commenting on any part.
2. **Check for correctness** — does the logic match the intent?
3. **Look for edge cases** — empty inputs, off-by-one, null dereference.
4. **Naming** — are variables/functions clearly named?
5. **Consistency** — does the code follow the existing style of the file?
6. **Security** — any injection, path traversal, or secret leakage?
7. **Performance** — any obvious O(n²) in a hot path?
8. **Tests** — are there tests? Do they cover the change?

Report findings as a structured list with file:line references. Suggest fixes as code snippets, not prose.`,
  },
  {
    name: 'git-committer',
    content: `# Git Committer

When making git commits:

1. **Stage only related changes** — don't mix unrelated fixes in one commit.
2. **Write a clear commit message** — conventional commits format:
   - 'feat:' for new features
   - 'fix:' for bug fixes
   - 'refactor:' for non-behavior changes
   - 'test:' for test additions
   - 'docs:' for documentation
3. **Reference tickets** if applicable: "fix: handle empty input (#123)".
4. **Never commit secrets** — API keys, passwords, tokens.
5. **Run tests before committing** — never skip hooks with --no-verify.
6. **One logical change per commit** — if you changed 3 things, make 3 commits.`,
  },
  {
    name: 'systematic-debugger',
    content: `# Systematic Debugger

When debugging a failing test or unexpected behavior:

1. **Reproduce** — confirm the issue happens consistently.
2. **Read the error** — the stack trace tells you where; understand WHY.
3. **Form a hypothesis** — use the 'think' tool to reason before acting.
4. **Test the hypothesis** — add a print/log or run a minimal repro.
5. **Fix the root cause** — not the symptom. If a null check fixes it but the null shouldn't happen, find why it's null.
6. **Verify** — run the failing test again. Run related tests.
7. **Document** — if the fix is non-obvious, add a comment explaining why.

Never guess-and-check by making random changes. Each fix attempt should be driven by a hypothesis.`,
  },
]

/** Seed built-in skills at boot. Idempotent. */
export function seedBuiltinSkills(): void {
  for (const def of BUILTIN_SKILLS) {
    const existing = db.select().from(skills).where(eq(skills.name, def.name)).get()
    if (existing) continue

    const fullContent = `---\nname: ${def.name}\ndescription: ${def.name.replace('-', ' ')} skill\ncategory: development\ntags: []\n---\n${def.content}`

    db.insert(skills)
      .values({
        id: uuid(),
        name: def.name,
        description: `${def.name.replace('-', ' ')} skill`,
        category: 'development',
        tags: '[]',
        content: def.content,
        source: 'builtin',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run()

    log.info({ name: def.name }, 'Built-in skill seeded')
  }
}
