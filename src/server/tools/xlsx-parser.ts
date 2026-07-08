/**
 * Parse .xlsx files (Excel 2007+ / OOXML spreadsheet) into tab-separated text.
 *
 * `.xlsx` files are ZIP archives containing SpreadsheetML XML. The `read_file`
 * tool detects them as binary (null bytes in the ZIP header) and delegates here
 * instead of rejecting them as "binary file — use run_shell".
 *
 * Uses `exceljs` (lazy-loaded only when an .xlsx is actually read) to handle
 * shared strings, formula results, dates, and rich-text cells.
 */

export interface XlsxSheetInfo {
  name: string
  rows: number
  cols: number
}

export interface XlsxParseResult {
  text: string
  sheets: XlsxSheetInfo[]
}

/**
 * Convert an .xlsx buffer into readable TSV text, one section per worksheet.
 *
 * Output format per sheet:
 *   === Sheet: <name> (<rows> rows × <cols> cols) ===
 *   val\tval\tval
 *   ...
 */
export async function parseXlsxToText(buffer: Buffer): Promise<XlsxParseResult> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  const sheets: XlsxSheetInfo[] = []
  const sections: string[] = []

  wb.eachSheet((ws) => {
    const rowCount = ws.rowCount
    const colCount = ws.columnCount
    sheets.push({ name: ws.name, rows: rowCount, cols: colCount })

    const lines: string[] = []
    lines.push(`=== Sheet: ${ws.name} (${rowCount} rows × ${colCount} cols) ===`)

    ws.eachRow({ includeEmpty: true }, (row) => {
      const vals: string[] = []
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c)
        const v = cell.value
        if (v === null || v === undefined) {
          vals.push('')
        } else if (typeof v === 'object') {
          if (v instanceof Date) {
            vals.push(v.toISOString())
          } else if ('richText' in v && Array.isArray((v as any).richText)) {
            vals.push((v as any).richText.map((r: any) => r.text ?? '').join(''))
          } else if ('result' in v) {
            const r = (v as any).result
            vals.push(r !== null && r !== undefined ? String(r) : '')
          } else if ('text' in v) {
            vals.push(String((v as any).text ?? ''))
          } else {
            vals.push(String(v))
          }
        } else {
          vals.push(String(v))
        }
      }
      lines.push(vals.join('\t'))
    })

    sections.push(lines.join('\n'))
  })

  return { text: sections.join('\n\n'), sheets }
}
