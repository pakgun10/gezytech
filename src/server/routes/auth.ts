import { Hono } from "hono";
import { auth } from "@/server/auth/index";

const authRoutes = new Hono();

// Better Auth handles all /api/auth/* routes
authRoutes.all("/*", async (c) => {
  const raw = c.req.raw;
  const url = new URL(raw.url);

  // Map legacy /session → Better Auth v1.x /get-session
  if (raw.method === "GET" && url.pathname.endsWith("/session")) {
    return forwardTo(raw, "/get-session");
  }

  // Map legacy /login → Better Auth /sign-in/email
  if (raw.method === "POST" && url.pathname.endsWith("/login")) {
    return forwardTo(raw, "/sign-in/email");
  }

  // Map legacy /me → Better Auth /get-session
  if (raw.method === "GET" && url.pathname.endsWith("/me")) {
    return forwardTo(raw, "/get-session");
  }

  return auth.handler(raw);
});

function forwardTo(raw: Request, targetSuffix: string) {
  const newUrl = new URL(raw.url);
  // Replace the last path segment
  const parts = newUrl.pathname.split("/");
  parts[parts.length - 1] = targetSuffix.replace(/^\//, "");
  newUrl.pathname = parts.join("/");
  return auth.handler(new Request(newUrl.toString(), raw));
}

export { authRoutes };
