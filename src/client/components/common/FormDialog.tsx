import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { type VariantProps } from 'class-variance-authority'

import { cn } from '@/client/lib/utils'
import { Button, buttonVariants } from '@/client/components/ui/button'
import { FormErrorAlert } from '@/client/components/common/FormErrorAlert'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from '@/client/components/ui/dialog'

type ButtonVariant = VariantProps<typeof buttonVariants>['variant']

export interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  /** Body content (form fields). Rendered inside the scrollable region. */
  children: React.ReactNode

  /** Max-width preset (responsive; mobile stays near-full). Default `lg`. */
  size?: DialogSize
  /** Error message shown as an alert at the top of the body. */
  error?: string | null

  /**
   * Submit handler. Wired to the form's `onSubmit` so Enter submits, and to the
   * primary footer button. Omit to render a non-form dialog (e.g. read-only).
   */
  onSubmit?: () => void | Promise<void>
  isSubmitting?: boolean
  submitDisabled?: boolean
  submitLabel?: React.ReactNode
  submitVariant?: ButtonVariant
  cancelLabel?: React.ReactNode

  /** Replace the entire footer (cancel + submit) with custom content. */
  footer?: React.ReactNode
  /** Hide the footer entirely. */
  hideFooter?: boolean

  className?: string
  bodyClassName?: string
  showCloseButton?: boolean
}

/**
 * Standard form modal: a fixed header, a single scrollable body, and a fixed,
 * divided footer whose submit/cancel buttons never scroll away or overlap the
 * content. Responsive down to ~360px (near-full width on phones, buttons stack
 * full-width). Use this for any create/edit form instead of hand-assembling
 * Dialog + DialogContent + DialogFooter — it is the source of consistency.
 *
 * For dialogs with bespoke layouts (tabs, multi-column, custom footers), use the
 * lower-level `DialogContent variant="panel"` + `DialogBody` primitives directly.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'lg',
  error,
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  submitLabel,
  submitVariant = 'default',
  cancelLabel,
  footer,
  hideFooter = false,
  className,
  bodyClassName,
  showCloseButton = true,
}: FormDialogProps) {
  const { t } = useTranslation()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || submitDisabled) return
    onSubmit?.()
  }

  const Wrapper = onSubmit ? 'form' : 'div'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="panel"
        size={size}
        showCloseButton={showCloseButton}
        className={className}
      >
        <Wrapper
          {...(onSubmit ? { onSubmit: handleSubmit } : {})}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                {typeof title === 'string' ? title : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          <DialogBody className={cn('space-y-4', bodyClassName)}>
            <FormErrorAlert error={error} />
            {children}
          </DialogBody>

          {!hideFooter &&
            (footer !== undefined ? (
              <DialogFooter>{footer}</DialogFooter>
            ) : (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  {cancelLabel ?? t('common.cancel')}
                </Button>
                {onSubmit && (
                  <Button
                    type="submit"
                    variant={submitVariant}
                    disabled={isSubmitting || submitDisabled}
                    className="btn-shine"
                  >
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    {submitLabel ?? t('common.save')}
                  </Button>
                )}
              </DialogFooter>
            ))}
        </Wrapper>
      </DialogContent>
    </Dialog>
  )
}
