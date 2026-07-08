import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Switch } from '@/client/components/ui/switch'
import { CodeEditor } from '@/client/components/ui/code-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'

/** A single JSON-Schema property definition (only the bits we render from). */
interface SchemaProperty {
  type?: string | string[]
  description?: string
  enum?: unknown[]
  items?: { type?: string | string[] }
  format?: string
  default?: unknown
  // Anything else (oneOf/anyOf/nested object shape…) is tolerated and falls
  // back to a per-field JSON editor.
  [key: string]: unknown
}

interface SchemaArgsFormProps {
  /** The PARSED JSON Schema (null when the schema text is invalid JSON). */
  schema: Record<string, unknown> | null
  /** Canonical args object. */
  value: Record<string, unknown>
  /** Produce a NEW merged value object (never mutates `value`). */
  onChange: (next: Record<string, unknown>) => void
  /**
   * Per-parameter UI translations for the user's current locale. When a label
   * is present it becomes the primary field label (the raw key is shown beside
   * it in muted); a description here overrides the schema description for the
   * helper text and placeholders.
   */
  paramTranslations?: Record<string, { label?: string; description?: string }>
}

/** Resolve the primary type of a property (first entry if it's a union array). */
function primaryType(prop: SchemaProperty): string | undefined {
  if (Array.isArray(prop.type)) return prop.type.find((t) => t !== 'null') ?? prop.type[0]
  return prop.type
}

/** Does this property need a per-field raw-JSON editor (complex / exotic shape)? */
function needsJsonEditor(prop: SchemaProperty): boolean {
  if (prop.oneOf || prop.anyOf || prop.allOf) return true
  const type = primaryType(prop)
  if (type === 'object') return true
  if (type === 'array') {
    // Arrays of strings get the comma-separated <Input>; everything else → JSON.
    const itemType = prop.items && primaryType({ type: prop.items.type })
    return itemType !== 'string'
  }
  if (!type) return true // unknown / untyped → JSON
  return false
}

