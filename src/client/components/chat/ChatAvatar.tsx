import { useState, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/client/components/ui/dialog'
import { cn } from '@/client/lib/utils'

interface ChatAvatarProps {
  avatarUrl?: string | null
  name?: string
  fallbackClassName?: string
  fallbackIcon?: React.ReactNode
  className?: string
}

export function ChatAvatar({ avatarUrl, name, fallbackClassName, fallbackIcon, className }: ChatAvatarProps) {
  const [showPreview, setShowPreview] = useState(false)
  const initials = name?.slice(0, 2).toUpperCase() ?? 'U'

  const handleClick = useCallback(() => {
    if (avatarUrl) setShowPreview(true)
  }, [avatarUrl])

  return (
    <>
      <Avatar
        className={cn('size-10 shrink-0', avatarUrl && 'cursor-pointer hover:opacity-80 transition-opacity', className)}
        onClick={handleClick}
      >
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={name ?? ''} />
        ) : (
          <AvatarFallback className={fallbackClassName ?? 'text-sm'}>{fallbackIcon ?? initials}</AvatarFallback>
        )}
      </Avatar>

      {showPreview && avatarUrl && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowPreview(false) }}>
          <DialogContent className="max-w-sm p-4" showCloseButton={false}>
            <DialogTitle className="sr-only">{name ?? ''}</DialogTitle>
            <DialogDescription className="sr-only">{name ?? ''}</DialogDescription>
            <div className="flex flex-col items-center gap-3">
              <img
                src={avatarUrl}
                alt={name ?? ''}
                className="size-64 rounded-full object-cover"
              />
              {name && (
                <p className="text-sm font-medium text-foreground">{name}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
