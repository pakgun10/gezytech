import { Puzzle, type LucideProps, type LucideIcon } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { getToolDomainMeta } from '@/client/lib/tool-domain-lookup'
import type { ToolDomain } from '@/shared/types'

/** Resolve a Lucide component by its string name (e.g. "Search"). Falls back to
 *  Puzzle for an unknown name — custom domains may reference any Lucide icon. */
export function resolveLucideIcon(name: string | undefined): LucideIcon {
  if (!name) return Puzzle
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[name]
  return Icon ?? Puzzle
}

interface ToolDomainIconProps extends LucideProps {
  /** Domain slug (builtin or custom). Resolved to an icon name via the domain
   *  metadata cache. Ignored when `iconName` is provided. */
  domain?: ToolDomain
  /** Explicit Lucide icon name — used by the domain picker preview. */
  iconName?: string
}

/**
 * Renders the Lucide icon for a tool domain. Built-in domains resolve their
 * icon synchronously from TOOL_DOMAIN_META; custom domains resolve via the
 * hydrated domain-meta cache (with a Puzzle fallback while loading / for
 * unknown icons). Pass `iconName` to render a specific icon directly.
 */
export function ToolDomainIcon({ domain, iconName, ...props }: ToolDomainIconProps) {
  const name = iconName ?? (domain ? getToolDomainMeta(domain).icon : undefined)
  const Icon = resolveLucideIcon(name)
  return <Icon {...props} />
}
