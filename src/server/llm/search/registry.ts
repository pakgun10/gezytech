import type { SearchProvider } from '@/server/llm/search/types'

const registry = new Map<string, SearchProvider>()

export function registerSearchProvider(provider: SearchProvider): void {
  if (registry.has(provider.type)) {
    throw new Error(`Search provider already registered: ${provider.type}`)
  }
  registry.set(provider.type, provider)
}

export function unregisterSearchProvider(type: string): void {
  registry.delete(type)
}

export function getSearchProvider(type: string): SearchProvider | undefined {
  return registry.get(type)
}

export function listSearchProviders(): SearchProvider[] {
  return [...registry.values()]
}
