import { api } from '@/client/lib/api'
import { TOOL_DOMAIN_META, FALLBACK_DOMAIN_META } from '@/shared/constants'
import type { ToolDomain, BuiltinToolDomain, ToolDomainMetaResolved } from '@/shared/types'

/**
 * Client-side cache of tool-domain data.
 *
 * Two snapshots are fetched once on app boot from the server (the single source
 * of truth):
 *   1. name → domain map  (GET /api/tools/domains) — used to colour tool-call
 *      badges by the tool's domain.
 *   2. domain → visual meta (GET /api/tools/domain-meta) — icon + Tailwind
 *      triple + label, for BOTH built-in and user-created (custom) domains.
 *
 * Built-in domains also exist synchronously in TOOL_DOMAIN_META, so the meta
 * accessor never blocks first paint: it falls back to the static builtin map
 * (and a neutral default for an unknown/custom slug) while the fetch is
 * in-flight, then upgrades once hydrated.
 */

// ─── name → domain ────────────────────────────────────────────────────────────

let cache: Record<string, ToolDomain> | null = null
let pending: Promise<void> | null = null

export async function loadToolDomainMap(): Promise<void> {
  if (cache) return
  if (pending) return pending
  pending = api
    .get<Record<string, ToolDomain>>('/tools/domains')
    .then((map) => {
      cache = map
    })
    .catch(() => {
      // Leave cache null so subsequent calls will retry. Falling back to
      // 'mcp' for tool-call badges is graceful — the page still works.
    })
    .finally(() => {
      pending = null
    })
  return pending
}

/** Sync lookup. Returns `'mcp'` when the cache hasn't loaded yet. */
export function getToolDomain(name: string): ToolDomain {
  if (!cache) {
    // Kick off the load so a subsequent render gets the real value.
    void loadToolDomainMap()
    return 'mcp'
  }
  return cache[name] ?? 'mcp'
}

/** Snapshot of the cached map. Returns `{}` while loading. Used by callers
 *  that need to iterate the whole map (e.g. the AI-suggestion flow that
 *  expands a list of domains into a list of tool names). */
export function getToolDomainMap(): Record<string, ToolDomain> {
  if (!cache) {
    void loadToolDomainMap()
    return {}
  }
  return cache
}

// ─── domain → visual meta ───────────────────────────────────────────────────

/** Render-ready visual metadata for a domain. */
export interface DomainMeta {
  icon: string
  bg: string
  text: string
  border: string
  /** i18n key (builtin) — translate before display. */
  labelKey: string | null
  /** literal label (custom) — display verbatim when `labelKey` is null. */
  label: string | null
}

let metaCache: Record<string, ToolDomainMetaResolved> | null = null
let metaPending: Promise<void> | null = null

export async function loadToolDomainMeta(): Promise<void> {
  if (metaCache) return
  if (metaPending) return metaPending
  metaPending = api
    .get<{ domains: ToolDomainMetaResolved[] }>('/tools/domain-meta')
    .then(({ domains }) => {
      const map: Record<string, ToolDomainMetaResolved> = {}
      for (const d of domains) map[d.slug] = d
      metaCache = map
    })
    .catch(() => {
      // Leave null to retry; builtin fallback keeps the UI rendering.
    })
    .finally(() => {
      metaPending = null
    })
  return metaPending
}

function builtinMeta(slug: string): DomainMeta | null {
  const m = TOOL_DOMAIN_META[slug as BuiltinToolDomain]
  if (!m) return null
  return { icon: m.icon, bg: m.bg, text: m.text, border: m.border, labelKey: m.labelKey, label: null }
}

/**
 * Resolve a domain's visual metadata. Never throws / never returns undefined.
 * Precedence: hydrated cache (custom + builtin) → static builtin map → neutral
 * fallback. Kicks off the async hydration when the cache is cold so a custom
 * domain upgrades from the fallback on a subsequent render.
 */
export function getToolDomainMeta(domain: string): DomainMeta {
  if (metaCache && metaCache[domain]) {
    const d = metaCache[domain]
    return { icon: d.icon, bg: d.bg, text: d.text, border: d.border, labelKey: d.labelKey, label: d.label }
  }
  // Builtins are always available synchronously.
  const builtin = builtinMeta(domain)
  if (builtin) {
    // Still hydrate so any custom domains become available later.
    if (!metaCache) void loadToolDomainMeta()
    return builtin
  }
  // Unknown/custom slug not hydrated yet → fallback + kick off load.
  void loadToolDomainMeta()
  return {
    icon: FALLBACK_DOMAIN_META.icon,
    bg: FALLBACK_DOMAIN_META.bg,
    text: FALLBACK_DOMAIN_META.text,
    border: FALLBACK_DOMAIN_META.border,
    labelKey: FALLBACK_DOMAIN_META.labelKey,
    label: null,
  }
}

/** Test-only: reset internal state. */
export function _resetToolDomainCache(): void {
  cache = null
  pending = null
  metaCache = null
  metaPending = null
}
