/**
 * In-memory access-token cache for OAuth email accounts.
 *
 * Refresh tokens live (encrypted) in the account's provider config; access
 * tokens are short-lived, so we cache them per-account in memory and refresh on
 * demand. The email tools call `getFreshAccessToken` right before talking to the
 * provider API, so the provider implementations never deal with OAuth refresh.
 */
import { getEmailProvider } from '@/server/email/registry'
import { refreshAccessToken } from '@/server/services/oauth'
import { getOAuthClient } from '@/server/services/app-settings'

interface CachedToken {
  accessToken: string
  expiresAt: number
}

const cache = new Map<string, CachedToken>()

/** Refresh a minute before the provider-reported expiry to avoid races. */
const REFRESH_SKEW_MS = 60_000

export interface OAuthAccountRef {
  /** Provider row id — the cache key. */
  id: string
  /** Provider type, e.g. 'gmail'. */
  type: string
  /** Durable refresh token from the account's decrypted config. */
  refreshToken: string
}

/**
 * Return a valid access token for an OAuth email account, refreshing if the
 * cached one is missing or about to expire. Throws when the provider isn't
 * OAuth-based or the operator hasn't configured the app credentials.
 */
export async function getFreshAccessToken(account: OAuthAccountRef): Promise<string> {
  const cached = cache.get(account.id)
  if (cached && cached.expiresAt > Date.now() + REFRESH_SKEW_MS) return cached.accessToken

  const provider = getEmailProvider(account.type)
  if (!provider?.oauth) throw new Error(`Email provider ${account.type} is not OAuth-based`)

  const client = await getOAuthClient(account.type)
  if (!client) throw new Error(`OAuth app credentials not configured for ${account.type}`)

  const tokens = await refreshAccessToken({
    profile: provider.oauth,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    refreshToken: account.refreshToken,
  })
  cache.set(account.id, { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt })
  return tokens.accessToken
}

/** Drop a cached token (e.g. on disconnect or after a 401). */
export function invalidateAccessToken(accountId: string): void {
  cache.delete(accountId)
}
