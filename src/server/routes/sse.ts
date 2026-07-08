import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { v4 as uuid } from 'uuid'
import { sseManager } from '@/server/sse/index'
import type { AppVariables } from '@/server/app'

const sseRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/sse — global SSE connection (one per client)
sseRoutes.get('/', (c) => {
  const user = c.get('user') as { id: string }

  return streamSSE(c, async (stream) => {
    const connectionId = uuid()

    // Serialise writes so rapid-fire events (e.g. chat:token during LLM
    // streaming) don't interleave in the SSE byte stream.  Each writeSSE()
    // call waits for the previous one to complete before starting.
    let writeQueue = Promise.resolve()

    sseManager.addConnection(connectionId, {
      write: (data: string) => {
        writeQueue = writeQueue.then(() =>
          stream.writeSSE({ data, event: 'message' }).catch(() => {
            // stream might be closed
          }),
        )
      },
      close: () => {
        stream.close()
      },
      userId: user.id,
    })

    // Send connected event
    await stream.writeSSE({
      data: JSON.stringify({ type: 'connected', connectionId }),
      event: 'connected',
    })

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      stream.writeSSE({
        data: JSON.stringify({ type: 'ping', timestamp: Date.now() }),
        event: 'ping',
      }).catch(() => {
        clearInterval(pingInterval)
      })
    }, 15000)

    // Wait for disconnect
    stream.onAbort(() => {
      clearInterval(pingInterval)
      sseManager.removeConnection(connectionId)
    })

    // Keep stream alive
    await new Promise(() => {
      // Never resolves — stream stays open until client disconnects
    })
  })
})

export { sseRoutes }
