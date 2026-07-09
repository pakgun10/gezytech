import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { runMigrations } from "./migrate";
import {
  seedDevUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  createSession,
  verifySession,
  deleteSession,
  createUser,
  listUsers,
} from "./auth";
import { getDb, type ChatSession } from "./db";
import { sendChatMessage } from "./gezytech-client";
import {
  createSoulRequest,
  listSoulRequestsByUser,
  listAllSoulRequests,
  approveSoulRequest,
  rejectSoulRequest,
} from "./soul-request";
import {
  createToolRequest,
  listToolRequestsByUser,
  listAllToolRequests,
  approveToolRequest,
  rejectToolRequest,
} from "./tool-request";

// ─── Init ───
const GEZYTECH_URL = process.env.GEZYTECH_API_URL ?? "http://localhost:3000";
const SERVICE_TOKEN = process.env.GEZYTECH_SERVICE_TOKEN ?? "dev-token-shared";
runMigrations();
if (process.env.DEV_MODE === "true") {
  const devUser = await seedDevUser();
  console.log(
    `[gezytech-public] Dev user seeded: ${devUser.email} (agent: ${devUser.agentSlug})`,
  );
}

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "gezytech-public" }),
);

// ─── Auth ───

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

function getDevUser() {
  if (process.env.DEV_MODE === "true") return getUserByEmail("dev@gezy.tech");
  return null;
}

app.post("/api/auth/login", async (c) => {
  const ip = c.req.header("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return c.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      429,
    );
  }
  const { email, password } = await c.req.json<{
    email?: string;
    password?: string;
  }>();
  if (!email || !password)
    return c.json({ error: "Email and password are required" }, 400);
  const user = getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  const session = createSession(user.id);
  setCookie(c, "session", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      agentSlug: user.agentSlug,
    },
  });
});

app.post("/api/auth/logout", (c) => {
  const token = getCookie(c, "session");
  if (token) {
    deleteSession(token);
    deleteCookie(c, "session");
  }
  return c.json({ success: true });
});

app.get("/api/auth/me", (c) => {
  const devUser = getDevUser();
  if (devUser) {
    return c.json({
      user: {
        id: devUser.id,
        email: devUser.email,
        displayName: devUser.displayName,
        agentSlug: devUser.agentSlug,
      },
    });
  }
  const token = getCookie(c, "session");
  if (!token) return c.json({ error: "Not authenticated" }, 401);
  const session = verifySession(token);
  if (!session) return c.json({ error: "Session expired" }, 401);
  const user = getUserById(session.userId);
  if (!user) return c.json({ error: "User not found" }, 401);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      agentSlug: user.agentSlug,
    },
  });
});

async function requireAuth(c: any, next: any) {
  const devUser = getDevUser();
  if (devUser) {
    c.set("user", devUser);
    return next();
  }
  const token = getCookie(c, "session");
  if (!token) return c.json({ error: "Not authenticated" }, 401);
  const session = verifySession(token);
  if (!session) return c.json({ error: "Session expired" }, 401);
  const user = getUserById(session.userId);
  if (!user) return c.json({ error: "User not found" }, 401);
  c.set("user", user);
  return next();
}

// ─── Admin ───

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "admin-secret-change-me";
function adminAuth(c: any, next: any) {
  const token = c.req.header("x-admin-token") ?? "";
  if (token !== ADMIN_TOKEN) return c.json({ error: "Forbidden" }, 403);
  return next();
}

app.post("/api/admin/users", adminAuth, async (c) => {
  const { email, password, displayName, agentSlug } = await c.req.json<{
    email?: string;
    password?: string;
    displayName?: string;
    agentSlug?: string;
  }>();
  if (!email || !password || !agentSlug)
    return c.json(
      { error: "email, password, and agentSlug are required" },
      400,
    );
  try {
    const user = await createUser({ email, password, displayName, agentSlug });
    return c.json(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          agentSlug: user.agentSlug,
        },
      },
      201,
    );
  } catch (err: any) {
    if (err.message?.includes("UNIQUE"))
      return c.json({ error: "Email already exists" }, 409);
    return c.json({ error: err.message || "Failed to create user" }, 500);
  }
});

