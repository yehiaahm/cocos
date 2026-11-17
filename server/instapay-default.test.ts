// @vitest-environment node
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { NodeD1 } from './node/d1';
import { getSettings } from './orders';
import { parseInstapayLink } from '../src/lib/instapay-link';
import * as catalog from '../functions/api/catalog';

const dir = path.resolve(__dirname, '../migrations');
const sql = readFileSync(path.join(dir, '0009_instapay_default.sql'), 'utf8');

const fresh = () => {
  const d1 = new NodeD1(':memory:');
  d1.migrate(dir);
  return d1;
};
const settings = (d1: NodeD1) => getSettings(d1 as unknown as D1Database);

describe('InstaPay default (migration 0009)', () => {
  it('gives a new shop a working InstaPay address and a link the site accepts', async () => {
    const s = await settings(fresh());
    expect(s.instapay).toBe('mariam.elzomor@instapay');
    expect(s.instapayLink).toBe('https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk');
    expect(parseInstapayLink(s.instapayLink)).toBe(s.instapayLink);
  });

  it('reaches the storefront through /api/catalog, which is what checkout reads', async () => {
    const ctx = { request: new Request('http://x/api/catalog'), env: { DB: fresh() as unknown as D1Database }, params: {} } as never;
    const body = (await (await catalog.onRequestGet(ctx)).json()) as { payment: { instapay: string; instapayLink: string } };
    expect(body.payment.instapay).toBe('mariam.elzomor@instapay');
    expect(body.payment.instapayLink).toBe('https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk');
  });

  it('keeps what the owner already saved in the dashboard', async () => {
    const d1 = fresh();
    await d1.exec(`UPDATE settings SET value = 'shop@instapay' WHERE key = 'instapay'; UPDATE settings SET value = 'https://ipn.eg/S/shop/instapay/zzz' WHERE key = 'instapayLink'`);
    await d1.exec(sql);
    const s = await settings(d1);
    expect(s.instapay).toBe('shop@instapay');
    expect(s.instapayLink).toBe('https://ipn.eg/S/shop/instapay/zzz');
  });

  it('fills settings the owner left empty, and an existing shop that never saved any', async () => {
    const d1 = fresh();
    await d1.exec(`UPDATE settings SET value = '  ' WHERE key = 'instapay'; UPDATE settings SET value = '' WHERE key = 'instapayLink'`);
    await d1.exec(sql);
    expect((await settings(d1)).instapay).toBe('mariam.elzomor@instapay');
    expect((await settings(d1)).instapayLink).toBe('https://ipn.eg/S/mariam.elzomor/instapay/8IqYGk');

    const bare = new NodeD1(':memory:');
    await bare.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await bare.exec(sql);
    expect((await settings(bare)).instapay).toBe('mariam.elzomor@instapay');
  });
});
