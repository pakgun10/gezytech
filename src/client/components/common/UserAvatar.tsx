import { useState, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/client/components/ui/dialog'
import { cn, getUserInitials } from '@/client/lib/utils'

interface UserAvatarUser {
  pseudonym?: string | null
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}

interface UserAvatarProps {
  user: UserAvatarUser
  className?: string
  fallbackClassName?: string
  showPreview?: boolean
}

export function UserAvatar({ user, className, fallbackClassName, showPreview = false }: UserAvatarProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const initials = getUserInitials(user)
  const displayName = user.pseudonym ?? [user.firstName, user.lastName].filter(Boolean).join(' ') ?? ''

  const handleClick = useCallback(() => {
    if (showPreview && user.avatarUrl) setPreviewOpen(true)
  }, [showPreview, user.avatarUrl])

  return (
    <>
      <Avatar
        className={cn(
          'shrink-0',
          showPreview && user.avatarUrl && 'cursor-pointer hover:opacity-80 transition-opacity',
          className,
        )}
        onClick={handleClick}
      >
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={displayName} />
        ) : (
          <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
        )}
      </Avatar>

      {previewOpen && user.avatarUrl && (
        <Dialog open onOpenChange={(open) => { if (!open) setPreviewOpen(false) }}>
          <DialogContent className="max-w-sm p-4" showCloseButton={false}>
            <DialogTitle className="sr-only">{displayName}</DialogTitle>
            <DialogDescription className="sr-only">{displayName}</DialogDescription>
            <div className="flex flex-col items-center gap-3">
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="size-64 rounded-full object-cover"
              />
              {displayName && (
                <p className="text-sm font-medium text-foreground">{displayName}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
