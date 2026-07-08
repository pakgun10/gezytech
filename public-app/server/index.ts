import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { runMigrations } from "./migrate";
import { seedDevUser } from "./auth";

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

const port = Number(process.env.PORT) || 3002;
console.log(`[gezytech-public] Server started on port ${port}`);

serve({ fetch: app.fetch, port });
