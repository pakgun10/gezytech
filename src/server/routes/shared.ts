import { Hono } from 'hono'
import { downloadFile } from '@/server/services/file-storage'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:shared')

export const sharedRoutes = new Hono()

// GET /s/:token — download a shared file
sharedRoutes.get('/:token', async (c) => {
  const token = c.req.param('token')
  const result = await downloadFile(token)

  if ('error' in result) {
    return c.json(
      { error: { code: 'DOWNLOAD_ERROR', message: result.error } },
      result.status as 404 | 403 | 410 | 500,
    )
  }

  if (result.needsPassword) {
    return c.json(
      { error: { code: 'PASSWORD_REQUIRED', message: 'This file requires a password' } },
      401,
    )
  }

  const file = Bun.file(result.file.filePath)
  return new Response(file.stream(), {
    headers: {
      'Content-Type': result.file.mimeType,
      'Content-Length': String(result.file.size),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.file.originalName)}"`,
      'Cache-Control': 'no-store',
    },
  })
})

// POST /s/:token — download with password
sharedRoutes.post('/:token', async (c) => {
  const token = c.req.param('token')

  let password: string | undefined
  try {
    const body = await c.req.json() as { password?: string }
    password = body.password
  } catch {
    return c.json(
      { error: { code: 'INVALID_BODY', message: 'JSON body with "password" field required' } },
      400,
    )
  }

  if (!password) {
    return c.json(
      { error: { code: 'PASSWORD_REQUIRED', message: 'Password is required' } },
      400,
    )
  }

  const result = await downloadFile(token, password)

  if ('error' in result) {
    return c.json(
      { error: { code: 'DOWNLOAD_ERROR', message: result.error } },
      result.status as 404 | 403 | 410 | 500,
    )
  }

  const file = Bun.file(result.file.filePath)
  return new Response(file.stream(), {
    headers: {
      'Content-Type': result.file.mimeType,
      'Content-Length': String(result.file.size),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.file.originalName)}"`,
      'Cache-Control': 'no-store',
    },
  })
})
