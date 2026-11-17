// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createConnection } from 'mysql2/promise';
import { MySqlDb } from './node/mysql';
import { FileR2 } from './node/r2';
import { resolveStorage } from './node/storage';
import { assertNotSilentlyRecreated, databaseStats, dumpDatabase, listBackups, restoreDump } from './node/backup';
import { createTestDb, dropTestDb, migrationsDir, TEST_MYSQL_URL } from './testDb';
import { createProduct } from './catalogAdmin';
import type { Env } from './env';
import * as checkout from '../functions/api/orders/index';

/** Persistence against a real MySQL server: the data lives in the database, so it must survive the app, its connections and its migrations. */
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(path.join(tmpdir(), 'cocos-persist-'));
  dirs.push(d);
  return d;
};
afterAll(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const envOf = (db: MySqlDb) => ({ DB: db, SESSION_SECRET: 'test-secret-'.repeat(4) }) as unknown as Env;
/** "The app process restarts": a brand-new pool on the same database, migrations run again as on every start. */
const restart = async (db: { url: string }) => {
  const next = new MySqlDb({ url: db.url, connectionLimit: 4 });
  const applied = await next.migrate(migrationsDir);
  return { db: next, applied };
};

type Handler = (c: unknown) => Promise<Response>;
const placeOrder = (env: Env, productId: string, variantId: string, ip: string) =>
  (checkout.onRequestPost as unknown as Handler)({
    env,
    params: {},
    waitUntil: () => undefined,
    request: new Request('https://shop.example/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-ip': ip },
      body: JSON.stringify({
        customer: { name: 'Persist Tester', phone: '01012345678', city: 'Cairo', address: '1 Test Street, Cairo' },
        paymentMethod: 'cod',
        items: [{ productId, variantId, qty: 1 }],
      }),
    }),
  });
const DESCRIPTION = 'وصف عربي ✓ — with “quotes”, a \\ backslash and a\nnewline';
const seed = async (env: Env, tag: string, ip: string) => {
  const p = await createProduct(env.DB, {
    name: `Planter ${tag}`,
    category: 'concrete',
    description: DESCRIPTION,
    tags: [],
    variants: [{ catalogId: '', name: 'Grey', material: 'Concrete', images: ['/media/catalog/abc123.jpg'] }],
    price: 200,
  });
  const res = await placeOrder(env, p.id, p.variants[0].catalogId, ip);
  expect(res.status).toBe(201);
  await env.DB.prepare('INSERT INTO users (email, name) VALUES (?, ?)').bind(`${tag}@test.invalid`, `User ${tag}`).run();
  return p;
};

describe('storage location (uploads, keys, dumps)', () => {
  const root = '/app';
  it('treats Railway without a volume as NOT persistent', () => {
    expect(resolveStorage({ RAILWAY_ENVIRONMENT: 'production' }, root).persistent).toBe(false);
  });
  it('treats a mounted volume or an explicit DATA_DIR as persistent', () => {
    expect(resolveStorage({ RAILWAY_ENVIRONMENT: 'production', RAILWAY_VOLUME_MOUNT_PATH: '/data' }, root)).toMatchObject({ persistent: true, source: 'RAILWAY_VOLUME_MOUNT_PATH' });
    expect(resolveStorage({ RAILWAY_ENVIRONMENT: 'production', DATA_DIR: '/data' }, root).persistent).toBe(true);
  });
  it('is fine locally (no Railway) with the .data default', () => {
    expect(resolveStorage({}, root)).toMatchObject({ persistent: true, source: 'default' });
  });
});

describe('Test A — data survives an app restart', () => {
  it('keeps users, orders and catalogue data when the app restarts against the same database', async () => {
    const first = await createTestDb();
    const p = await seed(envOf(first), 'a', '10.1.0.1');
    const before = await databaseStats(first);
    expect(before).toMatchObject({ orders: 1, users: 1, catalog_products: 81 });
    await first.close(); // process exit

    const second = await restart(first); // process start
    expect(second.applied).toEqual([]); // no migration re-run
    expect(await databaseStats(second.db)).toEqual(before);
    const order = await second.db.prepare('SELECT customer_name FROM orders').first<{ customer_name: string }>();
    expect(order?.customer_name).toBe('Persist Tester');
    const prod = await second.db.prepare('SELECT description FROM catalog_products WHERE id = ?').bind(p.id).first<{ description: string }>();
    expect(prod?.description).toBe(DESCRIPTION); // Arabic and escapes survive intact
    await second.db.close();
  });
});

