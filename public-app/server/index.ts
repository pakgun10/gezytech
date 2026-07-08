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
import { getDb } from "./db";

// ─── Init ───
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
  if (process.env.DEV_MODE === "true") {
    return getUserByEmail("dev@gezy.tech");
  }
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
  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }
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

// Create user (admin)
app.post("/api/admin/users", adminAuth, async (c) => {
  const { email, password, displayName, agentSlug } = await c.req.json<{
    email?: string;
    password?: string;
    displayName?: string;
    agentSlug?: string;
  }>();
  if (!email || !password || !agentSlug) {
    return c.json(
      { error: "email, password, and agentSlug are required" },
      400,
    );
  }
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

// List users (admin)
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

// Delete user (admin)
app.delete("/api/admin/users/:id", adminAuth, (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const result = db.run("DELETE FROM users WHERE id=?", [id]);
  if (result.changes === 0) return c.json({ error: "User not found" }, 404);
  return c.json({ success: true });
});

// ─── Start ───

const port = Number(process.env.PORT) || 3002;
console.log(`[gezytech-public] Server started on port ${port}`);

serve({ fetch: app.fetch, port });
