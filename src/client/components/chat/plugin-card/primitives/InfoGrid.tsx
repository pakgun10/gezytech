/**
 * InfoGrid: a label/value primitive for plugin cards.
 *
 * Renders a 2 or 3 column CSS grid. Each cell has a small uppercase
 * muted label on top and a value below. There is no border or input-like
 * background, so the result reads as informational text rather than a
 * form. When `truncate: true`, long values clip with ellipsis and a
 * shadcn Tooltip surfaces the full text on hover.
 */

import { memo } from 'react'
import { cn } from '@/client/lib/utils'
import type { PluginCardInfoGridItem } from '@/shared/types/plugin-cards'
import { statValueClass } from '../variants'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/client/components/ui/tooltip'
import { PluginIcon } from '../PluginIcon'

interface InfoGridProps {
  columns?: 2 | 3
  items: PluginCardInfoGridItem[]
}

const COLUMN_CLASS: Record<2 | 3, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
}

export const InfoGrid = memo(function InfoGrid({ columns = 2, items }: InfoGridProps) {
  if (!Array.isArray(items) || items.length === 0) return null
  const safeColumns: 2 | 3 = columns === 3 ? 3 : 2
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('grid gap-x-4 gap-y-2', COLUMN_CLASS[safeColumns])}>
        {items.map((item, idx) => {
          const valueClass = cn('text-sm font-medium', statValueClass(item.variant))
          const value = item.truncate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    valueClass,
                    'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap',
                  )}
                >
                  {item.value}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-md break-all">
                {item.value}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className={cn(valueClass, 'break-words')}>{item.value}</span>
          )
          return (
            <div
              key={`${item.label}-${idx}`}
              className="flex min-w-0 flex-col gap-0.5"
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                {item.icon && <PluginIcon name={item.icon} size={14} />}
                <span className="min-w-0 flex-1">{value}</span>
              </span>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
})
