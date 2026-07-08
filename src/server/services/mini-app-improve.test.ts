import { describe, it, expect } from 'bun:test'
import { formatMiniAppImproveRequest } from '@/server/services/mini-app-improve'

describe('formatMiniAppImproveRequest', () => {
  const base = {
    appName: 'Budget Tracker',
    appSlug: 'budget-tracker',
    appId: 'app-123',
    description: 'Add a dark mode toggle in the header',
    requesterName: 'Niko',
  }

  it('includes the app name, slug and id so the maintainer can act on it', () => {
    const msg = formatMiniAppImproveRequest(base)
    expect(msg).toContain('Budget Tracker')
    expect(msg).toContain('budget-tracker')
    expect(msg).toContain('app-123')
  })

  it('includes the requester and the verbatim description', () => {
    const msg = formatMiniAppImproveRequest(base)
    expect(msg).toContain('Niko')
    expect(msg).toContain('Add a dark mode toggle in the header')
  })

  it('trims the description', () => {
    const msg = formatMiniAppImproveRequest({ ...base, description: '   spaced out   ' })
    expect(msg).toContain('spaced out')
    expect(msg).not.toContain('   spaced out   ')
  })

  it('tells the maintainer it can edit any app', () => {
    const msg = formatMiniAppImproveRequest(base)
    expect(msg.toLowerCase()).toContain('any app')
  })
})
