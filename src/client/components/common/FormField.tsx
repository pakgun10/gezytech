import * as React from 'react'

import { cn } from '@/client/lib/utils'
import { Label } from '@/client/components/ui/label'
import { InfoTip } from '@/client/components/common/InfoTip'

export interface FormFieldProps {
  /** Field label. Omit for a control that is its own label. */
  label?: React.ReactNode
  /** `htmlFor` on the label — pass the control's `id` for accessibility. */
  htmlFor?: string
  /** Optional help icon + tooltip rendered next to the label. */
  tip?: string
  /** Secondary helper text shown under the control. */
  hint?: React.ReactNode
  /** Per-field error shown under the control (red). */
  error?: React.ReactNode
  /** Marks the field as required (adds a subtle asterisk). */
  required?: boolean
  className?: string
  /** The control (Input, Select, Textarea, …). Already full-width by default. */
  children: React.ReactNode
}

/**
 * Consistent label + control + hint/error stack for form rows.
 *
 * Controls (Input, SelectTrigger, Textarea) are full-width by default, so a lone
 * field fills its line. For multiple controls on one row, wrap several FormFields
 * in a `grid grid-cols-2 gap-3` (or use `FormRow`).
 */
export function FormField({
  label,
  htmlFor,
  tip,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label != null && (
        <Label htmlFor={htmlFor} className="inline-flex items-center gap-1.5">
          {label}
          {required && <span className="text-destructive">*</span>}
          {tip && <InfoTip content={tip} />}
        </Label>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/**
 * Row of fields that sit side-by-side on `sm`+ and stack on mobile. Use for
 * naturally-paired short fields (first/last name, etc.). A single field should
 * NOT use this — let it be full-width.
 */
export function FormRow({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {children}
    </div>
  )
}
