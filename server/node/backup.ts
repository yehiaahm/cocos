import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { createConnection, type Connection } from 'mysql2/promise';
import type { MySqlDb } from './mysql';
import { flag } from './storage';

/**
 * Logical backups of the MySQL database: a gzipped file of INSERT statements, one statement per line,
 * taken inside one consistent-snapshot transaction (so orders, items and events always agree) while the site keeps serving.
 * The schema is not in the dump — it comes from migrations/ when the server starts — so a restore is:
 * start the app against an empty database (it creates the tables), then `node dist-server/restore.mjs <file>`.
 */
export const BACKUP_PATTERN = /^cocos-\d{8}T\d{6}Z\.sql\.gz$/;
const SKIP_TABLES = new Set(['_migrations']);
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

export function listBackups(dir: string): { name: string; file: string; bytes: number; mtimeMs: number }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => BACKUP_PATTERN.test(n))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const s = statSync(file);
      return { name, file, bytes: s.size, mtimeMs: s.mtimeMs };
    });
}

/** True when the connected database has never been migrated (an empty or brand-new database). */
export async function isFreshDatabase(db: MySqlDb): Promise<boolean> {
  const r = await db
    .prepare("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '_migrations'")
    .first<{ n: number }>();
  return (r?.n ?? 0) === 0;
}

/**
 * Never silently start from an empty database when backups of a real one exist: that is what pointing the app at the
 * wrong or a reset database looks like. Restore, or opt in explicitly with ALLOW_FRESH_DATABASE=1.
 */
export async function assertNotSilentlyRecreated(db: MySqlDb, backupDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  if (flag(env.ALLOW_FRESH_DATABASE)) return;
  const backups = listBackups(backupDir);
  if (backups.length === 0 || !(await isFreshDatabase(db))) return;
  throw new Error(
    `The database is empty (never migrated) but ${backups.length} backup(s) exist in ${backupDir} (latest: ${backups[backups.length - 1].name}). ` +
      'Refusing to start from scratch over what may be a lost or wrong database. Restore it (see docs/BACKUP_RESTORE.md) ' +
      'or set ALLOW_FRESH_DATABASE=1 for one start if starting empty is intended.',
  );
}

const q = (id: string) => `\`${id.replace(/`/g, '``')}\``;

/** Row counts of the main tables (for the startup log and for spotting an unexpectedly empty database). */
export async function databaseStats(db: MySqlDb): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of ['orders', 'users', 'catalog_products', 'product_overrides', 'promo_codes', 'workshops']) {
    try {
      out[t] = Number((await db.prepare(`SELECT COUNT(*) AS n FROM ${q(t)}`).first<{ n: number }>())?.n ?? 0);
    } catch {
      /* table not created yet */
    }
  }
  return out;
}

