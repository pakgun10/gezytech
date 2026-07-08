import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ChevronsUpDown } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/client/components/ui/popover'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { cn } from '@/client/lib/utils'
import { resolveLucideIcon } from '@/client/components/common/ToolDomainIcon'

// ---------------------------------------------------------------------------
// Valid icon-name set — computed ONCE at module scope (lucide-react exports
// ~1500 icons + a handful of non-icon helpers). We keep only PascalCase keys
// that resolve to a renderable component and exclude the known non-icon
// exports. `*Icon` aliases are harmless duplicates and kept for simplicity.
// ---------------------------------------------------------------------------

const NON_ICON_EXPORTS = new Set([
  'createLucideIcon',
  'Icon',
  'icons',
  'LucideIcon',
])

const ICON_NAME_RE = /^[A-Z][A-Za-z0-9]+$/

const ICON_MAP = LucideIcons as unknown as Record<string, unknown>

const VALID_ICON_NAMES: string[] = Object.keys(ICON_MAP)
  .filter((name) => {
    if (NON_ICON_EXPORTS.has(name)) return false
    if (!ICON_NAME_RE.test(name)) return false
    const candidate = ICON_MAP[name]
    // Lucide icons are forwardRef render components (objects) or functions.
    return typeof candidate === 'object' || typeof candidate === 'function'
  })
  .sort((a, b) => a.localeCompare(b))

const VALID_ICON_SET = new Set(VALID_ICON_NAMES)

/** Curated, commonly useful icons shown when the search box is empty so we
 *  never render the full ~1500 set on open. Filtered through the valid set so
 *  a renamed/removed Lucide export silently drops out instead of crashing. */
const CURATED_ICON_NAMES: string[] = [
  'Search', 'Globe', 'Wrench', 'Cloud', 'CloudSun', 'Wallet', 'Bot',
  'Calendar', 'Mail', 'Database', 'Code', 'Terminal', 'FileText', 'Image',
  'Music', 'MapPin', 'Zap', 'Bell', 'Heart', 'Star', 'ShoppingCart',
  'CreditCard', 'Activity', 'BarChart', 'LineChart', 'Sun', 'Moon',
  'Thermometer', 'Wind', 'Droplet', 'Plane', 'Car', 'Home', 'Users',
  'MessageCircle', 'Phone', 'Camera', 'Video', 'Folder', 'Settings',
].filter((name) => VALID_ICON_SET.has(name))

/** Max icons rendered for a non-empty query — guards against rendering
 *  hundreds of matches for a broad substring like "circle". */
const MAX_RESULTS = 80

interface LucideIconPickerProps {
  value: string
  onChange: (name: string) => void
  className?: string
  disabled?: boolean
}

export function LucideIconPicker({ value, onChange, className, disabled }: LucideIconPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const SelectedIcon: LucideIcon = resolveLucideIcon(value)

  const { results, truncated } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return { results: CURATED_ICON_NAMES, truncated: false }
    }
    const matches = VALID_ICON_NAMES.filter((name) => name.toLowerCase().includes(q))
    return { results: matches.slice(0, MAX_RESULTS), truncated: matches.length > MAX_RESULTS }
  }, [query])

  function handleSelect(name: string) {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={t('customTools.iconPicker.trigger')}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <SelectedIcon className="size-4 shrink-0" />
            <span className={cn('truncate', !value && 'text-muted-foreground')}>
              {value || t('customTools.iconPicker.placeholder')}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Avoid submitting the surrounding form on Enter.
            if (e.key === 'Enter') e.preventDefault()
          }}
          placeholder={t('customTools.iconPicker.search')}
          className="mb-2"
        />
        <ScrollArea className="h-56">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('customTools.iconPicker.noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-1 pr-2">
              {results.map((name) => {
                const Icon = resolveLucideIcon(name)
                const selected = name === value
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={name}
                    aria-pressed={selected}
                    onClick={() => handleSelect(name)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      selected && 'border-foreground bg-accent text-accent-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
        {truncated && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t('customTools.iconPicker.truncated', { count: MAX_RESULTS })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
