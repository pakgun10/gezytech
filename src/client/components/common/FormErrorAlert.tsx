import { Alert, AlertDescription } from '@/client/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/client/lib/utils'

interface FormErrorAlertProps {
  error: string | null | undefined
  className?: string
  animate?: boolean
}

/**
 * Shared error alert for form dialogs.
 * Renders nothing when `error` is falsy.
 */
export function FormErrorAlert({ error, className, animate = false }: FormErrorAlertProps) {
  if (!error) return null

  return (
    <Alert variant="destructive" className={cn(animate && 'animate-scale-in', className)}>
      <AlertCircle className="size-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}
