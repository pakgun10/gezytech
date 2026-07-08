import { useTranslation } from 'react-i18next'
import { usePalette } from '@/client/components/theme-provider'
import { Button } from '@/client/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { Palette } from 'lucide-react'

export function PaletteToggle() {
  const { t } = useTranslation()
  const { palette, setPalette, palettes } = usePalette()

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('accessibility.paletteToggle')}>
              <Palette className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('accessibility.paletteToggle')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        {palettes.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setPalette(p.id)}
            className={palette === p.id ? 'bg-accent' : ''}
          >
            <div className="flex gap-0.5">
              {p.colors.map((c, i) => (
                <span
                  key={i}
                  className="size-3 rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="ml-1">{p.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
