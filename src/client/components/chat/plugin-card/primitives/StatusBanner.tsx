/**
 * StatusBanner: a prominent state block for plugin cards.
 *
 * Variant-driven theming (border tint + background tint + accented
 * text), a large icon (Lucide name or react-icons id via PluginIcon),
 * a `label` as primary text, and an optional `sublabel` as muted
 * secondary text.
 *
 * Animations:
 *   - "pulse"   : the icon pulses (Tailwind animate-pulse).
 *   - "shimmer" : a horizontal highlight sweep slides across the banner.
 *                 Keyframes live in src/client/styles/globals.css under
 *                 plugin-card-shimmer.
 *   - "spin"    : the icon rotates (Tailwind animate-spin).
 *   - "none"    : static.
 */

import { memo } from 'react'
import { cn } from '@/client/lib/utils'
import type {
  PluginCardBannerAnimation,
  PluginCardVariant,
} from '@/shared/types/plugin-cards'
import { accentTextClass, bannerSurfaceClass } from '../variants'
import { PluginIcon } from '../PluginIcon'

interface StatusBannerProps {
  label: string
  sublabel?: string
  variant?: PluginCardVariant
  icon?: string
  animated?: PluginCardBannerAnimation
}

function iconAnimationClass(animated: PluginCardBannerAnimation | undefined): string {
  switch (animated) {
    case 'pulse': return 'animate-pulse'
    case 'spin': return 'animate-spin'
    case 'shimmer':
    case 'none':
    case undefined:
    default:
      return ''
  }
}

export const StatusBanner = memo(function StatusBanner({
  label,
  sublabel,
  variant = 'default',
  icon,
  animated = 'none',
}: StatusBannerProps) {
  const surface = bannerSurfaceClass(variant)
  const accent = accentTextClass(variant)
  const iconAnim = iconAnimationClass(animated)
  const showShimmer = animated === 'shimmer'

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-md border px-3 py-2.5',
        surface,
      )}
    >
      {icon && (
        <div className={cn('flex shrink-0 items-center justify-center', accent, iconAnim)}>
          <PluginIcon name={icon} size={28} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('text-sm font-semibold leading-tight', accent)}>
          {label}
        </span>
        {sublabel && (
          <span className="mt-0.5 truncate text-xs text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
      {showShimmer && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-plugin-card-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/15"
        />
      )}
    </div>
  )
})
