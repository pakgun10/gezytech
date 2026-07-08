import { Hono } from 'hono'
import {
  listSkills,
  getSkill,
  createSkillFromMarkdown,
  deleteSkill,
  enableSkillForAgent,
  disableSkillForAgent,
  getActiveSkillsForAgent,
  parseSkillFrontmatter,
} from '@/server/services/skills'
import { sseManager } from '@/server/sse/index'
import { createLogger } from '@/server/logger'
import type { AppVariables } from '@/server/app'

const log = createLogger('routes:skills')

/**
 * CRUD + enable/disable REST for skills (installable instruction packs).
 * Skills are SKILL.md documents whose content is injected into the Agent's
 * system prompt when enabled.
 */
export const skillRoutes = new Hono<{ Variables: AppVariables }>()

function fail(c: any, err: unknown, status: 400 | 404 = 400) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  log.warn({ message }, 'skills route error')
  return c.json({ error: { code: 'SKILL_ERROR', message } }, status)
}

// GET /api/skills — list all installed skills.
skillRoutes.get('/', (c) => {
  return c.json({ skills: listSkills() })
})

// GET /api/skills/:id — get a single skill.
skillRoutes.get('/:id', (c) => {
  const skill = getSkill(c.req.param('id'))
  if (!skill) return c.json({ error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found' } }, 404)
  return c.json({ skill })
})

// POST /api/skills — install a skill from SKILL.md content.
// Body: { content: string, source?: string }
skillRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.content || typeof body.content !== 'string') {
      return c.json({ error: { code: 'SKILL_CONTENT_REQUIRED', message: 'content (SKILL.md text) is required' } }, 400)
    }
    const skill = createSkillFromMarkdown(body.content, body.source ?? 'manual')
    sseManager.broadcast({ type: 'skills:changed', data: {} })
    return c.json({ skill }, 201)
  } catch (err) {
    return fail(c, err)
  }
})

// DELETE /api/skills/:id — uninstall a skill.
skillRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const ok = deleteSkill(id)
  if (!ok) return c.json({ error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found' } }, 404)
  sseManager.broadcast({ type: 'skills:changed', data: {} })
  return c.json({ success: true })
})

// POST /api/skills/:id/enable — enable a skill for an agent.
// Body: { agentId: string }
skillRoutes.post('/:id/enable', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.agentId) {
      return c.json({ error: { code: 'AGENT_ID_REQUIRED', message: 'agentId is required' } }, 400)
    }
    const skill = getSkill(c.req.param('id'))
    if (!skill) return c.json({ error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found' } }, 404)
    enableSkillForAgent(skill.id, body.agentId)
    sseManager.broadcast({ type: 'skills:changed', data: {} })
    return c.json({ success: true, skillId: skill.id, agentId: body.agentId })
  } catch (err) {
    return fail(c, err)
  }
})

// POST /api/skills/:id/disable — disable a skill for an agent.
// Body: { agentId: string }
skillRoutes.post('/:id/disable', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.agentId) {
      return c.json({ error: { code: 'AGENT_ID_REQUIRED', message: 'agentId is required' } }, 400)
    }
    disableSkillForAgent(c.req.param('id'), body.agentId)
    sseManager.broadcast({ type: 'skills:changed', data: {} })
    return c.json({ success: true })
  } catch (err) {
    return fail(c, err)
  }
})

// GET /api/skills/agent/:agentId — list active skills for an agent.
skillRoutes.get('/agent/:agentId', (c) => {
  const skills = getActiveSkillsForAgent(c.req.param('agentId'))
  return c.json({ skills })
})

// POST /api/skills/parse — parse SKILL.md frontmatter without installing.
// Body: { content: string }
skillRoutes.post('/parse', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.content) {
      return c.json({ error: { code: 'CONTENT_REQUIRED', message: 'content is required' } }, 400)
    }
    const { frontmatter, body: skillBody } = parseSkillFrontmatter(body.content)
    return c.json({ frontmatter, body: skillBody })
  } catch (err) {
    return fail(c, err)
  }
})
