import { describe, it, expect } from 'bun:test'
import {
  parseSkillFrontmatter,
  skillRelevanceScore,
  formatSkillPromptBlock,
  BUILTIN_SKILLS,
} from '@/server/services/skills'

describe('parseSkillFrontmatter', () => {
  it('parses YAML frontmatter with name/description/category/tags', () => {
    const content = `---
name: code-reviewer
description: Systematic code review checklist
category: development
tags: [review, quality, checklist]
---
# Code Reviewer
When asked to review code...`
    const { frontmatter, body } = parseSkillFrontmatter(content)
    expect(frontmatter.name).toBe('code-reviewer')
    expect(frontmatter.description).toBe('Systematic code review checklist')
    expect(frontmatter.category).toBe('development')
    expect(frontmatter.tags).toEqual(['review', 'quality', 'checklist'])
    expect(body).toContain('# Code Reviewer')
  })

  it('falls back to heading + paragraph when no frontmatter', () => {
    const content = `# My Skill\n\nWhen asked to do X, follow these steps.`
    const { frontmatter, body } = parseSkillFrontmatter(content)
    expect(frontmatter.name).toBe('My Skill')
    expect(frontmatter.description).toContain('When asked to do X')
    expect(body).toBe(content)
  })

  it('handles empty content', () => {
    const { frontmatter, body } = parseSkillFrontmatter('')
    expect(frontmatter.name).toBe('')
    expect(frontmatter.category).toBe('general')
    expect(frontmatter.tags).toEqual([])
  })

  it('handles missing tags field', () => {
    const content = `---
name: test-skill
description: A test
---
Body here`
    const { frontmatter } = parseSkillFrontmatter(content)
    expect(frontmatter.name).toBe('test-skill')
    expect(frontmatter.tags).toEqual([])
  })

  it('handles quoted tags', () => {
    const content = `---
name: test
description: test
tags: ["one", "two", "three"]
---
Body`
    const { frontmatter } = parseSkillFrontmatter(content)
    expect(frontmatter.tags).toEqual(['one', 'two', 'three'])
  })

  it('falls back to heading for name when frontmatter has no name', () => {
    const content = `---
description: no name here
---
# Implicit Name
Body`
    const { frontmatter } = parseSkillFrontmatter(content)
    expect(frontmatter.name).toBe('Implicit Name')
  })
})

describe('skillRelevanceScore', () => {
  it('scores tag matches highest', () => {
    const skill = { tags: ['review', 'quality'], category: 'development', description: 'code review' }
    expect(skillRelevanceScore(skill, 'please review my code for quality')).toBeGreaterThan(0)
    // tag match = 3 points each; "review" and "quality" → 6
  })

  it('returns 0 for no match', () => {
    const skill = { tags: ['git'], category: 'development', description: 'git committer' }
    expect(skillRelevanceScore(skill, 'what is the weather')).toBe(0)
  })

  it('scores category match', () => {
    const skill = { tags: [], category: 'debugging', description: 'debug helper' }
    expect(skillRelevanceScore(skill, 'help me with debugging this issue')).toBeGreaterThan(0)
  })

  it('scores description keyword overlap', () => {
    const skill = { tags: [], category: 'general', description: 'systematic debugger' }
    expect(skillRelevanceScore(skill, 'I need a systematic approach')).toBeGreaterThan(0)
  })
})

describe('formatSkillPromptBlock', () => {
  it('formats name + content into a prompt block', () => {
    const block = formatSkillPromptBlock({ name: 'code-reviewer', content: 'Step 1: read code' })
    expect(block).toBe('## Active skill: code-reviewer\n\nStep 1: read code')
  })
})

describe('BUILTIN_SKILLS', () => {
  it('includes code-reviewer, git-committer, systematic-debugger', () => {
    const names = BUILTIN_SKILLS.map((s) => s.name)
    expect(names).toContain('code-reviewer')
    expect(names).toContain('git-committer')
    expect(names).toContain('systematic-debugger')
  })
  it('each skill has non-empty content', () => {
    for (const skill of BUILTIN_SKILLS) {
      expect(skill.content.length).toBeGreaterThan(50)
    }
  })
})
