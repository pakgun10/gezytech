/**
 * gezytech-client — komunikasi dengan gezytech API.
 *
 * Menggunakan service token auth (PUB-20) untuk bypass user session.
 * Mengirim pesan ke agent via POST /api/agents/{slug}/messages,
 * lalu polling GET /api/agents/{slug}/messages untuk respons agent.
 */

const GEZYTECH_URL = process.env.GEZYTECH_API_URL ?? "http://localhost:3000";
const SERVICE_TOKEN = process.env.GEZYTECH_SERVICE_TOKEN ?? "dev-token-shared";
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_TIME_MS = 120_000;

async function gezytechApi(path: string, options?: RequestInit) {
  const res = await fetch(`${GEZYTECH_URL}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      "x-service-token": SERVICE_TOKEN,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gezytech API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

export async function* sendChatMessage(
  agentSlug: string,
  message: string,
): AsyncGenerator<{
  type: "text" | "tool_call" | "token" | "done" | "error";
  data?: any;
}> {
  // Step 1: Enqueue message
  const enqueueRes = await gezytechApi(`/api/agents/${agentSlug}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: message }),
  });
  const enqueueData = await enqueueRes.json();
  if (!enqueueData.messageId) throw new Error("Failed to enqueue message");

  // Step 2: Poll for agent response
  const startTime = Date.now();
  let seenIds = new Set<string>();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const pollRes = await gezytechApi(
        `/api/agents/${agentSlug}/messages?limit=10`,
      );
      const pollData = await pollRes.json();
      const newMessages: any[] = pollData.messages ?? [];

      for (const msg of newMessages) {
        // Skip messages we've already seen
        if (seenIds.has(msg.id)) continue;
        seenIds.add(msg.id);

        // Only process agent responses
        if (msg.sourceType !== "agent") continue;

        // Yield content
        if (msg.content) {
          yield { type: "text", data: msg.content };
        }

        // Yield token usage
        if (msg.tokenUsage) {
          yield {
            type: "token",
            data: {
              inputTokens: msg.tokenUsage.inputTokens ?? 0,
              outputTokens: msg.tokenUsage.outputTokens ?? 0,
            },
          };
        }

        yield { type: "done" };
        return;
      }
    } catch (err: any) {
      if (err.message?.includes("404")) {
        yield {
          type: "error",
          data: `Agent "${agentSlug}" not found in gezytech`,
        };
        return;
      }
    }
  }

  yield { type: "error", data: "Agent did not respond within timeout" };
}
