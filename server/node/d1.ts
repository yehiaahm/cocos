import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The small subset of Cloudflare D1's API the app uses (prepare/bind/first/all/run/batch),
 * implemented on Node's built-in SQLite. Lets the same API code run on Railway.
 */
class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: SQLInputValue[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(
      this.db,
      this.sql,
      values.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : (v as SQLInputValue))),
    );
  }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }
  async all<T>(): Promise<{ results: T[]; success: true }> {
    return { results: this.db.prepare(this.sql).all(...this.params) as T[], success: true };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  /** used by batch() inside a transaction */
  runSync() {
    return this.db.prepare(this.sql).run(...this.params);
  }
}

export class NodeD1 {
  readonly db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  }
  prepare(sql: string) {
    return new Statement(this.db, sql);
  }
  /** Runs every statement in one transaction, like D1. */
  async batch(stmts: Statement[]) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = stmts.map((s) => s.runSync());
      this.db.exec('COMMIT');
      return out.map((r) => ({ success: true, meta: { changes: Number(r.changes) } }));
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  async exec(sql: string) {
    this.db.exec(sql);
    return { count: 1 };
  }

  /** Applies migrations/*.sql once each, in order (same files Cloudflare uses). */
  migrate(dir: string) {
    this.db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const done = new Set((this.db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name));
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      this.db.exec('BEGIN');
      try {
        this.db.exec(readFileSync(path.join(dir, f), 'utf8'));
        this.db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(f, new Date().toISOString());
        this.db.exec('COMMIT');
        console.log(`[db] applied ${f}`);
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    }
  }
}
