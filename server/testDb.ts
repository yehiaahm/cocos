import { afterAll } from 'vitest';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { MySqlDb } from './node/mysql';
import type { Env } from './env';
import { TEST_MYSQL_URL } from './testConfig';

export { TEST_MYSQL_URL };

/**
 * Tests run against a real MySQL (never a mock): `docker run -d -e MYSQL_ROOT_PASSWORD=cocos-test-only -p 3317:3306 mysql:8.4`
 * or any server you point TEST_MYSQL_URL at (needs a user that may CREATE/DROP databases named cocos_test_*).
 * Every call gets its own freshly migrated database, dropped when the test file ends.
 */
export const migrationsDir = path.resolve(__dirname, '../migrations');

const created: { name: string; db: MySqlDb }[] = [];

const adminConnection = () => createConnection({ uri: TEST_MYSQL_URL, charset: 'utf8mb4' });

export async function createTestDb(opts: { migrate?: boolean } = {}): Promise<MySqlDb & { dbName: string; url: string }> {
  const name = `cocos_test_${randomBytes(6).toString('hex')}`;
  const admin = await adminConnection();
  try {
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
  } finally {
    await admin.end();
  }
  const url = `${TEST_MYSQL_URL.replace(/\/+$/, '')}/${name}`;
  const db = new MySqlDb({ url, connectionLimit: 4 }) as MySqlDb & { dbName: string; url: string };
  db.dbName = name;
  db.url = url;
  created.push({ name, db });
  if (opts.migrate !== false) await db.migrate(migrationsDir);
  return db;
}

export const testEnv = async (extra: Record<string, unknown> = {}) =>
  ({ DB: await createTestDb(), SESSION_SECRET: 'test-secret-'.repeat(4), ...extra }) as unknown as Env;

/** Drops one test database right away (for tests that open and close their own). */
export async function dropTestDb(db: { dbName: string }) {
  const i = created.findIndex((c) => c.name === db.dbName);
  if (i >= 0) {
    await created[i].db.close().catch(() => undefined);
    created.splice(i, 1);
  }
  const admin = await adminConnection();
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${db.dbName}\``);
  } finally {
    await admin.end();
  }
}

afterAll(async () => {
  for (const c of created.splice(0)) await dropTestDb({ dbName: c.name }).catch(() => undefined);
}, 60_000);
