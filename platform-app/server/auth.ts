import { getDb, type PlatformUser } from "./db";

export function getDbUserByEmail(email: string): PlatformUser | null {
  return getDb().query<PlatformUser, [string]>(
    "SELECT id, email, display_name as displayName, agent_slug as agentSlug, balance, created_at as createdAt, updated_at as updatedAt FROM platform_users WHERE email=?"
  ).get(email) ?? null;
}

export function getDbUserById(id: string): PlatformUser | null {
  return getDb().query<PlatformUser, [string]>(
    "SELECT id, email, display_name as displayName, agent_slug as agentSlug, balance, created_at as createdAt, updated_at as updatedAt FROM platform_users WHERE id=?"
  ).get(id) ?? null;
}

export function createPlatformUser(params: {
  id?: string;
  email: string;
  displayName?: string;
  agentSlug?: string;
  balance?: number;
}): PlatformUser {
  const db = getDb();
  const id = params.id ?? crypto.randomUUID();
  const now = Date.now();
  db.run(
    "INSERT INTO platform_users (id, email, display_name, agent_slug, balance, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    [id, params.email, params.displayName ?? "", params.agentSlug ?? "", params.balance ?? 0, now, now],
  );
  return getDbUserById(id)!;
}

export async function seedDevUser(): Promise<PlatformUser> {
  const existing = getDbUserByEmail("dev@gezy.tech");
  if (existing) return existing;
  return createPlatformUser({
    email: "dev@gezy.tech",
    displayName: "Dev User",
    agentSlug: process.env.DEV_AGENT_SLUG ?? "wati",
    balance: 100000,
  });
}
