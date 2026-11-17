// @vitest-environment node
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createTestDb } from './testDb';
import type { MySqlDb } from './node/mysql';
import { getSettings } from './orders';
import { parseInstapayLink } from '../src/lib/instapay-link';
import * as catalog from '../functions/api/catalog';

const dir = path.resolve(__dirname, '../migrations');
const sql = readFileSync(path.join(dir, '0002_default_settings.sql'), 'utf8');

/** Runs a migration file's statements one by one (the shared pool does not allow several statements per call). */
const runScript = async (db: MySqlDb, script: string) => {
  const statements = script
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of statements) await db.exec(s);
};
const fresh = () => createTestDb();
const settings = (d1: MySqlDb) => getSettings(d1 as unknown as D1Database);

describe('InstaPay default (migration 0002_default_settings)', () => {
  it('gives a new shop a working InstaPay address and a link the site accepts', async () => {
    const s = await settings(await fresh());
    expect(s.instapay).toBe('mariam.elzomor@instapay');
    expect(s.instapayLink).toBe('https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk');
    expect(parseInstapayLink(s.instapayLink)).toBe(s.instapayLink);
  });

  it('reaches the storefront through /api/catalog, which is what checkout reads', async () => {
    const ctx = { request: new Request('http://x/api/catalog'), env: { DB: (await fresh()) as unknown as D1Database }, params: {} } as never;
    const body = (await (await catalog.onRequestGet(ctx)).json()) as { payment: { instapay: string; instapayLink: string } };
    expect(body.payment.instapay).toBe('mariam.elzomor@instapay');
    expect(body.payment.instapayLink).toBe('https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk');
  });

  it('keeps what the owner already saved in the dashboard', async () => {
    const d1 = await fresh();
    await d1.exec("UPDATE settings SET `value` = 'shop@instapay' WHERE `key` = 'instapay'");
    await d1.exec("UPDATE settings SET `value` = 'https://ipn.eg/S/shop/instapay/zzz' WHERE `key` = 'instapayLink'");
    await runScript(d1, sql);
    const s = await settings(d1);
    expect(s.instapay).toBe('shop@instapay');
    expect(s.instapayLink).toBe('https://ipn.eg/S/shop/instapay/zzz');
  });

  it('fills settings the owner left empty, and an existing shop that never saved any', async () => {
    const d1 = await fresh();
    await d1.exec("UPDATE settings SET `value` = '  ' WHERE `key` = 'instapay'");
    await d1.exec("UPDATE settings SET `value` = '' WHERE `key` = 'instapayLink'");
    await runScript(d1, sql);
    expect((await settings(d1)).instapay).toBe('mariam.elzomor@instapay');
    expect((await settings(d1)).instapayLink).toBe('https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk');

    const bare = await createTestDb({ migrate: false });
    await bare.exec('CREATE TABLE settings (`key` VARCHAR(100) NOT NULL PRIMARY KEY, `value` TEXT NOT NULL)');
    await runScript(bare, sql);
    expect((await settings(bare)).instapay).toBe('mariam.elzomor@instapay');
  });
});
