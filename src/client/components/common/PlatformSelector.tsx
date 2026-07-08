import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { usePlatforms, type PlatformInfo } from '@/client/hooks/usePlatforms'
import { cn } from '@/client/lib/utils'

interface PlatformSelectorProps {
  value: string
  onValueChange: (value: string) => void
  /** Additional platform entries to show alongside registered adapters (e.g. "irc", "webchat") */
  extraPlatforms?: { platform: string; displayName: string }[]
  /** Compact mode for inline use */
  size?: 'default' | 'sm'
  className?: string
  disabled?: boolean
}

export function PlatformSelector({
  value,
  onValueChange,
  extraPlatforms,
  size = 'default',
  className,
  disabled,
}: PlatformSelectorProps) {
  const { platforms } = usePlatforms()

  // Merge registered platforms with extras, deduplicating by platform key
  const registeredKeys = new Set(platforms.map((p) => p.platform))
  const extras: PlatformInfo[] = (extraPlatforms ?? [])
    .filter((e) => !registeredKeys.has(e.platform))
    .map((e) => ({ ...e, isPlugin: false }))
  const allPlatforms = [...platforms, ...extras]

  // Find display name for current value
  const current = allPlatforms.find((p) => p.platform === value)

  const isSmall = size === 'sm'

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn(isSmall ? 'h-7 text-xs px-2' : 'w-full', className)}>
        <SelectValue>
          <span className={cn('flex items-center gap-2', isSmall && 'gap-1.5')}>
            <PlatformIcon
              platform={value}
              variant="color"
              className={isSmall ? 'size-3' : 'size-4'}
              iconUrl={current?.iconUrl}
            />
            {current?.displayName ?? value}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allPlatforms.map((p) => (
          <SelectItem key={p.platform} value={p.platform}>
            <span className={cn('flex items-center gap-2', isSmall && 'gap-1.5')}>
              <PlatformIcon
                platform={p.platform}
                variant="color"
                className={isSmall ? 'size-3' : 'size-4'}
                iconUrl={p.iconUrl}
              />
              {p.displayName}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