app.get("/api/admin/users", adminAuth, (c) => {
  const users = listUsers().map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    agentSlug: u.agentSlug,
    createdAt: u.createdAt,
  }));
  return c.json({ users });
});

app.delete("/api/admin/users/:id", adminAuth, (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const result = db.run("DELETE FROM users WHERE id=?", [id]);
  if (result.changes === 0) return c.json({ error: "User not found" }, 404);
  return c.json({ success: true });
});

// Sync agent slugs — when agent renamed in gezytech, update public-app user mappings
app.post("/api/admin/sync-agents", adminAuth, async (c) => {
  try {
    // Fetch all agents from gezytech
    const agentRes = await fetch(`${GEZYTECH_URL}/api/agents`, {
      headers: { "x-service-token": SERVICE_TOKEN },
    });
    if (!agentRes.ok) {
      return c.json(
        { error: `Failed to fetch agents from gezytech: ${agentRes.status}` },
        502,
      );
    }
    const agentData = await agentRes.json();
    const agents: { slug: string; name: string }[] = agentData.agents ?? [];
    const validSlugs = new Set(agents.map((a) => a.slug));

    // Get all users from public-app
    const db = getDb();
    const users = db
      .query<{
        id: string;
        email: string;
        agent_slug: string;
      }>("SELECT id, email, agent_slug FROM users")
      .all();

    let autoFixed = 0;
    const manual: { userId: string; email: string; oldSlug: string }[] = [];

    for (const user of users) {
      if (validSlugs.has(user.agent_slug)) continue; // already valid

      // Try auto-fix: substring match (e.g., "wati" → "eniwati")
      const match = agents.find(
        (a) =>
          a.slug.includes(user.agent_slug) || user.agent_slug.includes(a.slug),
      );

      if (match) {
        db.run("UPDATE users SET agent_slug=? WHERE id=?", [
          match.slug,
          user.id,
        ]);
        autoFixed++;
      } else {
        manual.push({
          userId: user.id,
          email: user.email,
          oldSlug: user.agent_slug,
        });
      }
    }

    return c.json({
      autoFixed,
      needsManualFix: manual,
      agents: agents.map((a) => ({ slug: a.slug, name: a.name })),
      totalUsers: users.length,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Chat (SSE stream) ───

app.post("/api/chat", requireAuth, async (c) => {
  const user: any = c.get("user");
  const agentSlug = user.agentSlug;
  const { message } = await c.req.json<{ message?: string }>();
  if (!message) return c.json({ error: "Message is required" }, 400);

  const finalMessage = message;

  let totalInput = 0;
  let totalOutput = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        for await (const event of sendChatMessage(agentSlug, message)) {
          if (event.type === "text") {
            send(JSON.stringify({ type: "text", content: event.data }));
          } else if (event.type === "tool_call") {
            send(JSON.stringify({ type: "tool_call", data: event.data }));
          } else if (event.type === "token") {
            totalInput = event.data.inputTokens;
            totalOutput = event.data.outputTokens;
            send(JSON.stringify({ type: "token", ...event.data }));
          } else if (event.type === "done") {
            send(JSON.stringify({ type: "done" }));
          } else if (event.type === "error") {
            send(JSON.stringify({ type: "error", message: event.data }));
          }
        }

        if (totalInput > 0 || totalOutput > 0) {
          const db = getDb();
          db.run(
            "INSERT INTO token_usage (id, user_id, input_tokens, output_tokens, total_tokens, created_at) VALUES (?,?,?,?,?,?)",
            [
              crypto.randomUUID(),
              user.id,
              totalInput,
              totalOutput,
              totalInput + totalOutput,
              Date.now(),
            ],
          );
        }
      } catch (err: any) {
        send(
          JSON.stringify({
            type: "error",
            message: err.message || "Chat failed",
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// Chat history — proxy to gezytech
app.get("/api/chat/history", requireAuth, async (c) => {
  const user: any = c.get("user");
  const agentSlug = user.agentSlug;

  try {
    const res = await fetch(
      `${process.env.GEZYTECH_API_URL ?? "http://localhost:3000"}/api/agents/${agentSlug}/messages?limit=100`,
      {
        headers: {
          "x-service-token":
            process.env.GEZYTECH_SERVICE_TOKEN ?? "dev-token-shared",
        },
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return c.json(
        { error: `Failed to fetch history: ${text.slice(0, 200)}` },
        502,
      );
    }
    const data = await res.json();
    const messages = (data.messages ?? []).map((m: any) => ({
      id: m.id,
      role: m.sourceType === "user" ? "user" : "agent",
      content: m.content ?? "",
      timestamp: m.createdAt ?? Date.now(),
    }));
    return c.json({ messages });
  } catch (err: any) {
    return c.json({ error: err.message }, 502);
  }
});

// ─── Token usage ───

app.get("/api/token-usage", requireAuth, (c) => {
  const user: any = c.get("user");
  const db = getDb();
  const result = db
    .query<{
      total: number;
      input: number;
      output: number;
      count: number;
    }>(
      "SELECT COALESCE(SUM(input_tokens),0) as input, COALESCE(SUM(output_tokens),0) as output, COALESCE(SUM(total_tokens),0) as total, COUNT(*) as count FROM token_usage WHERE user_id=?",
    )
    .get(user.id) ?? { total: 0, input: 0, output: 0, count: 0 };
  return c.json(result);
});

// ─── Memory — proxy to gezytech ───

app.get("/api/memory", requireAuth, async (c) => {
  const user: any = c.get("user");
  const agentSlug = user.agentSlug;

  try {
    const res = await fetch(
      `${GEZYTECH_URL}/api/agents/${agentSlug}/memories`,
      { headers: { "x-service-token": SERVICE_TOKEN } },
    );
    if (!res.ok) {
      return c.json({ memories: [] });
    }
    const data = await res.json();
    return c.json({ memories: data.memories ?? [], total: data.total });
  } catch {
    return c.json({ memories: [] });
  }
});

// ─── Chat Sessions ───

app.post("/api/session/new", requireAuth, async (c) => {
  const user: any = c.get("user");
  const { title } = (await c.req.json<{ title?: string }>()) ?? {};
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.run(
    "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?)",
    [id, user.id, title ?? null, now, now],
  );
  return c.json(
    { session: { id, title: title ?? null, createdAt: now, updatedAt: now } },
    201,
  );
});

app.get("/api/sessions", requireAuth, (c) => {
  const user: any = c.get("user");
  const db = getDb();
  const rows = db
    .query<
      ChatSession,
      [string]
    >("SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt FROM chat_sessions WHERE user_id=? ORDER BY created_at DESC")
    .all(user.id);
  return c.json({ sessions: rows });
});

app.patch("/api/sessions/:id", requireAuth, async (c) => {
  const user: any = c.get("user");
  const id = c.req.param("id");
  const { title } = (await c.req.json<{ title?: string }>()) ?? {};
  const db = getDb();
  const now = Date.now();
  db.run(
    "UPDATE chat_sessions SET title=?, updated_at=? WHERE id=? AND user_id=?",
    [title ?? null, now, id, user.id],
  );
  const row = db
    .query<
      ChatSession,
      [string, string]
    >("SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt FROM chat_sessions WHERE id=? AND user_id=?")
    .get(id, user.id);
  return c.json({ session: row ?? null });
});

app.delete("/api/sessions/:id", requireAuth, (c) => {
  const user: any = c.get("user");
  const id = c.req.param("id");
  const db = getDb();
  db.run("DELETE FROM chat_sessions WHERE id=? AND user_id=?", [id, user.id]);
  return c.json({ success: true });
});

// ─── SOUL Requests ───

app.post("/api/soul-request", requireAuth, async (c) => {
  const user: any = c.get("user");
  const { soulText } = await c.req.json<{ soulText?: string }>();
  if (!soulText || soulText.length < 10) {
    return c.json({ error: "SOUL text must be at least 10 characters" }, 400);
  }
  const req = createSoulRequest({ userId: user.id, soulText });
  return c.json({ request: req }, 201);
});

app.get("/api/soul-requests", requireAuth, (c) => {
  const user: any = c.get("user");
  const requests = listSoulRequestsByUser(user.id);
  return c.json({ requests });
});

// Admin SOUL endpoints
app.get("/api/admin/soul-requests", adminAuth, (c) => {
  const requests = listAllSoulRequests();
  return c.json({ requests });
});

app.patch("/api/admin/soul-requests/:id", adminAuth, async (c) => {
  const id = c.req.param("id");
  const { action, adminNote } = await c.req.json<{
    action?: string;
    adminNote?: string;
  }>();
  if (action === "approve") {
    const updated = approveSoulRequest(id, adminNote);
    if (!updated) return c.json({ error: "Request not found" }, 404);
    // Auto-apply SOUL to gezytech agent
    try {
      const soulUser = getUserById(updated.userId);
      if (soulUser) {
        await fetch(`${GEZYTECH_URL}/api/agents/${soulUser.agentSlug}`, {
          method: "PATCH",
          headers: {
            "x-service-token": SERVICE_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ character: updated.soulText }),
        });
      }
    } catch {
      /* non-critical */
    }
    return c.json({ request: updated });
  }
  if (action === "reject") {
    const updated = rejectSoulRequest(id, adminNote);
    if (!updated) return c.json({ error: "Request not found" }, 404);
    return c.json({ request: updated });
  }
  return c.json({ error: "Action must be 'approve' or 'reject'" }, 400);
});

// ─── Tool Requests ───

app.post("/api/tool-request", requireAuth, async (c) => {
  const user: any = c.get("user");
  const { toolName, reason } = await c.req.json<{
    toolName?: string;
    reason?: string;
  }>();
  if (!toolName) return c.json({ error: "Tool name is required" }, 400);
  const req = createToolRequest({ userId: user.id, toolName, reason });
  return c.json({ request: req }, 201);
});

app.get("/api/tool-requests", requireAuth, (c) => {
  const user: any = c.get("user");
  const requests = listToolRequestsByUser(user.id);
  return c.json({ requests });
});

app.get("/api/admin/tool-requests", adminAuth, (c) => {
  const requests = listAllToolRequests();
  return c.json({ requests });
});

app.patch("/api/admin/tool-requests/:id", adminAuth, async (c) => {
  const id = c.req.param("id");
  const { action, adminNote } = await c.req.json<{
    action?: string;
    adminNote?: string;
  }>();
  if (action === "approve") {
    const updated = approveToolRequest(id, adminNote);
    if (!updated) return c.json({ error: "Request not found" }, 404);
    // Auto-apply tool grant to gezytech agent
    try {
      const toolUser = getUserById(updated.userId);
      if (toolUser) {
        const agentRes = await fetch(
          `${GEZYTECH_URL}/api/agents/${toolUser.agentSlug}`,
          {
            headers: { "x-service-token": SERVICE_TOKEN },
          },
        );
        if (agentRes.ok) {
          const agentData: any = await agentRes.json();
          const currentExtra: string[] = agentData.extraToolNames ?? [];
          if (!currentExtra.includes(updated.toolName)) {
            await fetch(`${GEZYTECH_URL}/api/agents/${toolUser.agentSlug}`, {
              method: "PATCH",
              headers: {
                "x-service-token": SERVICE_TOKEN,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                extraToolNames: [...currentExtra, updated.toolName],
              }),
            });
          }
        }
      }
    } catch {
      /* non-critical */
    }
    return c.json({ request: updated });
  }
  if (action === "reject") {
    const updated = rejectToolRequest(id, adminNote);
    if (!updated) return c.json({ error: "Request not found" }, 404);
    return c.json({ request: updated });
  }
  return c.json({ error: "Action must be 'approve' or 'reject'" }, 400);
});

// ─── Start ───

const port = Number(process.env.PORT) || 3002;
console.log(`[gezytech-public] Server started on port ${port}`);

serve({ fetch: app.fetch, port });
