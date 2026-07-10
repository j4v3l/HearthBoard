import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedServices } from "./data/seed-services.js";

const databasePath = process.env.DATABASE_PATH ?? path.resolve("data", "homelab.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    url TEXT NOT NULL,
    health_url TEXT NOT NULL DEFAULT '',
    check_type TEXT NOT NULL DEFAULT 'HTTP',
    icon TEXT NOT NULL DEFAULT 'Server',
    status TEXT NOT NULL DEFAULT 'unknown',
    status_check_enabled INTEGER NOT NULL DEFAULT 1,
    last_checked_at TEXT,
    response_time_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const rowToService = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  url: row.url,
  healthUrl: row.health_url,
  checkType: row.check_type,
  icon: row.icon,
  status: row.status,
  statusCheckEnabled: Boolean(row.status_check_enabled),
  lastCheckedAt: row.last_checked_at,
  responseTimeMs: row.response_time_ms,
});

const insert = db.prepare(`
  INSERT INTO services (
    id, name, description, category, url, health_url, check_type, icon,
    status, status_check_enabled, last_checked_at, response_time_ms
  ) VALUES (
    @id, @name, @description, @category, @url, @healthUrl, @checkType, @icon,
    @status, @statusCheckEnabled, @lastCheckedAt, @responseTimeMs
  )
`);

export function seedDatabase() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM services").get().count;
  if (count > 0) return;

  const seed = db.transaction(() => {
    for (const service of seedServices) {
      insert.run({
        ...service,
        statusCheckEnabled: service.statusCheckEnabled ? 1 : 0,
        lastCheckedAt: null,
        responseTimeMs: null,
      });
    }
  });

  seed();
}

export function listServices() {
  return db.prepare("SELECT * FROM services ORDER BY category, name").all().map(rowToService);
}

export function getService(id) {
  const row = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
  return row ? rowToService(row) : null;
}

export function createService(service) {
  insert.run({
    ...service,
    statusCheckEnabled: service.statusCheckEnabled ? 1 : 0,
    lastCheckedAt: service.lastCheckedAt ?? null,
    responseTimeMs: service.responseTimeMs ?? null,
  });
  return getService(service.id);
}

export function updateService(id, service) {
  const result = db.prepare(`
    UPDATE services SET
      name = @name,
      description = @description,
      category = @category,
      url = @url,
      health_url = @healthUrl,
      check_type = @checkType,
      icon = @icon,
      status = @status,
      status_check_enabled = @statusCheckEnabled,
      last_checked_at = @lastCheckedAt,
      response_time_ms = @responseTimeMs,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({
    ...service,
    id,
    statusCheckEnabled: service.statusCheckEnabled ? 1 : 0,
    lastCheckedAt: service.lastCheckedAt ?? null,
    responseTimeMs: service.responseTimeMs ?? null,
  });

  return result.changes ? getService(id) : null;
}

export function deleteService(id) {
  return db.prepare("DELETE FROM services WHERE id = ?").run(id).changes > 0;
}

export function updateServiceStatus(id, status, responseTimeMs = null) {
  db.prepare(`
    UPDATE services SET
      status = ?,
      response_time_ms = ?,
      last_checked_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, responseTimeMs, new Date().toISOString(), id);
  return getService(id);
}
