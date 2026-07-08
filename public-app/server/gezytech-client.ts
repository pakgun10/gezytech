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

/**
 * Kirim pesan ke agent via gezytech API.
 * Return AsyncGenerator yang yield SSE events: { type, data }
 */
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
  const messageId = enqueueData.messageId as string;
  if (!messageId) throw new Error("Failed to enqueue message");

  // Step 2: Poll for agent response
  const startTime = Date.now();
  let lastMessageId = messageId;
  let accumulatedContent = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let done = false;

  while (!done && Date.now() - startTime < MAX_POLL_TIME_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const pollRes = await gezytechApi(
        `/api/agents/${agentSlug}/messages?limit=10`,
      );
      const pollData = await pollRes.json();
      const newMessages = pollData.messages ?? [];

      for (const msg of newMessages) {
        if (msg.id === lastMessageId) break; // already seen this
        if (msg.messageType !== "agent") continue;

        // Extract content and token info
        const content = msg.content ?? "";
        if (content) {
          // Diff: only emit new content since last poll
          if (content.length > accumulatedContent.length) {
            const delta = content.slice(accumulatedContent.length);
            accumulatedContent = content;
            yield { type: "text", data: delta };
          }
        }

        // Check if this is the final message in the turn
        if (msg.finishReason === "stop" || msg.finishReason === "length") {
          done = true;
          inputTokens = msg.inputTokens ?? 0;
          outputTokens = msg.outputTokens ?? 0;
          yield { type: "token", data: { inputTokens, outputTokens } };
          yield { type: "done" };
          return;
        }
      }

      lastMessageId =
        newMessages.length > 0
          ? newMessages[newMessages.length - 1].id
          : lastMessageId;
    } catch (err: any) {
      // If agent not found, stop polling
      if (err.message?.includes("404")) {
        yield {
          type: "error",
          data: `Agent "${agentSlug}" not found in gezytech`,
        };
        return;
      }
    }
  }

  // Timeout or no response
  if (accumulatedContent) {
    yield { type: "done" };
  } else {
    yield { type: "error", data: "Agent did not respond within timeout" };
  }
}
