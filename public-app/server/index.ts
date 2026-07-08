import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'gezytech-public' }))

const port = Number(process.env.PORT) || 3002
console.log(`[gezytech-public] Server started on port ${port}`)

serve({ fetch: app.fetch, port })
