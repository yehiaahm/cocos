// A Cloudflare D1–compatible database on Node's built-in SQLite (node:sqlite, Node 22.13+).
// Only the parts of the D1 API that functions/ and server/ use are implemented:
// prepare().bind().first()/all()/run()/raw() and batch() (one transaction).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

type Row = Record<string, unknown>;
type Value = string | number | bigint | boolean | null | undefined | ArrayBuffer | Uint8Array;

const RETURNS_ROWS = /^\s*(select|with|pragma|values)\b|\breturning\b/i;

function toSql(v: Value): SQLInputValue {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return v as SQLInputValue;
}

export class NodeD1 {
  readonly db: DatabaseSync;
  private cache = new Map<string, StatementSync>();

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  }

  statement(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  prepare(sql: string): NodeD1Statement {
    return new NodeD1Statement(this, sql, []);
  }

  async batch(stmts: NodeD1Statement[]) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = stmts.map((s) => s.execSync());
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async exec(sql: string) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }

  /** Applies migrations/*.sql in name order, once each (tracked like wrangler's d1_migrations table). */
  migrate(dir: string): string[] {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
    );
    const done = new Set((this.db.prepare('SELECT name FROM d1_migrations').all() as Row[]).map((r) => String(r.name)));
    const applied: string[] = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(name)) continue;
      this.db.exec('BEGIN');
      try {
        this.db.exec(readFileSync(path.join(dir, name), 'utf8'));
        this.db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw new Error(`Migration ${name} failed: ${(e as Error).message}`);
      }
      applied.push(name);
    }
    return applied;
  }
}

export class NodeD1Statement {
  constructor(
    private d1: NodeD1,
    private sql: string,
    private args: SQLInputValue[],
  ) {}

  bind(...values: Value[]): NodeD1Statement {
    return new NodeD1Statement(this.d1, this.sql, values.map(toSql));
  }

  private get stmt() {
    return this.d1.statement(this.sql);
  }

  firstSync<T = Row>(column?: string): T | null {
    const row = this.stmt.get(...this.args) as Row | undefined;
    if (!row) return null;
    return (column ? row[column] : { ...row }) as T;
  }

  execSync<T = Row>() {
    if (RETURNS_ROWS.test(this.sql)) {
      const results = (this.stmt.all(...this.args) as Row[]).map((r) => ({ ...r })) as T[];
      return { success: true as const, results, meta: { changes: 0, last_row_id: 0, rows_read: results.length, rows_written: 0, duration: 0 } };
    }
    const r = this.stmt.run(...this.args);
    const changes = Number(r.changes);
    return {
      success: true as const,
      results: [] as T[],
      meta: { changes, last_row_id: Number(r.lastInsertRowid), rows_read: 0, rows_written: changes, duration: 0 },
    };
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    return this.firstSync<T>(column);
  }

  async all<T = Row>() {
    return this.execSync<T>();
  }

  async run<T = Row>() {
    return this.execSync<T>();
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    return (this.stmt.all(...this.args) as Row[]).map((r) => Object.values(r)) as T[];
  }
}
