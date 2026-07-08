import { z } from 'zod'
import { tool } from '@/server/tools/tool-helper'
import { createLogger } from '@/server/logger'
import { createFileFromContent } from '@/server/services/file-storage'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:xlsx')

/**
 * Build an xlsx workbook from array-of-arrays data.
 * Returns the workbook as a base64-encoded string.
 */
async function buildXlsxBase64(
  sheets: Array<{ name: string; rows: string[][] }>,
): Promise<string> {
  const { Workbook } = await import('exceljs')

  const wb = new Workbook()
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name || 'Sheet1')
    for (const row of sheet.rows) {
      ws.addRow(row)
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return (buffer as Buffer).toString('base64')
}

/**
 * generate_xlsx — create an Excel spreadsheet from tabular data.
 *
 * Uses exceljs (already installed for `read_file` xlsx parsing) to
 * generate .xlsx files server-side. Returns a shareable URL.
 */
export const generateXlsxTool: ToolRegistration = {
  availability: ['main'],
  create: () =>
    tool({
      description:
        'Create an Excel (.xlsx) spreadsheet from tabular data and get a shareable URL. ' +
        'Provide `sheets` as an array of { name: string, rows: string[][] }. ' +
        'Each row is an array of cell values. The first row is typically the header. ' +
        'Use this when you need to give the user structured data in spreadsheet format.',
      inputSchema: z.object({
        sheets: z
          .array(
            z.object({
              name: z.string().describe('Sheet name (e.g. "Employees", "Summary").'),
              rows: z
                .array(z.array(z.string()))
                .describe('Array of rows. Each row is an array of cell values (strings). First row = header.'),
            }),
          )
          .describe('Array of sheets in the workbook.'),
        filename: z
          .string()
          .optional()
          .describe('File name without extension. Defaults to "spreadsheet".'),
      }),
      execute: async ({ sheets, filename }, ctx) => {
        try {
          const base64 = await buildXlsxBase64(sheets)
          const name = filename || 'spreadsheet'

          const file = await createFileFromContent(ctx.agentId, name, base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', {
            isBase64: true,
            description: `XLSX spreadsheet (${sheets.length} sheet(s))`,
            createdByAgentId: ctx.agentId,
          })

          log.info({ agentId: ctx.agentId, fileName: file.name, sheets: sheets.length }, 'XLSX generated')

          return {
            success: true,
            url: file.url,
            name: file.name,
            sheetCount: sheets.length,
            totalRows: sheets.reduce((sum, s) => sum + s.rows.length, 0),
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          log.error({ agentId: ctx.agentId, err: msg }, 'Failed to generate XLSX')
          return {
            success: false,
            error: `Failed to generate XLSX: ${msg}`,
          }
        }
      },
    }),
}
