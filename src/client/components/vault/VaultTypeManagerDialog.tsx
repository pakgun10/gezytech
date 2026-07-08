import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { FormErrorAlert } from '@/client/components/common/FormErrorAlert'
import { FormField, FormRow } from '@/client/components/common/FormField'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { api, getErrorMessage, toastError } from '@/client/lib/api'
import type { VaultTypeSummary, VaultTypeField, VaultFieldType } from '@/shared/types'

interface VaultTypeManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customTypes: VaultTypeSummary[]
  onTypesChanged: () => void
}

const FIELD_TYPE_VALUES: VaultFieldType[] = [
  'text', 'password', 'textarea', 'url', 'email', 'phone', 'date', 'number',
]

const FIELD_TYPE_KEYS: Record<VaultFieldType, string> = {
  text: 'settings.vault.fieldTypeText',
  password: 'settings.vault.fieldTypePassword',
  textarea: 'settings.vault.fieldTypeTextarea',
  url: 'settings.vault.fieldTypeUrl',
  email: 'settings.vault.fieldTypeEmail',
  phone: 'settings.vault.fieldTypePhone',
  date: 'settings.vault.fieldTypeDate',
  number: 'settings.vault.fieldTypeNumber',
}

export function VaultTypeManagerDialog({
  open,
  onOpenChange,
  customTypes,
  onTypesChanged,
}: VaultTypeManagerDialogProps) {
  const { t } = useTranslation()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Create form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [icon, setIcon] = useState('')
  const [fields, setFields] = useState<VaultTypeField[]>([
    { name: '', label: '', type: 'text' },
  ])

  const resetForm = () => {
    setName('')
    setSlug('')
    setIcon('')
    setFields([{ name: '', label: '', type: 'text' }])
    setError('')
    setShowCreateForm(false)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const addField = () => {
    setFields((prev) => [...prev, { name: '', label: '', type: 'text' }])
  }

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  const updateField = (index: number, updates: Partial<VaultTypeField>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    )
  }

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-generate slug from name
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value))
    }
  }

  const handleCreate = async () => {
    setError('')

    // Validate
    const validFields = fields.filter((f) => f.name.trim() && f.label.trim())
    if (!name.trim() || !slug.trim() || validFields.length === 0) {
      setError(t('settings.vault.typeFormIncomplete'))
      return
    }

    setIsSaving(true)
    try {
      await api.post('/vault/types', {
        name: name.trim(),
        slug: slug.trim(),
        ...(icon.trim() ? { icon: icon.trim() } : {}),
        fields: validFields,
      })
      onTypesChanged()
      resetForm()
      toast.success(t('settings.vault.typeCreated'))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteType = async (typeId: string) => {
    try {
      await api.delete(`/vault/types/${typeId}`)
      onTypesChanged()
      toast.success(t('settings.vault.typeDeleted'))
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent variant="panel" size="lg">
        <DialogHeader>
          <DialogTitle>{t('settings.vault.manageTypes')}</DialogTitle>
          <DialogDescription>
            {t('settings.vault.manageTypesDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Existing custom types */}
          {customTypes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('settings.vault.customTypes')}
              </Label>
              {customTypes.map((ct) => (
                <div key={ct.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{ct.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ct.fields.length} {t('settings.vault.fields')} &middot; {ct.slug}
                    </p>
                  </div>
                  <ConfirmDeleteButton
                    onConfirm={() => handleDeleteType(ct.id)}
                    description={t('settings.vault.deleteTypeConfirm')}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Create new type form */}
          {showCreateForm ? (
            <div className="space-y-3 rounded-lg border p-3">
              <FormErrorAlert error={error} />

              <FormRow>
                <FormField label={t('settings.vault.typeName')} htmlFor="vault-type-name">
                  <Input
                    id="vault-type-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={t('settings.vault.typeNamePlaceholder')}
                  />
                </FormField>
                <FormField label={t('settings.vault.typeSlug')} htmlFor="vault-type-slug">
                  <Input
                    id="vault-type-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder={t('settings.vault.typeSlugPlaceholder')}
                    className="font-mono"
                  />
                </FormField>
              </FormRow>

              <FormField
                label={
                  <>
                    {t('settings.vault.typeIcon')}
                    <span className="ml-1 text-muted-foreground">({t('common.optional')})</span>
                  </>
                }
                htmlFor="vault-type-icon"
              >
                <Input
                  id="vault-type-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder={t('settings.vault.typeIconPlaceholder')}
                />
              </FormField>

              {/* Fields builder */}
              <FormField label={t('settings.vault.typeFields')}>
                <div className="space-y-2">
                  {fields.map((field, i) => (
                    <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={field.name}
                        onChange={(e) => updateField(i, { name: e.target.value })}
                        placeholder={t('settings.vault.fieldNamePlaceholder')}
                        className="h-8 text-xs font-mono flex-1"
                      />
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        placeholder={t('settings.vault.fieldLabelPlaceholder')}
                        className="h-8 text-xs flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <Select
                          value={field.type}
                          onValueChange={(v) => updateField(i, { type: v as VaultFieldType })}
                        >
                          <SelectTrigger className="h-8 text-xs w-full sm:w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPE_VALUES.map((ft) => (
                              <SelectItem key={ft} value={ft}>
                                {t(FIELD_TYPE_KEYS[ft])}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeField(i)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addField} className="w-full mt-1">
                  <Plus className="size-3" />
                  {t('settings.vault.addField')}
                </Button>
              </FormField>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={resetForm}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="btn-shine"
                >
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : t('settings.vault.createType')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowCreateForm(true)} className="w-full">
              <Plus className="size-4" />
              {t('settings.vault.createType')}
            </Button>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
