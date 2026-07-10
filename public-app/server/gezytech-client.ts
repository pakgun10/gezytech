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

// Track already-seen message IDs across calls so old responses are never replayed
const globalSeenIds = new Map<string, Set<string>>();

function getSeenIds(agentSlug: string): Set<string> {
  let ids = globalSeenIds.get(agentSlug);
  if (!ids) {
    ids = new Set();
    globalSeenIds.set(agentSlug, ids);
  }
  return ids;
}

async function gezytechApi(
  path: string,
  options?: RequestInit & { userId?: string },
) {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) ?? {}),
    "x-service-token": SERVICE_TOKEN,
    "Content-Type": "application/json",
  };
  if (options?.userId) headers["x-user-id"] = options.userId;
  const { userId: _, ...rest } = options ?? {};
  const res = await fetch(`${GEZYTECH_URL}${path}`, {
    ...rest,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gezytech API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

/** Poll for agent response, skipping already-seen message IDs and messages created before anchorTimeMs */
async function* pollAgentResponse(
  agentSlug: string,
  seenIds: Set<string>,
  anchorTimeMs: number,
  sessionId?: string,
  userId?: string,
): AsyncGenerator<{
  type: "text" | "tool_call" | "token" | "done" | "error";
  data?: any;
}> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const params = new URLSearchParams({ limit: "10" });
      if (sessionId) params.set("sessionId", sessionId);
      const pollRes = await gezytechApi(
        `/api/agents/${agentSlug}/messages?${params}`,
        { userId },
      );
      const pollData = await pollRes.json();
      const newMessages: any[] = pollData.messages ?? [];

      for (const msg of newMessages) {
        if (seenIds.has(msg.id)) continue;
        seenIds.add(msg.id);

        if (msg.sourceType !== "agent") continue;

        // Only accept messages created AFTER the user message was enqueued.
        // This prevents replaying agent responses from previous turns.
        const msgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
        if (msgTime <= anchorTimeMs) continue;

        if (msg.content) {
          yield { type: "text", data: msg.content };
        }

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

export async function* sendChatMessage(
  agentSlug: string,
  message: string,
  preInstruction?: string,
  sessionId?: string,
  userId?: string,
): AsyncGenerator<{
  type: "text" | "tool_call" | "token" | "done" | "error";
  data?: any;
}> {
  const seenIds = getSeenIds(agentSlug);

  // If preInstruction is provided, send it first and wait for it to be processed
  if (preInstruction) {
    const preRes = await gezytechApi(`/api/agents/${agentSlug}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: preInstruction }),
      userId,
    });
    const preData = await preRes.json();
    if (!preData.messageId)
      throw new Error("Failed to enqueue pre-instruction");

    // Wait for the agent to process the instruction (consume but don't yield)
    const preAnchor = Date.now();
    for await (const _event of pollAgentResponse(
      agentSlug,
      seenIds,
      preAnchor,
      sessionId,
      userId,
    )) {
      if (_event.type === "done" || _event.type === "error") break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Record anchor timestamp BEFORE enqueue.
  // Only messages with createdAt > anchorTimeMs are responses to THIS message.
  const anchorTimeMs = Date.now();

  // Enqueue real message
  const enqueueBody: Record<string, string> = { content: message };
  if (sessionId) enqueueBody.sessionId = sessionId;
  const enqueueRes = await gezytechApi(`/api/agents/${agentSlug}/messages`, {
    method: "POST",
    body: JSON.stringify(enqueueBody),
    userId,
  });
  const enqueueData = await enqueueRes.json();
  if (!enqueueData.messageId) throw new Error("Failed to enqueue message");

  // Poll for agent response — only accept messages created AFTER anchorTimeMs
  yield* pollAgentResponse(agentSlug, seenIds, anchorTimeMs, sessionId, userId);
}
