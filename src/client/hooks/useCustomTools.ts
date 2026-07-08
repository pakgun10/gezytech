import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import { refreshCustomToolNames } from '@/client/lib/custom-tool-names'
import { useSSE, useSSEResync } from '@/client/hooks/useSSE'
import type { CustomTool, CustomToolTranslations } from '@/shared/types'

interface ToolsResponse {
  tools: CustomTool[]
}
interface ToolResponse {
  tool: CustomTool
}

export interface CreateCustomToolInput {
  slug: string
  name: string
  description: string
  parameters: string
  entrypoint?: string
  language?: string | null
  domainSlug?: string | null
  timeoutMs?: number | null
  code?: string
  /** UI-only localized overrides (per locale). */
  translations?: CustomToolTranslations | null
}
export type UpdateCustomToolInput = Partial<{
  name: string
  description: string
  parameters: string
  entrypoint: string
  language: string | null
  domainSlug: string
  timeoutMs: number | null
  enabled: boolean
  translations: CustomToolTranslations | null
}>

export interface SetupResult {
  success: boolean
  output: string
  error?: string
}
export interface TestResult {
  success: boolean
  output: unknown
  error?: string
  exitCode: number
  executionTime: number
}

/** CRUD + authoring for GLOBAL custom tools (/api/custom-tools). Mirrors
 *  useToolboxes. UI-created tools are active immediately. */
export function useCustomTools() {
  const [tools, setTools] = useState<CustomTool[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const data = await api.get<ToolsResponse>('/custom-tools')
      setTools(data.tools)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  useSSE({
    'custom-tool:created': (data) => {
      const tool = data as unknown as CustomTool
      setTools((prev) => {
        if (prev.some((t) => t.slug === tool.slug)) return prev
        return [...prev, tool]
      })
      refreshCustomToolNames()
    },
    'custom-tool:updated': (data) => {
      const tool = data as unknown as CustomTool
      setTools((prev) => prev.map((t) => (t.slug === tool.slug ? tool : t)))
      refreshCustomToolNames()
    },
    'custom-tool:deleted': (data) => {
      const slug = data.slug as string
      setTools((prev) => prev.filter((t) => t.slug !== slug))
      refreshCustomToolNames()
    },
  })

  useSSEResync(refetch)

  const createTool = useCallback(async (input: CreateCustomToolInput) => {
    const { tool } = await api.post<ToolResponse>('/custom-tools', input)
    setTools((prev) => [...prev, tool])
    // Invalidate the chat's custom-tool-name/renderer cache so the new tool
    // (and any renderer it ships) reflects immediately in open conversations.
    refreshCustomToolNames()
    return tool
  }, [])

  const updateTool = useCallback(async (slug: string, input: UpdateCustomToolInput) => {
    const { tool } = await api.patch<ToolResponse>(`/custom-tools/${slug}`, input)
    setTools((prev) => prev.map((t) => (t.slug === slug ? tool : t)))
    // Force-refresh so e.g. a renderer added to an already-cached tool, or a
    // renamed tool, updates in open conversations (the miss path can't catch a
    // key that already exists).
    refreshCustomToolNames()
    return tool
  }, [])

  const deleteTool = useCallback(async (slug: string) => {
    await api.delete(`/custom-tools/${slug}`)
    setTools((prev) => prev.filter((t) => t.slug !== slug))
    refreshCustomToolNames()
  }, [])

  // ── file authoring ──────────────────────────────────────────────────────────
  const listFiles = useCallback(async (slug: string) => {
    const { files } = await api.get<{ tool: CustomTool; files: string[] }>(`/custom-tools/${slug}`)
    return files
  }, [])
  const readFile = useCallback(async (slug: string, path: string) => {
    const { content } = await api.get<{ content: string }>(`/custom-tools/${slug}/file?path=${encodeURIComponent(path)}`)
    return content
  }, [])
  const writeFile = useCallback(async (slug: string, path: string, content: string) => {
    await api.put(`/custom-tools/${slug}/files`, { path, content })
  }, [])
  const runSetup = useCallback(async (slug: string) => {
    return api.post<SetupResult>(`/custom-tools/${slug}/setup`, {})
  }, [])
  const testTool = useCallback(async (slug: string, args: Record<string, unknown>) => {
    return api.post<TestResult>(`/custom-tools/${slug}/test`, { args })
  }, [])

  return {
    tools,
    isLoading,
    refetch,
    createTool,
    updateTool,
    deleteTool,
    listFiles,
    readFile,
    writeFile,
    runSetup,
    testTool,
  }
}