describe('Test B — a redeploy with new migrations keeps the old records', () => {
  it('re-running every migration on an existing database is a no-op for the data', async () => {
    const db = await createTestDb();
    await seed(envOf(db), 'b0', '10.2.0.0');
    const before = await databaseStats(db);
    // Worst case: the bookkeeping table is lost, so every migration runs again.
    await db.exec('DROP TABLE _migrations');
    expect((await db.migrate(migrationsDir)).length).toBe(2);
    expect(await databaseStats(db)).toEqual(before);
  });

  it('applies only the new migration to an existing database and leaves every row alone', async () => {
    const db = await createTestDb();
    await seed(envOf(db), 'b1', '10.2.0.1');
    await seed(envOf(db), 'b2', '10.2.0.2');
    const before = await databaseStats(db);

    const next = tmp(); // "next release" ships one extra migration
    for (const f of readdirSync(migrationsDir)) cpSync(path.join(migrationsDir, f), path.join(next, f));
    writeFileSync(path.join(next, '0003_test_column.sql'), 'ALTER TABLE orders ADD COLUMN test_note VARCHAR(50) NULL;');
    expect(await db.migrate(next)).toEqual(['0003_test_column.sql']);
    expect(await databaseStats(db)).toEqual(before);
    expect(await db.migrate(next)).toEqual([]);
  });

  it('stops on a failing migration, names it, does not record it, and leaves the data untouched', async () => {
    const db = await createTestDb();
    await seed(envOf(db), 'b3', '10.2.0.3');
    const before = await databaseStats(db);
    const bad = tmp();
    for (const f of readdirSync(migrationsDir)) cpSync(path.join(migrationsDir, f), path.join(bad, f));
    writeFileSync(path.join(bad, '0003_bad.sql'), 'SELECT * FROM table_that_does_not_exist;');
    await expect(db.migrate(bad)).rejects.toThrow(/Migration 0003_bad\.sql failed/);
    expect(await databaseStats(db)).toEqual(before);
    const recorded = await db.prepare("SELECT COUNT(*) AS n FROM _migrations WHERE name = '0003_bad.sql'").first<{ n: number }>();
    expect(recorded?.n).toBe(0);
  });

  it('two instances starting at once do not both apply the migrations (advisory lock)', async () => {
    const db = await createTestDb({ migrate: false });
    const other = new MySqlDb({ url: db.url, connectionLimit: 2 });
    const [a, b] = await Promise.all([db.migrate(migrationsDir), other.migrate(migrationsDir)]);
    expect([...a, ...b].sort()).toEqual(['0001_schema.sql', '0002_default_settings.sql']);
    await other.close();
  });
});

