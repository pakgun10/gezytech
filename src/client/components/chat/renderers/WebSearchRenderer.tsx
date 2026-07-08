import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Search, ExternalLink, Sparkles, AlertTriangle } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

interface SearchEntry {
  title?: string
  url?: string
  snippet?: string
  publishedAt?: number
  domain?: string
}

interface SearchAnswer {
  text?: string
  citations?: Array<{ url?: string; title?: string }>
}

function hostOf(url: string | undefined, fallback?: string): string | null {
  if (fallback) return fallback
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Rich renderer for web_search results — a synthesized answer block (when the
 * provider returns one) followed by a SERP-style list of results (title link,
 * domain, snippet). Falls back to JsonViewer for unexpected shapes.
 */
export function WebSearchRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const error = typeof res?.error === 'string' ? res.error : null
  const provider = typeof res?.provider === 'string' ? res.provider : null
  const results = Array.isArray(res?.results) ? (res!.results as SearchEntry[]) : null
  const answer = (res?.answer && typeof res.answer === 'object' ? res.answer : null) as SearchAnswer | null
  const warnings = Array.isArray(res?.warnings) ? (res!.warnings as string[]) : []
  const query = typeof args.query === 'string' ? args.query : null

  // Unexpected shape (no results array and no error) → fall back to JSON.
  if (!results && !error && status !== 'error') {
    return (
      <>
        <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
        {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
      </>
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <Search className="size-3 text-muted-foreground shrink-0" />
          {query && <span className="min-w-0 text-foreground truncate font-medium">{query}</span>}
          <span className="ml-auto flex items-center gap-2 shrink-0">
            {provider && <span className="text-[10px] text-muted-foreground">{provider}</span>}
            {results && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t('tools.renderers.searchResults', { count: results.length })}
              </span>
            )}
          </span>
        </div>

        {/* Error */}
        {(error || status === 'error') && (
          <div className="flex items-start gap-2 px-3 py-2 text-destructive">
            <AlertTriangle className="size-3 mt-0.5 shrink-0" />
            <span className="break-all">{error ?? t('tools.renderers.error')}</span>
          </div>
        )}

        {/* Synthesized answer */}
        {answer?.text && (
          <div className="px-3 py-2 border-b border-border/50 bg-primary/5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary mb-1">
              <Sparkles className="size-3" />
              {t('tools.renderers.searchAnswer')}
            </div>
            <p className="text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">{answer.text}</p>
            {!!answer.citations?.length && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {answer.citations.map((c, i) => (
                  <a
                    key={i}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {i + 1}. {hostOf(c.url, undefined) ?? c.title ?? c.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results list */}
        {results && results.length > 0 && (
          <ul className="divide-y divide-border/40 max-h-96 overflow-auto scrollbar-thin">
            {results.map((r, i) => {
              const host = hostOf(r.url, r.domain)
              return (
                <li key={i} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-1.5"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-foreground font-medium group-hover:text-primary transition-colors">
                        <span className="min-w-0 truncate">{r.title || r.url || t('tools.renderers.searchUntitled')}</span>
                        <ExternalLink className="size-2.5 shrink-0 opacity-0 group-hover:opacity-60" />
                      </span>
                      {host && <span className="block truncate text-[10px] text-muted-foreground/70">{host}</span>}
                      {r.snippet && (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground line-clamp-2">{r.snippet}</span>
                      )}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}

        {results && results.length === 0 && !error && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">{t('tools.renderers.searchNoResults')}</div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="px-3 py-1.5 space-y-0.5 bg-amber-500/5 border-t border-border/50">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-500">
                <AlertTriangle className="size-2.5 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showRaw ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {t('tools.renderers.rawJson')}
      </button>

      {showRaw && (
        <>
          <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
          {result !== undefined && <JsonViewer data={result} label={t('tools.renderers.output')} maxHeight="max-h-60" />}
        </>
      )}
    </div>
  )
}
