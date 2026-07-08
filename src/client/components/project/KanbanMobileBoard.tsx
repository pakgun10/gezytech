import { useTranslation } from 'react-i18next'
import {
  Inbox,
  ListTodo,
  Loader2,
  Ban,
  CheckCircle2,
  ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react'
import { TicketCard } from './TicketCard'
import { QuickAddTicket } from './QuickAddTicket'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu'
import { Button } from '@/client/components/ui/button'
import { TICKET_STATUSES } from '@/shared/constants'
import { cn } from '@/client/lib/utils'
import type { TicketStatus, TicketSummary } from '@/shared/types'

/**
 * Mobile single-column kanban (< 768px). The five fixed `w-72` desktop columns
 * force a ~1440px horizontal scroll, so on mobile we show ONE status at a time:
 *  - a `Select` switcher across the five statuses (with a per-status dot + count)
 *  - the vertical list of that status's tickets
 *
 * Touch drag-and-drop is replaced by a "move to status" action per card: a
 * small dropdown that calls `onMove(ticketId, status)` — which the parent wires
 * straight to the SAME `updateTicket` mutation the desktop dnd `onDragEnd` uses.
 *
 * Desktop (>= 768px) keeps the untouched dnd board; this component is only
 * mounted on mobile.
 */

const STATUS_META: Record<
  TicketStatus,
  { dot: string; icon: LucideIcon; iconClass: string }
> = {
  backlog: { dot: 'bg-muted-foreground/60', icon: Inbox, iconClass: 'text-muted-foreground/40' },
  todo: { dot: 'bg-info', icon: ListTodo, iconClass: 'text-info/40' },
  in_progress: { dot: 'bg-primary', icon: Loader2, iconClass: 'text-primary/40' },
  blocked: { dot: 'bg-destructive', icon: Ban, iconClass: 'text-destructive/40' },
  done: { dot: 'bg-success', icon: CheckCircle2, iconClass: 'text-success/40' },
}

interface KanbanMobileBoardProps {
  /** Tickets grouped by status (already filtered + sorted by the parent). */
  byStatus: Record<TicketStatus, TicketSummary[]>
  /** Currently shown status column. */
  activeStatus: TicketStatus
  onActiveStatusChange: (status: TicketStatus) => void
  onTicketClick: (ticket: TicketSummary) => void
  /** Lowercased search query, forwarded to cards for highlighting. */
  highlightQuery?: string
  onTagClick?: (label: string) => void
  /** Inline quick-add for the active status column. */
  onQuickCreate?: (input: { title: string; status: TicketStatus }) => Promise<unknown>
  /** Move a ticket to another status. Wired by the parent to `updateTicket`. */
  onMove: (ticketId: string, status: TicketStatus) => void
}

export function KanbanMobileBoard({
  byStatus,
  activeStatus,
  onActiveStatusChange,
  onTicketClick,
  highlightQuery,
  onTagClick,
  onQuickCreate,
  onMove,
}: KanbanMobileBoardProps) {
  const { t } = useTranslation()
  const tickets = byStatus[activeStatus] ?? []
  const meta = STATUS_META[activeStatus]
  const EmptyIcon = meta.icon

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Status switcher — one column visible at a time. Each option shows the
          status dot + its ticket count so the user keeps board-wide awareness. */}
      <Select value={activeStatus} onValueChange={(v) => onActiveStatusChange(v as TicketStatus)}>
        <SelectTrigger className="w-full" aria-label={t('projects.kanban.mobileStatusSwitcher', { defaultValue: 'Switch status column' })}>
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden />
              {t(`projects.status.${activeStatus}`)}
              <span className="text-xs tabular-nums text-muted-foreground">
                {tickets.length}
              </span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TICKET_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', STATUS_META[status].dot)} aria-hidden />
                {t(`projects.status.${status}`)}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {(byStatus[status] ?? []).length}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Vertical list of the active status's tickets. Each card gets a
          "move to status" dropdown overlaid in the top-right corner. */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="relative">
            <TicketCard
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
              highlightQuery={highlightQuery}
              onTagClick={onTagClick}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1.5 z-10 size-7 bg-background/60 backdrop-blur-sm hover:bg-background"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('projects.kanban.moveTicket', { defaultValue: 'Move ticket' })}
                  title={t('projects.kanban.moveTicket', { defaultValue: 'Move ticket' })}
                >
                  <ArrowRightLeft className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel>
                  {t('projects.kanban.moveTo', { defaultValue: 'Move to' })}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TICKET_STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={status === ticket.status}
                    onSelect={() => {
                      if (status !== ticket.status) onMove(ticket.id, status)
                    }}
                  >
                    <span className={cn('size-2 rounded-full', STATUS_META[status].dot)} aria-hidden />
                    {t(`projects.status.${status}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {onQuickCreate && tickets.length > 0 && !highlightQuery && (
          <QuickAddTicket status={activeStatus} onCreate={onQuickCreate} />
        )}

        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 pt-10 pb-4 text-center">
            <EmptyIcon className={cn('size-7', meta.iconClass)} strokeWidth={1.5} aria-hidden />
            <p className="text-xs leading-snug text-muted-foreground/70">
              {highlightQuery
                ? t('projects.kanban.emptySearchInColumn')
                : t(`projects.kanban.empty.${activeStatus}`)}
            </p>
            {onQuickCreate && !highlightQuery && (
              <div className="mt-1 w-full max-w-[16rem]">
                <QuickAddTicket status={activeStatus} onCreate={onQuickCreate} prominent />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
