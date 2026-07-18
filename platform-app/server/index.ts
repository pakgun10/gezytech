import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { runMigrations } from "./migrate";
import { seedDevUser, getDbUserByEmail, getDbUserById, type PlatformUser } from "./auth";
import { getDb } from "./db";

// ─── Init ───
const GEZYTECH_URL = process.env.GEZYTECH_URL ?? "http://localhost:3002";
const SERVICE_TOKEN = process.env.GEZYTECH_SERVICE_TOKEN ?? "dev-token-shared";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "admin-secret-change-me";

runMigrations();
if (process.env.DEV_MODE === "true") {
  const devUser = await seedDevUser();
  console.log(
    `[gezytech-platform] Dev user seeded: ${devUser.email}`,
  );
}

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "gezytech-platform" }),
);

// ─── Helpers ───

function getDevUser(): PlatformUser | null {
  if (process.env.DEV_MODE === "true") return getDbUserByEmail("dev@gezy.tech");
  return null;
}

async function verifyGezytechSession(token: string): Promise<{ id: string; email: string; displayName?: string; agentSlug?: string } | null> {
  try {
    const res = await fetch(`${GEZYTECH_URL}/api/auth/me`, {
      headers: {
        Cookie: `session=${token}`,
        "x-service-token": SERVICE_TOKEN,
      },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function requireAuth(c: any, next: any) {
  const devUser = getDevUser();
  if (devUser) {
    c.set("user", devUser);
    return next();
  }
  const token = getCookie(c, "session");
  if (!token) return c.json({ error: "Not authenticated" }, 401);
  const gezyUser = await verifyGezytechSession(token);
  if (!gezyUser) return c.json({ error: "Session expired" }, 401);
  const localUser = getDbUserByEmail(gezyUser.email) ?? createShadowUser(gezyUser);
  c.set("user", localUser);
  return next();
}

function createShadowUser(gezyUser: { id: string; email: string; displayName?: string; agentSlug?: string }): PlatformUser {
  const db = getDb();
  const id = gezyUser.id;
  const now = Date.now();
  db.run(
    "INSERT OR IGNORE INTO platform_users (id, email, display_name, agent_slug, balance, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    [id, gezyUser.email, gezyUser.displayName ?? "", gezyUser.agentSlug ?? "", 0, now, now],
  );
  return getDbUserById(id)!;
}

function adminAuth(c: any, next: any) {
  const token = c.req.header("x-admin-token") ?? "";
  if (token !== ADMIN_TOKEN) return c.json({ error: "Forbidden" }, 403);
  return next();
}

// ─── Auth ───

app.get("/api/auth/me", async (c) => {
  const devUser = getDevUser();
  if (devUser) {
    return c.json({
      user: {
        id: devUser.id,
        email: devUser.email,
        displayName: devUser.displayName,
        agentSlug: devUser.agentSlug,
        balance: devUser.balance,
      },
    });
  }
  const token = getCookie(c, "session");
  if (!token) return c.json({ error: "Not authenticated" }, 401);
  const gezyUser = await verifyGezytechSession(token);
  if (!gezyUser) return c.json({ error: "Session expired" }, 401);
  const localUser = getDbUserByEmail(gezyUser.email) ?? createShadowUser(gezyUser);
  return c.json({
    user: {
      id: localUser.id,
      email: localUser.email,
      displayName: localUser.displayName,
      agentSlug: localUser.agentSlug,
      balance: localUser.balance,
    },
  });
});

// ─── Dashboard ───

app.get("/api/dashboard", requireAuth, async (c) => {
  const user: PlatformUser = c.get("user");
  const db = getDb();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  const usageRow = db.query<{ input: number; output: number; total: number; cost: number }, [string, number, number]>(
    "SELECT COALESCE(SUM(input_tokens),0) as input, COALESCE(SUM(output_tokens),0) as output, COALESCE(SUM(total_tokens),0) as total, COALESCE(SUM(cost_estimate),0) as cost FROM usage_daily WHERE user_id=? AND date>=? AND date<?"
  ).get(user.id, startOfMonth, endOfMonth) ?? { input: 0, output: 0, total: 0, cost: 0 };

  const pendingRow = db.query<{ count: number; amount: number }, [string]>(
    "SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM topup_transactions WHERE user_id=? AND status='pending'"
  ).get(user.id) ?? { count: 0, amount: 0 };

  return c.json({
    balance: user.balance,
    usageThisMonth: usageRow,
    pendingTopups: pendingRow,
  });
});

// ─── Usage Detail ───

app.get("/api/usage", requireAuth, (c) => {
  const user: PlatformUser = c.get("user");
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) return c.json({ error: "from and to are required" }, 400);

  const db = getDb();
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime() + 24 * 60 * 60 * 1000;

  const rows = db.query<{ date: number; input: number; output: number; total: number; cost: number }, [string, number, number]>(
    "SELECT date, input_tokens as input, output_tokens as output, total_tokens as total, cost_estimate as cost FROM usage_daily WHERE user_id=? AND date>=? AND date<? ORDER BY date ASC"
  ).all(user.id, fromTime, toTime);

  return c.json({ usage: rows });
});

// ─── Pricing Config ───

app.get("/api/pricing", requireAuth, (c) => {
  const db = getDb();
  const rows = db.query<{ model: string; inputPrice: number; outputPrice: number; currency: string }, []>(
    "SELECT model, input_price as inputPrice, output_price as outputPrice, currency FROM pricing_config ORDER BY model ASC"
  ).all();
  return c.json({ pricing: rows });
});

app.post("/api/admin/pricing", adminAuth, async (c) => {
  const { model, inputPrice, outputPrice } = await c.req.json<{ model?: string; inputPrice?: number; outputPrice?: number }>();
  if (!model || typeof inputPrice !== "number" || typeof outputPrice !== "number") {
    return c.json({ error: "model, inputPrice, outputPrice are required" }, 400);
  }
  const db = getDb();
  const now = Date.now();
  db.run(
    "INSERT INTO pricing_config (id, model, input_price, output_price, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(model) DO UPDATE SET input_price=excluded.input_price, output_price=excluded.output_price, updated_at=excluded.updated_at",
    [crypto.randomUUID(), model, inputPrice, outputPrice, "IDR", now, now],
  );
  return c.json({ success: true });
});

// ─── TopUp ───

app.post("/api/topup", requireAuth, async (c) => {
  const user: PlatformUser = c.get("user");
  const { amount } = await c.req.json<{ amount?: number }>();
  if (!amount || amount < 1000) return c.json({ error: "Minimum topup is 1000" }, 400);

  const ref = "TOP" + Date.now().toString(36).toUpperCase();
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.run(
    "INSERT INTO topup_transactions (id, user_id, amount, status, reference, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    [id, user.id, amount, "pending", ref, now, now],
  );
  return c.json({ transaction: { id, amount, status: "pending", reference: ref, createdAt: now } }, 201);
});

app.get("/api/topup/history", requireAuth, (c) => {
  const user: PlatformUser = c.get("user");
  const db = getDb();
  const rows = db.query<{ id: string; amount: number; status: string; reference: string; createdAt: number }, [string]>(
    "SELECT id, amount, status, reference, created_at as createdAt FROM topup_transactions WHERE user_id=? ORDER BY created_at DESC"
  ).all(user.id);
  return c.json({ transactions: rows });
});

app.get("/api/topup/status/:id", requireAuth, (c) => {
  const user: PlatformUser = c.get("user");
  const id = c.req.param("id");
  const db = getDb();
  const row = db.query<{ id: string; amount: number; status: string; reference: string; createdAt: number }, [string, string]>(
    "SELECT id, amount, status, reference, created_at as createdAt FROM topup_transactions WHERE id=? AND user_id=?"
  ).get(id, user.id);
  if (!row) return c.json({ error: "Transaction not found" }, 404);
  return c.json({ transaction: row });
});

app.get("/api/admin/topups", adminAuth, (c) => {
  const db = getDb();
  const rows = db.query<{ id: string; userId: string; email: string; amount: number; status: string; reference: string; createdAt: number }, []>(
    "SELECT t.id, t.user_id as userId, u.email, t.amount, t.status, t.reference, t.created_at as createdAt FROM topup_transactions t JOIN platform_users u ON t.user_id=u.id WHERE t.status='pending' ORDER BY t.created_at DESC"
  ).all();
  return c.json({ transactions: rows });
});

app.post("/api/admin/topups/:id/approve", adminAuth, (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const now = Date.now();

  const tx = db.query<{ userId: string; amount: number; status: string }, [string]>(
    "SELECT user_id as userId, amount, status FROM topup_transactions WHERE id=?"
  ).get(id);
  if (!tx) return c.json({ error: "Transaction not found" }, 404);
  if (tx.status !== "pending") return c.json({ error: "Transaction is not pending" }, 400);

  db.run("UPDATE topup_transactions SET status='success', updated_at=? WHERE id=?", [now, id]);
  db.run("UPDATE platform_users SET balance = balance + ?, updated_at=? WHERE id=?", [tx.amount, now, tx.userId]);

  return c.json({ success: true });
});

app.post("/api/admin/topups/:id/reject", adminAuth, (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const now = Date.now();
  const result = db.run("UPDATE topup_transactions SET status='rejected', updated_at=? WHERE id=? AND status='pending'", [now, id]);
  if (result.changes === 0) return c.json({ error: "Transaction not found or not pending" }, 404);
  return c.json({ success: true });
});

// ─── Billing ───

app.get("/api/billing", requireAuth, (c) => {
  const user: PlatformUser = c.get("user");
  const db = getDb();

  const topups = db.query<{ id: string; type: string; amount: number; status: string; reference: string | null; createdAt: number }, [string]>(
    "SELECT id, 'topup' as type, amount, status, reference, created_at as createdAt FROM topup_transactions WHERE user_id=? ORDER BY created_at DESC"
  ).all(user.id);

  const usages = db.query<{ id: string; type: string; amount: number; status: string; reference: string | null; createdAt: number }, [string]>(
    "SELECT id, 'usage' as type, cost_estimate as amount, 'completed' as status, null as reference, date as createdAt FROM usage_daily WHERE user_id=? ORDER BY date DESC"
  ).all(user.id);

  const transactions = [...topups, ...usages].sort((a, b) => b.createdAt - a.createdAt);
  return c.json({ transactions });
});

// ─── Profile ───

app.get("/api/profile", requireAuth, (c) => {
  const user: PlatformUser = c.get("user");
  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    agentSlug: user.agentSlug,
    balance: user.balance,
    createdAt: user.createdAt,
  });
});

app.patch("/api/profile", requireAuth, async (c) => {
  const user: PlatformUser = c.get("user");
  const { displayName } = await c.req.json<{ displayName?: string }>();
  if (!displayName || displayName.length < 1) return c.json({ error: "displayName is required" }, 400);
  const db = getDb();
  const now = Date.now();
  db.run("UPDATE platform_users SET display_name=?, updated_at=? WHERE id=?", [displayName, now, user.id]);
  return c.json({ success: true });
});

// ─── Start ───

const port = Number(process.env.PORT) || 3004;
console.log(`[gezytech-platform] Server started on port ${port}`);

serve({ fetch: app.fetch, port });
