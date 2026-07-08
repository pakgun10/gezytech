import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Progress } from '@/client/components/ui/progress'
import { RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { TestAllState } from '@/client/hooks/useProviderActions'

interface TestAllProvidersProps {
  testAllState: TestAllState | null
  onTestAll: () => void
}

export function TestAllProviders({ testAllState, onTestAll }: TestAllProvidersProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onTestAll}
        disabled={testAllState?.running}
        className="w-full"
      >
        {testAllState?.running ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            {t('settings.providers.testAllRunning', { tested: testAllState.tested, total: testAllState.total })}
          </>
        ) : (
          <>
            <RefreshCw className="size-3.5" />
            {t('settings.providers.testAll')}
          </>
        )}
      </Button>
      {testAllState && (
        <div className="space-y-1.5 animate-fade-in">
          <Progress
            value={(testAllState.tested / testAllState.total) * 100}
            variant={testAllState.running ? 'default' : 'gradient'}
            className="h-1.5"
          />
          {!testAllState.running && (
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                {[...testAllState.results.values()].filter(Boolean).length} {t('settings.providers.testAllPassed')}
              </span>
              {[...testAllState.results.values()].filter((v) => !v).length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="size-3" />
                  {[...testAllState.results.values()].filter((v) => !v).length} {t('settings.providers.testAllFailed')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
