import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField } from '@/client/components/common/FormField'
import { getErrorMessage } from '@/client/lib/api'
import { cn } from '@/client/lib/utils'
import type { ProjectTag, TicketStatus } from '@/shared/types'

interface CreateTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableTags: ProjectTag[]
  onCreate: (input: {
    title: string
    description?: string
    status?: TicketStatus
    tagIds?: string[]
  }) => Promise<unknown>
}

export function CreateTicketModal({ open, onOpenChange, availableTags, onCreate }: CreateTicketModalProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setTitle('')
    setDescription('')
    setSelectedTagIds([])
    setError('')
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    )
  }

  async function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) return
    setError('')
    setSubmitting(true)
    try {
      await onCreate({
        title: trimmed,
        description: description.trim() || undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}
      title={t('projects.ticket.create.title')}
      description={t('projects.ticket.create.description')}
      size="2xl"
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitDisabled={!title.trim()}
      submitLabel={t('common.create')}
    >
      <FormField label={t('projects.ticket.create.titleField')} htmlFor="ticket-title" required>
        <Input
          id="ticket-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('projects.ticket.create.titlePlaceholder')}
          autoFocus
        />
      </FormField>

      <FormField label={t('projects.ticket.create.descriptionField')}>
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          height="240px"
        />
      </FormField>

      {availableTags.length > 0 && (
        <FormField label={t('projects.ticket.create.tagsField')}>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    selected
                      ? 'border-transparent'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                  )}
                  style={
                    selected
                      ? {
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          borderColor: `${tag.color}40`,
                        }
                      : undefined
                  }
                >
                  {tag.label}
                </button>
              )
            })}
          </div>
        </FormField>
      )}
    </FormDialog>
  )
}
