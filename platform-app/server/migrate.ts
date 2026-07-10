import { getDb } from "./db";

export function runMigrations(): void {
  const db = getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT DEFAULT '',
      agent_slug TEXT DEFAULT '',
      balance INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS topup_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','success','rejected')),
      reference TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usage_daily (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
      date INTEGER NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost_estimate INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pricing_config (
      id TEXT PRIMARY KEY,
      model TEXT UNIQUE NOT NULL,
      input_price INTEGER NOT NULL,
      output_price INTEGER NOT NULL,
      currency TEXT DEFAULT 'IDR',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  seedPricingDefaults();
}

function seedPricingDefaults(): void {
  const db = getDb();
  const now = Date.now();
  const defaults = [
    { model: "deepseek-chat", inputPrice: 2, outputPrice: 8, currency: "IDR" },
    { model: "deepseek-reasoner", inputPrice: 4, outputPrice: 16, currency: "IDR" },
  ];

  for (const p of defaults) {
    db.run(
      `INSERT INTO pricing_config (id, model, input_price, output_price, currency, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(model) DO NOTHING`,
      [crypto.randomUUID(), p.model, p.inputPrice, p.outputPrice, p.currency, now, now],
    );
  }
}
