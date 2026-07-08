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
} from "./auth";

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

// Simple rate limiter (in-memory, 5 attempts per 15 min per IP)
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

// Dev mode helper
function getDevUser() {
  if (process.env.DEV_MODE === "true") {
    return getUserByEmail("dev@gezy.tech");
  }
  return null;
}

// POST /api/auth/login
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

// POST /api/auth/logout
app.post("/api/auth/logout", (c) => {
  const token = getCookie(c, "session");
  if (token) {
    deleteSession(token);
    deleteCookie(c, "session");
  }
  return c.json({ success: true });
});

// GET /api/auth/me
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

// Middleware: requireAuth
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

// Protected example route (remove or replace with real routes later)
app.get("/api/protected", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({
    message: "You are authenticated",
    user: { id: user.id, email: user.email },
  });
});

// ─── Start ───

const port = Number(process.env.PORT) || 3002;
console.log(`[gezytech-public] Server started on port ${port}`);

serve({ fetch: app.fetch, port });