describe('Test C — uploads, reconnects, backups', () => {
  it('keeps uploaded files readable after the bucket object is re-created (restart)', async () => {
    const dir = tmp();
    await new FileR2(path.join(dir, 'uploads')).put('proofs/1/shot.png', new Uint8Array([1, 2, 3, 4]), { httpMetadata: { contentType: 'image/png' } });
    const again = await new FileR2(path.join(dir, 'uploads')).get('proofs/1/shot.png');
    expect(again?.httpMetadata.contentType).toBe('image/png');
    expect(new Uint8Array(await new Response(again!.body).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('reconnects by itself after every connection is cut (database restart) and sees earlier and later writes', async () => {
    const db = await createTestDb();
    await seed(envOf(db), 'c1', '10.3.0.1');
    // What a MySQL restart does to the app: every open connection dies.
    const admin = await createConnection({ uri: TEST_MYSQL_URL });
    const [procs] = (await admin.query('SELECT id FROM information_schema.processlist WHERE db = ?', [db.dbName])) as unknown as [{ id: number }[]];
    expect(procs.length).toBeGreaterThan(0);
    for (const { id } of procs) await admin.query(`KILL CONNECTION ${Number(id)}`);
    await admin.end();
    await new Promise((r) => setTimeout(r, 300));

    await seed(envOf(db), 'c2', '10.3.0.2'); // first writes after the outage go through on fresh connections
    expect(await databaseStats(db)).toMatchObject({ orders: 2, users: 2 });
  });

  it('writes a verified dump while the database is in use, and a restore into a fresh database brings everything back', async () => {
    const dir = tmp();
    const live = await createTestDb();
    const p = await seed(envOf(live), 'snap', '10.3.0.3');
    const dump = await dumpDatabase(live, path.join(dir, 'backups'), 14);
    await seed(envOf(live), 'after', '10.3.0.4'); // written after the dump: not in it
    expect(readdirSync(path.join(dir, 'backups')).some((f) => f.endsWith('.partial'))).toBe(false);

    const target = await createTestDb(); // a new, empty database: migrated, so tables exist
    const { statements } = await restoreDump(target.url, dump.file);
    expect(statements).toBeGreaterThan(0);
    expect(await databaseStats(target)).toMatchObject({ orders: 1, users: 1, catalog_products: 81 });
    const prod = await target.prepare('SELECT description FROM catalog_products WHERE id = ?').bind(p.id).first<{ description: string }>();
    expect(prod?.description).toBe(DESCRIPTION);
    const order = await target.prepare('SELECT number, customer_name FROM orders').first<{ number: string; customer_name: string }>();
    expect(order).toEqual({ number: 'CA-1001', customer_name: 'Persist Tester' });
    // The restored database keeps working: the next order gets the next id.
    const res = await placeOrder(envOf(target), p.id, p.variants[0].catalogId, '10.3.0.5');
    expect(res.status).toBe(201);
    expect(await target.prepare('SELECT number FROM orders ORDER BY id DESC LIMIT 1').first('number')).toBe('CA-1002');
  });

  it('refuses to restore over a database that already has data, unless asked to replace it', async () => {
    const dir = tmp();
    const live = await createTestDb();
    await seed(envOf(live), 'r1', '10.3.1.1');
    const dump = await dumpDatabase(live, path.join(dir, 'backups'), 14);
    await seed(envOf(live), 'r2', '10.3.1.2');
    await expect(restoreDump(live.url, dump.file)).rejects.toThrow(/already has rows/);
    expect(await databaseStats(live)).toMatchObject({ orders: 2 });
    await restoreDump(live.url, dump.file, { replace: true });
    expect(await databaseStats(live)).toMatchObject({ orders: 1 });
  });

  it('keeps only the newest N dumps', async () => {
    const dir = tmp();
    const db = await createTestDb();
    const backups = path.join(dir, 'backups');
    for (let day = 1; day <= 5; day++) await dumpDatabase(db, backups, 3, new Date(Date.UTC(2026, 10, day, 3)));
    expect(listBackups(backups).map((b) => b.name)).toEqual(['cocos-20261103T030000Z.sql.gz', 'cocos-20261104T030000Z.sql.gz', 'cocos-20261105T030000Z.sql.gz']);
  });
});

describe('never silently starting from an empty database', () => {
  it('refuses when the database was never migrated but dumps of a real one exist', async () => {
    const dir = tmp();
    const real = await createTestDb();
    await dumpDatabase(real, path.join(dir, 'backups'), 14);
    const empty = await createTestDb({ migrate: false }); // e.g. the app was pointed at a new/wrong database
    await expect(assertNotSilentlyRecreated(empty, path.join(dir, 'backups'), {})).rejects.toThrow(/Refusing to start from scratch/);
    await expect(assertNotSilentlyRecreated(empty, path.join(dir, 'backups'), { ALLOW_FRESH_DATABASE: '1' })).resolves.toBeUndefined();
  });

  it('allows a first start (no dumps) and a normal start (already migrated)', async () => {
    const dir = tmp();
    const empty = await createTestDb({ migrate: false });
    await expect(assertNotSilentlyRecreated(empty, path.join(dir, 'backups'), {})).resolves.toBeUndefined();
    const real = await createTestDb();
    await dumpDatabase(real, path.join(dir, 'backups'), 14);
    await expect(assertNotSilentlyRecreated(real, path.join(dir, 'backups'), {})).resolves.toBeUndefined();
    expect(existsSync(path.join(dir, 'backups'))).toBe(true);
  });

  it('drops a test database when asked', async () => {
    const db = await createTestDb();
    await dropTestDb(db);
    const admin = await createConnection({ uri: TEST_MYSQL_URL });
    const [rows] = (await admin.query('SHOW DATABASES LIKE ?', [db.dbName])) as unknown as [unknown[]];
    await admin.end();
    expect(rows.length).toBe(0);
  });
});
