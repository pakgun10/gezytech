import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu'
import { Sun, Moon, Monitor, Contrast } from 'lucide-react'
import { usePalette } from '@/client/components/theme-provider'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { contrastMode, setContrastMode } = usePalette()

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('accessibility.themeToggle')}>
              {resolvedTheme === 'dark' ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('accessibility.themeToggle')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-accent' : ''}>
          <Sun className="size-4" />
          {t('onboarding.preferences.themeModeLight')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-accent' : ''}>
          <Moon className="size-4" />
          {t('onboarding.preferences.themeModeDark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className={theme === 'system' ? 'bg-accent' : ''}>
          <Monitor className="size-4" />
          {t('onboarding.preferences.themeModeSystem')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setContrastMode(contrastMode === 'soft' ? 'normal' : 'soft')}
          className={contrastMode === 'soft' ? 'bg-accent' : ''}
        >
          <Contrast className="size-4" />
          {t('theme.reduceContrast', 'Reduce contrast')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
