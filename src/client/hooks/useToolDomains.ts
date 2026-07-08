import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { _resetToolDomainCache } from '@/client/lib/tool-domain-lookup'
import { useSSE, useSSEResync } from '@/client/hooks/useSSE'
import type { ToolDomainEntry } from '@/shared/types'

interface DomainsResponse {
  domains: ToolDomainEntry[]
}
interface DomainResponse {
  domain: ToolDomainEntry
}

export interface CreateToolDomainInput {
  slug: string
  label: string
  icon: string
  color: string
  description?: string | null
}
export type UpdateToolDomainInput = Partial<Omit<CreateToolDomainInput, 'slug'>>

/**
 * CRUD over the global tool domains (GET/POST/PATCH/DELETE /api/tool-domains).
 * Built-in domains (builtin=true) are read-only server-side. After any mutation
 * the client-side domain-meta cache is reset so badges/icons re-resolve.
 */
export function useToolDomains() {
  const [domains, setDomains] = useState<ToolDomainEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const data = await api.get<DomainsResponse>('/tool-domains')
      setDomains(data.domains)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  useSSE({
    'tool-domain:created': (data) => {
      const domain = data as unknown as ToolDomainEntry
      setDomains((prev) => {
        if (prev.some((d) => d.slug === domain.slug)) return prev
        return [...prev, domain]
      })
      _resetToolDomainCache()
    },
    'tool-domain:updated': (data) => {
      const domain = data as unknown as ToolDomainEntry
      setDomains((prev) => prev.map((d) => (d.slug === domain.slug ? domain : d)))
      _resetToolDomainCache()
    },
    'tool-domain:deleted': (data) => {
      const slug = data.slug as string
      setDomains((prev) => prev.filter((d) => d.slug !== slug))
      _resetToolDomainCache()
    },
  })

  useSSEResync(refetch)

  const createDomain = useCallback(async (input: CreateToolDomainInput) => {
    const { domain } = await api.post<DomainResponse>('/tool-domains', input)
    setDomains((prev) => [...prev, domain])
    _resetToolDomainCache()
    return domain
  }, [])

  const updateDomain = useCallback(async (slug: string, input: UpdateToolDomainInput) => {
    const { domain } = await api.patch<DomainResponse>(`/tool-domains/${slug}`, input)
    setDomains((prev) => prev.map((d) => (d.slug === slug ? domain : d)))
    _resetToolDomainCache()
    return domain
  }, [])

  const deleteDomain = useCallback(async (slug: string) => {
    await api.delete(`/tool-domains/${slug}`)
    setDomains((prev) => prev.filter((d) => d.slug !== slug))
    _resetToolDomainCache()
  }, [])

  return { domains, isLoading, refetch, createDomain, updateDomain, deleteDomain }
}
