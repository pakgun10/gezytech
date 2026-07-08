import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Loader2 } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { getErrorMessage } from '@/client/lib/api'
import { toast } from 'sonner'
import type { TicketStatus } from '@/shared/types'

interface QuickAddTicketProps {
  status: TicketStatus
  /** Async creator. Receives the trimmed title (plus the column's status, so the
   *  ticket lands in the column where the user clicked). */
  onCreate: (input: { title: string; status: TicketStatus }) => Promise<unknown>
  /** Visual accent class applied to the placeholder when hovered/active.
   *  Matches the column's status color so the affordance feels integrated. */
  accentBorderClass?: string
  /** When true, the placeholder is rendered with a slightly stronger baseline
   *  (used when the column is empty, since there's no hover target above it). */
  prominent?: boolean
}

/**
 * Inline "quick add ticket" placeholder displayed at the bottom of each kanban
 * column. Provides a fast path to create a ticket directly inside a status
 * (vs. opening the full CreateTicketModal which requires extra clicks).
 *
 * UX:
 *  - Idle: a subtle "+ Add ticket" row, low contrast — fades in on column hover
 *    so the kanban stays visually clean by default.
 *  - Editing: clicks toggle the row into an inline title input that autofocuses.
 *    Enter submits, Escape cancels, blur cancels when the field is empty.
 *  - Submitting: row disables and shows a spinner; errors are surfaced via toast.
 *
 * The status is pre-bound to the column, so the new ticket lands exactly where
 * the user expected.
 */
export function QuickAddTicket({ status, onCreate, accentBorderClass, prominent }: QuickAddTicketProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isEditing) {
      // Focus on next tick so the input is mounted
      inputRef.current?.focus()
    }
  }, [isEditing])

  function reset() {
    setTitle('')
    setIsEditing(false)
  }

  async function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) {
      reset()
      return
    }
    setSubmitting(true)
    try {
      await onCreate({ title: trimmed, status })
      // Stay open after a successful create — power users often want to add
      // several tickets in a row. Clear the title so they can keep typing.
      setTitle('')
      // Re-focus for the next entry
      requestAnimationFrame(() => inputRef.current?.focus())
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      reset()
    }
  }

  function handleBlur() {
    // Cancel on blur ONLY when nothing was typed, so the user isn't surprised
    // by losing partial input when switching focus accidentally.
    if (!title.trim() && !submitting) {
      reset()
    }
  }

  if (isEditing) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md border bg-background/80 px-2 py-1.5 shadow-sm transition-colors',
          accentBorderClass ?? 'border-primary/40',
        )}
      >
        {submitting ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={submitting}
          placeholder={t('projects.kanban.quickAdd.inputPlaceholder')}
          aria-label={t('projects.kanban.quickAdd.inputPlaceholder')}
          className="h-6 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        'group/quickadd flex w-full items-center gap-1.5 rounded-md border border-dashed border-transparent px-2 py-1.5 text-left text-xs text-muted-foreground/60 transition-all',
        // Visible-on-hover affordance: the parent column has `group` so we react
        // to column-level hover. We also react to focus for keyboard users.
        'group-hover/column:border-border/60 group-hover/column:text-muted-foreground hover:!border-primary/50 hover:!text-foreground hover:bg-muted/40 focus-visible:border-primary/50 focus-visible:text-foreground focus-visible:outline-none',
        prominent && 'border-border/40 text-muted-foreground',
      )}
      aria-label={t('projects.kanban.quickAdd.label')}
    >
      <Plus className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{t('projects.kanban.quickAdd.label')}</span>
    </button>
  )
}
