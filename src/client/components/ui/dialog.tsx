"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useTranslation } from "react-i18next"

import { cn } from "@/client/lib/utils"
import { Button } from "@/client/components/ui/button"

/**
 * Layout variant shared from DialogContent down to DialogHeader/Body/Footer.
 *
 * - `default`: the legacy layout — DialogContent itself scrolls (`overflow-y-auto`,
 *   `p-6`) and header/body/footer flow inside it. Fine for short dialogs.
 * - `panel`: a structured 3-zone layout — fixed header (`border-b`), a single
 *   scrollable `DialogBody`, and a fixed footer (`border-t`). This is the
 *   correct shape for forms: the submit buttons never scroll away or sit on top
 *   of the scroll area, and they are clearly separated from the content. Prefer
 *   `FormDialog` (which wires this up for you) over assembling it by hand.
 */
type DialogVariant = "default" | "panel"

const DialogVariantContext = React.createContext<DialogVariant>("default")

/** Max-width presets for DialogContent (`sm:` and up; mobile stays near-full). */
export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "5xl": "sm:max-w-5xl",
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "default",
  size,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  variant?: DialogVariant
  /** Max-width preset. Defaults to `lg` (matches the legacy `sm:max-w-lg`). */
  size?: DialogSize
}) {
  const sizeClass = SIZE_CLASS[size ?? "lg"]
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogVariantContext.Provider value={variant}>
        <DialogPrimitive.Content
          data-slot="dialog-content"
          data-variant={variant}
          className={cn(
            // Shared positioning. Mobile-first: never wider than the viewport
            // minus a gutter, capped at 90vh tall. `sizeClass` widens on `sm:`+.
            "glass-strong data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-2xl shadow-xl outline-none duration-200",
            variant === "panel"
              // Structured: flex column, fixed max height, NO padding here (the
              // header/body/footer own their padding) and NO scroll here (only
              // DialogBody scrolls).
              ? "flex max-h-[min(90vh,46rem)] flex-col overflow-hidden"
              // Legacy: the content itself is the scroll container.
              : "grid max-h-[90vh] overflow-y-auto p-6",
            sizeClass,
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 z-10 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogVariantContext.Provider>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(DialogVariantContext)
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-left",
        // In panel mode the header is a fixed band with its own padding + divider.
        variant === "panel" && "shrink-0 border-b px-5 py-4 sm:px-6",
        className
      )}
      {...props}
    />
  )
}

/**
 * Scrollable middle region for `variant="panel"` dialogs. Everything that can
 * overflow goes here; the header and footer stay fixed. No-op styling outside
 * panel mode so it is safe to use anywhere.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(DialogVariantContext)
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        variant === "panel" && "min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const { t } = useTranslation()
  const variant = React.useContext(DialogVariantContext)
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // Mobile: buttons stack full-width (col-reverse keeps the primary on top).
        // sm+: inline, right-aligned.
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        // In panel mode the footer is a fixed band, divided from the scroll area.
        variant === "panel" && "shrink-0 border-t px-5 py-4 sm:px-6",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{t('common.close')}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