/** Writes a consistent dump to `<dir>/cocos-<timestamp>.sql.gz` (via a .partial file), verifies it reads back, prunes old ones. */
export async function dumpDatabase(db: MySqlDb, dir: string, keep: number, now = new Date()) {
  mkdirSync(dir, { recursive: true });
  const final = path.join(dir, `cocos-${stamp(now)}.sql.gz`);
  const tmp = `${final}.partial`;
  rmSync(tmp, { force: true });

  const conn = await db.pool.getConnection();
  const lines: string[] = [];
  let rows = 0;
  try {
    await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const [tables] = (await conn.query(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name",
    )) as unknown as [{ t: string }[]];
    lines.push(`-- cocos dump ${now.toISOString()}`, 'SET FOREIGN_KEY_CHECKS=0;', 'SET NAMES utf8mb4;');
    for (const { t } of tables) {
      if (SKIP_TABLES.has(t)) continue;
      const [data] = (await conn.query(`SELECT * FROM ${q(t)}`)) as unknown as [Record<string, unknown>[]];
      if (data.length === 0) continue;
      const cols = Object.keys(data[0]).map(q).join(', ');
      for (let i = 0; i < data.length; i += 100) {
        const chunk = data.slice(i, i + 100).map((r) => `(${Object.values(r).map((v) => conn.escape(v)).join(', ')})`);
        // escape() turns newlines into \n, so each statement is exactly one line.
        lines.push(`INSERT INTO ${q(t)} (${cols}) VALUES ${chunk.join(', ')};`);
      }
      rows += data.length;
    }
    lines.push('SET FOREIGN_KEY_CHECKS=1;');
    await conn.query('ROLLBACK');
  } finally {
    conn.release();
  }

  await pipeline(Readable.from([lines.join('\n') + '\n']), createGzip(), createWriteStream(tmp));
  // Verify the file reads back completely before it is allowed to count as a backup.
  let readBack = 0;
  for await (const line of createInterface({ input: createReadStream(tmp).pipe(createGunzip()), crlfDelay: Infinity })) {
    if (line !== undefined) readBack++;
  }
  if (readBack !== lines.length) {
    rmSync(tmp, { force: true });
    throw new Error(`backup verification failed (${readBack} of ${lines.length} lines read back)`);
  }
  renameSync(tmp, final);
  const all = listBackups(dir);
  const pruned = all.slice(0, Math.max(0, all.length - Math.max(1, keep)));
  for (const b of pruned) rmSync(b.file, { force: true });
  return { file: final, bytes: statSync(final).size, rows, pruned: pruned.length };
}

/**
 * Loads a dump into the database. Refuses when the tables already hold rows unless `replace` is set
 * (then they are emptied first). Runs in one transaction, so a bad file changes nothing.
 */
export async function restoreDump(url: string, file: string, opts: { replace?: boolean } = {}) {
  const conn: Connection = await createConnection({ uri: url, charset: 'utf8mb4', multipleStatements: false });
  let statements = 0;
  try {
    const [tables] = (await conn.query(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
    )) as unknown as [{ t: string }[]];
    const names = tables.map((r) => r.t).filter((t) => !SKIP_TABLES.has(t));
    if (names.length === 0) throw new Error('The database has no tables yet: start the app once against it (it creates them), then restore.');
    if (!opts.replace) {
      for (const t of names) {
        if (t === 'settings') continue; // seeded by migrations (default InstaPay account); the dump's rows replace those
        const [[r]] = (await conn.query(`SELECT COUNT(*) AS n FROM ${q(t)}`)) as unknown as [[{ n: number }]];
        if (Number(r.n) > 0) throw new Error(`Table ${t} already has rows. Restore into an empty database, or pass --replace to empty the tables first.`);
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.beginTransaction();
    for (const t of names) if (opts.replace || t === 'settings') await conn.query(`DELETE FROM ${q(t)}`);
    for await (const line of createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity })) {
      const sql = line.trim();
      if (!sql || sql.startsWith('--') || /^SET /i.test(sql)) continue;
      await conn.query(sql);
      statements++;
    }
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* nothing to roll back */
    }
    throw e;
  } finally {
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS=1');
    } catch {
      /* closing anyway */
    }
    await conn.end();
  }
  return { statements };
}

/** Takes a dump when the newest one is older than `everyHours`, then re-checks hourly. Returns a stop function. */
export function startBackupSchedule(
  db: MySqlDb,
  dir: string,
  opts: { everyHours: number; keep: number; log?: Pick<Console, 'log' | 'error'> },
) {
  const log = opts.log ?? console;
  let running = false;
  const due = () => {
    const newest = listBackups(dir).at(-1);
    return !newest || Date.now() - newest.mtimeMs >= opts.everyHours * 3600_000;
  };
  const run = async () => {
    if (running || !due()) return;
    running = true;
    try {
      const r = await dumpDatabase(db, dir, opts.keep);
      log.log(`[backup] wrote ${path.basename(r.file)} (${r.rows} rows, ${r.bytes} bytes), pruned ${r.pruned}`);
    } catch (e) {
      log.error('[backup] FAILED:', (e as Error).message);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), 3600_000);
  timer.unref();
  return () => clearInterval(timer);
}
