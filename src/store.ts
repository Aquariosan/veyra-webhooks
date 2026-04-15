import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DB_DIR = join(homedir(), ".veyra-webhooks");
const DB_PATH = join(DB_DIR, "data.db");

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS webhooks (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL,
    headers    TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS history (
    id          TEXT PRIMARY KEY,
    webhook_id  TEXT NOT NULL,
    payload     TEXT NOT NULL,
    method      TEXT NOT NULL,
    status_code INTEGER,
    response    TEXT,
    sent_at     TEXT NOT NULL
  );
`);

export interface Webhook {
  id: string;
  name: string;
  url: string;
  headers: string | null;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  webhook_id: string;
  payload: string;
  method: string;
  status_code: number | null;
  response: string | null;
  sent_at: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function listWebhooks(): Webhook[] {
  return db.prepare("SELECT * FROM webhooks ORDER BY created_at DESC").all() as Webhook[];
}

export function getWebhook(id: string): Webhook | undefined {
  return db.prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as Webhook | undefined;
}

export function getHistory(webhookId: string, limit = 50): HistoryEntry[] {
  return db
    .prepare("SELECT * FROM history WHERE webhook_id = ? ORDER BY sent_at DESC LIMIT ?")
    .all(webhookId, limit) as HistoryEntry[];
}

export function registerWebhook(name: string, url: string, headers?: string): Webhook {
  const now = new Date().toISOString();
  const id = generateId();
  db.prepare(
    "INSERT INTO webhooks (id, name, url, headers, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, url, headers ?? null, now);
  return getWebhook(id)!;
}

export async function sendWebhook(
  webhookId: string,
  payload: string,
  method = "POST"
): Promise<HistoryEntry> {
  const webhook = getWebhook(webhookId);
  if (!webhook) throw new Error(`Webhook not found: ${webhookId}`);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhook.headers) {
    try {
      Object.assign(headers, JSON.parse(webhook.headers));
    } catch {
      // ignore malformed headers
    }
  }

  const now = new Date().toISOString();
  const id = generateId();
  let status_code: number | null = null;
  let response: string | null = null;

  try {
    const res = await fetch(webhook.url, {
      method,
      headers,
      body: method !== "GET" ? payload : undefined,
    });
    status_code = res.status;
    response = await res.text().catch(() => null);
  } catch (err: unknown) {
    response = err instanceof Error ? err.message : String(err);
  }

  db.prepare(
    "INSERT INTO history (id, webhook_id, payload, method, status_code, response, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, webhookId, payload, method, status_code, response, now);

  return db.prepare("SELECT * FROM history WHERE id = ?").get(id) as HistoryEntry;
}

export function deleteWebhook(id: string): boolean {
  const result = db.prepare("DELETE FROM webhooks WHERE id = ?").run(id);
  db.prepare("DELETE FROM history WHERE webhook_id = ?").run(id);
  return result.changes > 0;
}
