import { useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { useTheme } from 'next-themes'
import { cn } from '@/client/lib/utils'
import { buildThemeExtension } from '@/client/components/ui/codemirror-theme'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string
  readOnly?: boolean
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  height = '200px',
  readOnly = false,
  className,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
  ], [])

  const theme = useMemo(() => buildThemeExtension(isDark), [isDark])

  const handleChange = useCallback((val: string) => {
    onChange(val)
  }, [onChange])

  return (
    <div className={cn(
      'overflow-hidden rounded-md border border-input transition-[color,box-shadow]',
      '[&:has(.cm-focused)]:border-ring [&:has(.cm-focused)]:ring-[3px] [&:has(.cm-focused)]:ring-ring/50',
      className,
    )}>
      <CodeMirror
        value={value}
        onChange={handleChange}
        height={height}
        theme={theme}
        extensions={extensions}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: false,
          closeBrackets: false,
          autocompletion: false,
          crosshairCursor: false,
          rectangularSelection: false,
          highlightSelectionMatches: false,
          searchKeymap: false,
          lintKeymap: false,
          completionKeymap: false,
          foldKeymap: true,
        }}
      />
    </div>
  )
}
