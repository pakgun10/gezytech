import { Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'

interface ChannelPublicUrlFieldProps {
  /** Browser-facing URL where visitors open this Agent web chat. */
  url: string
}

export function ChannelPublicUrlField({ url }: ChannelPublicUrlFieldProps) {
  const { copy, copied } = useCopyToClipboard()

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Public web chat URL
      </p>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-foreground/90">
          {url}
        </code>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Copy"
          onClick={() => void copy(url)}
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Open web chat" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Share this URL with visitors who should chat with the selected Agent.
      </p>
    </div>
  )
}
