import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/client/components/ui/radio-group'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField } from '@/client/components/common/FormField'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/client/components/ui/command'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { api, toastError, getErrorMessage } from '@/client/lib/api'
import type { ChannelPendingUser, ChannelPlatform } from '@/shared/types'

interface ContactOption {
  id: string
  displayName: string
}

interface ApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingUser: ChannelPendingUser | null
  channelId: string
  platform: ChannelPlatform
  onApproved: () => void
}

export function ApprovalDialog({
  open,
  onOpenChange,
  pendingUser,
  channelId,
  platform,
  onApproved,
}: ApprovalDialogProps) {
  const { t } = useTranslation()

  const [action, setAction] = useState<'create' | 'link'>('create')
  const [contactName, setContactName] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reset state when dialog opens with a new user
  useEffect(() => {
    if (open && pendingUser) {
      setAction('create')
      setContactName(pendingUser.platformDisplayName ?? pendingUser.platformUsername ?? '')
      setSelectedContactId(null)
      setError('')
    }
  }, [open, pendingUser])

  // Fetch contacts when switching to link mode
  useEffect(() => {
    if (action === 'link' && contacts.length === 0) {
      setLoadingContacts(true)
      api
        .get<{ contacts: ContactOption[] }>('/contacts')
        .then((data) => {
          setContacts(data.contacts.map((c) => ({ id: c.id, displayName: c.displayName })))
        })
        .catch(() => {})
        .finally(() => setLoadingContacts(false))
    }
  }, [action, contacts.length])

  const displayName = pendingUser?.platformDisplayName ?? pendingUser?.platformUsername ?? pendingUser?.platformUserId ?? ''

  const handleSubmit = async () => {
    if (!pendingUser) return

    setError('')
    setSubmitting(true)
    try {
      const body =
        action === 'create'
          ? { action: 'create' as const, name: contactName.trim() || undefined }
          : { action: 'link' as const, contactId: selectedContactId! }

      await api.post(`/channels/${channelId}/user-mappings/${pendingUser.id}/approve`, body)
      toast.success(t('settings.channels.userApproved'))
      onOpenChange(false)
      onApproved()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      toastError(err)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = action === 'create' || (action === 'link' && !!selectedContactId)

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('settings.channels.approve.title')}
      description={t('settings.channels.approve.description', { name: displayName, platform })}
      size="md"
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitDisabled={!canSubmit}
      submitLabel={t('settings.channels.approve.approve')}
    >
      {/* User info summary */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
        <PlatformIcon platform={platform} variant="color" className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          {pendingUser?.platformUsername && pendingUser.platformDisplayName && (
            <p className="text-[11px] text-muted-foreground truncate">@{pendingUser.platformUsername}</p>
          )}
          <p className="text-[11px] text-muted-foreground truncate">ID: {pendingUser?.platformUserId}</p>
        </div>
      </div>

      {/* Action selection */}
      <RadioGroup value={action} onValueChange={(v) => setAction(v as 'create' | 'link')} className="gap-3">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="create" id="action-create" />
          <Label htmlFor="action-create" className="cursor-pointer text-sm">
            {t('settings.channels.approve.createContact')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="link" id="action-link" />
          <Label htmlFor="action-link" className="cursor-pointer text-sm">
            {t('settings.channels.approve.linkContact')}
          </Label>
        </div>
      </RadioGroup>

      {/* Create mode: contact name input */}
      {action === 'create' && (
        <FormField label={t('settings.channels.approve.contactName')} htmlFor="contact-name">
          <Input
            id="contact-name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder={displayName}
          />
        </FormField>
      )}

      {/* Link mode: contact picker */}
      {action === 'link' && (
        <FormField label={t('settings.channels.approve.selectContact')}>
          {loadingContacts ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Command className="rounded-lg border">
              <CommandInput placeholder={t('settings.channels.approve.searchContacts')} />
              <CommandList className="max-h-40">
                <CommandEmpty>{t('settings.channels.approve.noContacts')}</CommandEmpty>
                <CommandGroup>
                  {contacts.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.displayName}
                      onSelect={() => setSelectedContactId(c.id)}
                      className="cursor-pointer"
                    >
                      <span className="flex-1 truncate">{c.displayName}</span>
                      {selectedContactId === c.id && (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </FormField>
      )}
    </FormDialog>
  )
}
