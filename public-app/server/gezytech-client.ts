/**
 * gezytech-client — komunikasi dengan gezytech API.
 *
 * Untuk MVP lokal: stub yang return mock SSE response.
 * Nanti setelah PUB-20 (service token middleware di gezytech),
 * ganti `sendChatMessage` dengan HTTP call sesungguhnya ke
 * `http://localhost:3000/api/service/chat`.
 */

const GEZYTECH_URL = process.env.GEZYTECH_API_URL ?? 'http://localhost:3000'
const SERVICE_TOKEN = process.env.GEZYTECH_SERVICE_TOKEN ?? 'dev-token'

export interface ChatResponse {
  inputTokens: number
  outputTokens: number
  content: string
  finishReason: string
}

/**
 * Kirim pesan ke agent via gezytech API.
 * Return AsyncGenerator yang yield SSE events: { type, data }
 */
export async function* sendChatMessage(
  agentSlug: string,
  message: string,
): AsyncGenerator<{ type: 'text' | 'tool_call' | 'token' | 'done' | 'error'; data?: any }> {
  // TODO: ganti dengan HTTP POST ke GEZYTECH_URL/api/service/chat
  // dengan header X-Service-Token + body { agentSlug, message }

  // ─── Stub (MVP) ───
  yield { type: 'text', data: `Halo! Saya adalah agent **${agentSlug}**. ` }

  yield { type: 'text', data: `Kamu bilang: "${message}"\n\n` }

  yield {
    type: 'text',
    data: '*(Ini adalah respons stub. PUB-20 (service token middleware di gezytech) belum diimplementasikan. Nanti setelah jadi, chat ini akan terhubung ke gezytech beneran.)*',
  }

  yield { type: 'token', data: { inputTokens: 42, outputTokens: 128 } }
  yield { type: 'done' }
}
