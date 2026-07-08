/**
 * Skill management tools — let the Agent discover and activate skills
 * from chat, making the platform self-improving (gezyhd requires CLI for
 * skill install; gezyhive lets the agent do it in-conversation).
 *
 * - `list_skills` — list all installed skills + which are active for this agent.
 * - `enable_skill` — activate a skill for this agent by name.
 * - `disable_skill` — deactivate a skill for this agent by name.
 *
 * Security: these are `readOnly: false` (they change agent config) but not
 * destructive — enabling a skill only injects instructions into the prompt.
 * `defaultDisabled: false` — available by default (the agent should be able
 * to discover and request skills without manual opt-in).
 */
import { z } from 'zod'
import { tool } from '@/server/tools/tool-helper'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'
import {
  listSkills,
  enableSkillForAgent,
  disableSkillForAgent,
  getActiveSkillsForAgent,
} from '@/server/services/skills'

const log = createLogger('skill-tools')

export const listSkillsTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: true,
  concurrencySafe: true,
  create: (ctx) =>
    tool({
      description:
        'List all installed skills (instruction packs) and which ones are currently active for you. ' +
        'Skills are specialized procedures injected into your system prompt — e.g. "code-reviewer", ' +
        '"git-committer", "systematic-debugger". Use `enable_skill` to activate one, `disable_skill` to turn it off.',
      inputSchema: z.object({}),
      execute: async () => {
        const all = listSkills()
        const active = new Set(
          getActiveSkillsForAgent(ctx.agentId).map((s) => s.name),
        )
        return {
          success: true,
          total: all.length,
          activeCount: active.size,
          skills: all.map((s) => ({
            name: s.name,
            description: s.description,
            category: s.category,
            source: s.source,
            active: active.has(s.name),
          })),
        }
      },
    }),
}

export const enableSkillTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  create: (ctx) =>
    tool({
      description:
        'Activate a skill (instruction pack) for yourself by name. The skill\'s instructions will be ' +
        'injected into your system prompt on subsequent turns, giving you specialized procedures ' +
        'for that skill\'s domain. Use `list_skills` to see available names. The skill stays active ' +
        'until you call `disable_skill`.',
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .describe('Skill name (e.g. "code-reviewer", "systematic-debugger"). Use list_skills to see options.'),
      }),
      execute: async ({ name }) => {
        const all = listSkills()
        const skill = all.find((s) => s.name === name)
        if (!skill) {
          return {
            success: false,
            error: `Skill "${name}" not found. Use list_skills to see available skills.`,
          }
        }
        enableSkillForAgent(skill.id, ctx.agentId)
        log.info({ agentId: ctx.agentId, skill: name }, 'Skill enabled via tool')
        return {
          success: true,
          skill: name,
          message: `Skill "${name}" activated. Its instructions will guide your approach on relevant tasks.`,
        }
      },
    }),
}

export const disableSkillTool: ToolRegistration = {
  availability: ['main', 'sub-agent'],
  readOnly: false,
  concurrencySafe: false,
  create: (ctx) =>
    tool({
      description:
        'Deactivate a skill for yourself by name. The skill\'s instructions will no longer be ' +
        'injected into your system prompt. Use `list_skills` to see which skills are active.',
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .describe('Skill name to deactivate.'),
      }),
      execute: async ({ name }) => {
        const all = listSkills()
        const skill = all.find((s) => s.name === name)
        if (!skill) {
          return { success: false, error: `Skill "${name}" not found.` }
        }
        disableSkillForAgent(skill.id, ctx.agentId)
        log.info({ agentId: ctx.agentId, skill: name }, 'Skill disabled via tool')
        return {
          success: true,
          skill: name,
          message: `Skill "${name}" deactivated.`,
        }
      },
    }),
}
