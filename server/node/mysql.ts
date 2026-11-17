import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createConnection, createPool, type Pool, type PoolConnection, type ResultSetHeader } from 'mysql2/promise';

/**
 * A small database layer on MySQL that keeps the shape of Cloudflare D1's API
 * (prepare().bind().first()/all()/run()/raw(), batch() in one transaction), which is what server/ and functions/ were written against.
 * Placeholders are plain `?`. Rows come back as plain objects; DECIMAL (SUM) comes back as a number.
 */
type Row = Record<string, unknown>;
type Value = string | number | bigint | boolean | null | undefined | ArrayBuffer | Uint8Array;
type Param = string | number | bigint | null | Buffer;

const toParam = (v: Value): Param => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (v instanceof Uint8Array) return Buffer.from(v);
  return v;
};

const RETRYABLE = new Set(['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);
const isRetryable = (e: unknown) => RETRYABLE.has((e as { code?: string }).code ?? '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Executor = Pick<Pool | PoolConnection, 'query'>;

export interface MySqlOptions {
  /** mysql://user:pass@host:3306/dbname */
  url: string;
  connectionLimit?: number;
}

export class MySqlDb {
  readonly pool: Pool;
  private connectionUrl: string;

  constructor(opts: MySqlOptions) {
    this.connectionUrl = opts.url;
    this.pool = createPool({
      uri: opts.url,
      // UPDATE reports the rows it matched (like SQLite/D1), not only the rows whose value changed.
      flags: ['+FOUND_ROWS'],
      connectionLimit: opts.connectionLimit ?? 10,
      charset: 'utf8mb4',
      timezone: 'Z',
      decimalNumbers: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      connectTimeout: 10_000,
      waitForConnections: true,
    });
  }

  prepare(sql: string): MySqlStatement {
    return new MySqlStatement(this, sql, []);
  }

  /** Runs one statement; SELECTs are retried once on a dropped connection (e.g. the database was restarted). */
  async execute(sql: string, params: Param[], on: Executor = this.pool) {
    const retries = /^\s*(select|with|show)\b/i.test(sql) && on === this.pool ? 2 : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        const [res] = await on.query(sql, params);
        return res;
      } catch (e) {
        if (attempt >= retries || !isRetryable(e)) throw e;
        console.warn(`[db] connection dropped (${(e as { code?: string }).code}), retrying`);
        await sleep(200);
      }
    }
  }

  /** Runs every statement in one transaction, like D1's batch(). */
  async batch(stmts: MySqlStatement[]) {
    let conn: PoolConnection;
    try {
      conn = await this.pool.getConnection();
    } catch (e) {
      if (!isRetryable(e)) throw e;
      await sleep(200);
      conn = await this.pool.getConnection();
    }
    try {
      await conn.beginTransaction();
      const out = [];
      for (const s of stmts) out.push(await s.run0(conn));
      await conn.commit();
      return out;
    } catch (e) {
      try {
        await conn.rollback();
      } catch {
        /* connection already gone: the server rolls the transaction back itself */
      }
      throw e;
    } finally {
      conn.release();
    }
  }

  async exec(sql: string) {
    await this.execute(sql, []);
    return { count: 1, duration: 0 };
  }

  async ping(): Promise<void> {
    await this.execute('SELECT 1', []);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Applies migrations/*.sql once each, in name order. MySQL cannot roll DDL back, so every migration must be
   * idempotent (see the header of migrations/0001_schema.sql); a migration is recorded only after it fully succeeds.
   * A MySQL advisory lock keeps two instances starting at the same time from racing.
   */
  async migrate(dir: string): Promise<string[]> {
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const conn = await createConnection({ uri: this.connectionUrl, charset: 'utf8mb4', multipleStatements: true, connectTimeout: 10_000 });
    const applied: string[] = [];
    try {
      const [[lock]] = (await conn.query("SELECT GET_LOCK('cocos_migrate', 60) AS got")) as unknown as [[{ got: number }]];
      if (lock.got !== 1) throw new Error('Could not get the migration lock within 60 s (another instance is migrating?)');
      await conn.query(
        'CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR(191) NOT NULL PRIMARY KEY, applied_at VARCHAR(32) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
      );
      const [rows] = await conn.query('SELECT name FROM _migrations');
      const done = new Set((rows as Row[]).map((r) => String(r.name)));
      for (const f of files) {
        if (done.has(f)) continue;
        try {
          await conn.query(readFileSync(path.join(dir, f), 'utf8'));
          await conn.query('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [f, new Date().toISOString()]);
        } catch (e) {
          throw new Error(
            `Migration ${f} failed: ${(e as Error).message}. MySQL cannot roll DDL back, so it may be partly applied; ` +
              'migrations are written to be re-runnable — fix the cause and restart.',
          );
        }
        console.log(`[db] applied ${f}`);
        applied.push(f);
      }
    } finally {
      try {
        await conn.query("SELECT RELEASE_LOCK('cocos_migrate')");
      } catch {
        /* lock is released when the connection closes */
      }
      await conn.end();
    }
    return applied;
  }
}

export class MySqlStatement {
  constructor(
    private db: MySqlDb,
    private sql: string,
    private args: Param[],
  ) {}

  bind(...values: Value[]): MySqlStatement {
    return new MySqlStatement(this.db, this.sql, values.map(toParam));
  }

  /** Used by batch(): runs on the transaction's connection. */
  async run0(conn: PoolConnection) {
    const res = await this.db.execute(this.sql, this.args, conn);
    return shape(res);
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const res = await this.db.execute(this.sql, this.args);
    if (!Array.isArray(res) || res.length === 0) return null;
    const row = res[0] as Row;
    return (column ? row[column] : { ...row }) as T;
  }

  async all<T = Row>() {
    return shape(await this.db.execute(this.sql, this.args)) as { success: true; results: T[]; meta: Meta };
  }

  async run<T = Row>() {
    return shape(await this.db.execute(this.sql, this.args)) as { success: true; results: T[]; meta: Meta };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const res = await this.db.execute(this.sql, this.args);
    return (Array.isArray(res) ? (res as Row[]).map((r) => Object.values(r)) : []) as T[];
  }
}

interface Meta {
  changes: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
  duration: number;
}

function shape(res: unknown) {
  if (Array.isArray(res)) {
    const results = (res as Row[]).map((r) => ({ ...r }));
    return { success: true as const, results, meta: { changes: 0, last_row_id: 0, rows_read: results.length, rows_written: 0, duration: 0 } as Meta };
  }
  const h = res as ResultSetHeader;
  const changes = Number(h.affectedRows ?? 0);
  return {
    success: true as const,
    results: [] as Row[],
    meta: { changes, last_row_id: Number(h.insertId ?? 0), rows_read: 0, rows_written: changes, duration: 0 } as Meta,
  };
}
