import { Database } from "bun:sqlite";

const DB_PATH = process.env.DB_PATH ?? "./data/platform.db";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH, { create: true });
    _db.run("PRAGMA journal_mode=WAL");
    _db.run("PRAGMA foreign_keys=ON");
  }
  return _db;
}

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  agentSlug: string;
  balance: number;
  createdAt: number;
  updatedAt: number;
}

export interface TopupTransaction {
  id: string;
  userId: string;
  amount: number;
  status: "pending" | "success" | "rejected";
  reference: string;
  createdAt: number;
  updatedAt: number;
}

export interface UsageDaily {
  id: string;
  userId: string;
  date: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimate: number;
  createdAt: number;
  updatedAt: number;
}

export interface PricingConfig {
  id: string;
  model: string;
  inputPrice: number;
  outputPrice: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
}
