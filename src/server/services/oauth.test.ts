import { describe, it, expect } from 'bun:test'
import { buildAuthorizeUrl } from '@/server/services/oauth'
import type { OAuthProfile } from '@/server/email/types'

const profile: OAuthProfile = {
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  authorizeParams: { access_type: 'offline', prompt: 'consent' },
}

describe('buildAuthorizeUrl', () => {
  const url = () =>
    new URL(buildAuthorizeUrl({ profile, clientId: 'cid', redirectUri: 'https://app/cb', state: 'st' }))

  it('targets the provider authorize endpoint', () => {
    const u = url()
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
  })

  it('sets the standard OAuth2 params', () => {
    const u = url()
    expect(u.searchParams.get('client_id')).toBe('cid')
    expect(u.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(u.searchParams.get('response_type')).toBe('code')
    expect(u.searchParams.get('scope')).toBe(profile.scopes.join(' '))
    expect(u.searchParams.get('state')).toBe('st')
  })

  it('appends provider-declared authorizeParams (offline access)', () => {
    const u = url()
    expect(u.searchParams.get('access_type')).toBe('offline')
    expect(u.searchParams.get('prompt')).toBe('consent')
  })
})