export function SchemaArgsForm({ schema, value, onChange, paramTranslations }: SchemaArgsFormProps) {
  const { t } = useTranslation()

  const properties =
    schema && typeof schema.properties === 'object' && schema.properties
      ? (schema.properties as Record<string, SchemaProperty>)
      : null
  const required = Array.isArray(schema?.required) ? (schema.required as string[]) : []

  if (!properties || Object.keys(properties).length === 0) {
    return <p className="text-xs text-muted-foreground">{t('customTools.test.noParameters')}</p>
  }

  /** Set (or remove) a single key, always producing a fresh object. */
  function setField(key: string, next: unknown) {
    const merged = { ...value }
    if (next === undefined) delete merged[key]
    else merged[key] = next
    onChange(merged)
  }

  return (
    <div className="min-w-0 space-y-3">
      {Object.entries(properties).map(([key, prop]) => {
        const isRequired = required.includes(key)
        const type = primaryType(prop)
        const current = value[key]

        // Translated label (falls back to the raw key). When a real translation
        // exists and differs from the key, the key is shown beside it in muted.
        const tr = paramTranslations?.[key]
        const translatedLabel = tr?.label || key
        const showKeyBeside = !!tr?.label && tr.label !== key
        // Translated description wins, then the schema description; used for the
        // helper text AND the input placeholders.
        const fieldDescription = tr?.description || prop.description

        const labelNode = (
          <Label htmlFor={`ct-arg-${key}`} className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate">
              {translatedLabel}
              {showKeyBeside ? (
                <span className="ml-1 font-normal text-muted-foreground">{key}</span>
              ) : null}
            </span>
            {isRequired ? (
              <span className="shrink-0 text-destructive" aria-hidden>*</span>
            ) : null}
            {isRequired ? <span className="sr-only">{t('customTools.test.required')}</span> : null}
          </Label>
        )

        const helper = fieldDescription ? (
          <p className="text-xs text-muted-foreground break-words">{fieldDescription}</p>
        ) : null

        // boolean → Switch
        if (type === 'boolean') {
          const checked = current === undefined ? prop.default === true : current === true
          return (
            <div key={key} className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 items-center justify-between gap-3">
                {labelNode}
                <Switch
                  id={`ct-arg-${key}`}
                  className="shrink-0"
                  checked={checked}
                  onCheckedChange={(c) => setField(key, c)}
                />
              </div>
              {helper}
            </div>
          )
        }

        // string + enum → Select
        if ((type === 'string' || type === undefined) && Array.isArray(prop.enum) && prop.enum.length > 0) {
          const options = prop.enum.map((v) => String(v))
          const selected = current === undefined ? undefined : String(current)
          return (
            <div key={key} className="min-w-0 space-y-1.5">
              {labelNode}
              <Select
                value={selected}
                onValueChange={(v) => setField(key, v)}
              >
                <SelectTrigger id={`ct-arg-${key}`} className="w-full min-w-0">
                  <SelectValue placeholder={fieldDescription ?? key} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {helper}
            </div>
          )
        }

        // number | integer → number input
        if (type === 'number' || type === 'integer') {
          const display = current === undefined || current === null ? '' : String(current)
          return (
            <div key={key} className="min-w-0 space-y-1.5">
              {labelNode}
              <Input
                id={`ct-arg-${key}`}
                className="min-w-0"
                type="number"
                step={type === 'integer' ? 1 : 'any'}
                value={display}
                placeholder={fieldDescription ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setField(key, undefined)
                    return
                  }
                  const num = type === 'integer' ? parseInt(raw, 10) : Number(raw)
                  setField(key, Number.isNaN(num) ? raw : num)
                }}
              />
              {helper}
            </div>
          )
        }

        // array of strings → comma/newline-separated input
        if (type === 'array' && !needsJsonEditor(prop)) {
          const arr = Array.isArray(current) ? (current as unknown[]) : []
          const display = arr.map((v) => String(v)).join(', ')
          return (
            <div key={key} className="min-w-0 space-y-1.5">
              {labelNode}
              <Input
                id={`ct-arg-${key}`}
                className="min-w-0"
                value={display}
                placeholder={fieldDescription ?? ''}
                onChange={(e) => {
                  const parts = e.target.value
                    .split(/[\n,]/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                  setField(key, parts.length > 0 ? parts : undefined)
                }}
              />
              <p className="text-xs text-muted-foreground">{t('customTools.test.commaSeparated')}</p>
              {helper}
            </div>
          )
        }

        // object / array-of-objects / oneOf / anyOf / unknown → per-field JSON editor
        if (needsJsonEditor(prop)) {
          const display =
            current === undefined ? '' : JSON.stringify(current, null, 2)
          return (
            <div key={key} className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                {labelNode}
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t('customTools.test.jsonField')}
                </span>
              </div>
              <CodeEditor
                value={display}
                onChange={(v) => {
                  if (v.trim() === '') {
                    setField(key, undefined)
                    return
                  }
                  try {
                    setField(key, JSON.parse(v))
                  } catch {
                    // Hold the raw text so the user can finish editing; it won't
                    // be coerced until valid. Store the string as-is so the value
                    // round-trips, but flag it as invalid via the helper note.
                    setField(key, v)
                  }
                }}
                language="json"
                height="80px"
                className="min-w-0"
              />
              {helper}
            </div>
          )
        }

        // string (no enum) → text input
        const display = current === undefined || current === null ? '' : String(current)
        return (
          <div key={key} className="min-w-0 space-y-1.5">
            {labelNode}
            <Input
              id={`ct-arg-${key}`}
              className="min-w-0"
              value={display}
              placeholder={prop.description ?? ''}
              onChange={(e) => setField(key, e.target.value === '' ? undefined : e.target.value)}
            />
            {helper}
          </div>
        )
      })}
    </div>
  )
}
