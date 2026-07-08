/**
 * Generic OAuth2 authorization-code flow used by email (and future) providers.
 *
 * The host owns this single implementation; each provider only declares its
 * endpoints + scopes via an `OAuthProfile` (SDK). The client id / secret are
 * the operator's app credentials (app settings), never the provider's. This is
 * what makes OAuth pluggable: a plugin email provider that uses OAuth2 just
 * declares a profile and the host runs the dance.
 */
import type { OAuthProfile } from '@/server/email/types'

export interface OAuthTokens {
  accessToken: string
  /** Present on the initial code exchange (with `access_type=offline`); refresh
   *  responses usually omit it, in which case the caller keeps the existing one. */
  refreshToken?: string
  /** Absolute expiry, Unix ms. */
  expiresAt: number
  scope?: string
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

/** Build the URL the user's browser is redirected to in order to authorize. */
export function buildAuthorizeUrl(opts: {
  profile: OAuthProfile
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(opts.profile.authorizeUrl)
  url.searchParams.set('client_id', opts.clientId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', opts.profile.scopes.join(' '))
  url.searchParams.set('state', opts.state)
  for (const [k, v] of Object.entries(opts.profile.authorizeParams ?? {})) {
    url.searchParams.set(k, v)
  }
  return url.toString()
}

async function postToken(tokenUrl: string, body: URLSearchParams): Promise<OAuthTokens> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`OAuth token endpoint ${res.status}: ${text.slice(0, 300)}`)
  let json: TokenResponse
  try {
    json = JSON.parse(text) as TokenResponse
  } catch {
    throw new Error(`OAuth token endpoint returned non-JSON: ${text.slice(0, 200)}`)
  }
  if (!json.access_token) throw new Error('OAuth token endpoint returned no access_token')
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope,
  }
}

/** Exchange an authorization code for tokens (the OAuth callback step). */
export async function exchangeCode(opts: {
  profile: OAuthProfile
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<OAuthTokens> {
  return postToken(
    opts.profile.tokenUrl,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
    }),
  )
}

/** Exchange a refresh token for a fresh access token. */
export async function refreshAccessToken(opts: {
  profile: OAuthProfile
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<OAuthTokens> {
  const tokens = await postToken(
    opts.profile.tokenUrl,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: opts.refreshToken,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }),
  )
  // Refresh responses usually omit refresh_token — keep the original.
  return { ...tokens, refreshToken: tokens.refreshToken ?? opts.refreshToken }
}

/** Resolve the connected account's email address via the provider's userInfo
 *  endpoint (when declared). Best-effort: returns null on any failure. */
export async function fetchAccountEmail(
  profile: OAuthProfile,
  accessToken: string,
): Promise<string | null> {
  if (!profile.userInfoUrl) return null
  try {
    const res = await fetch(profile.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const j = (await res.json()) as {
      email?: string
      emailAddress?: string
      mail?: string
      userPrincipalName?: string
    }
    return j.email ?? j.emailAddress ?? j.mail ?? j.userPrincipalName ?? null
  } catch {
    return null
  }
}
