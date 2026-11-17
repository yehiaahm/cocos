// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { testEnv } from './testDb';
import type { Env } from './env';
import { loadOverrides } from './catalog';
import { createProduct, updateProduct } from './catalogAdmin';
import * as checkout from '../functions/api/orders/index';
import * as adminOrder from '../functions/api/admin/orders/[id]';
import * as adminProducts from '../functions/api/admin/products';
import * as publicCatalog from '../functions/api/catalog';

/** Stock per product, end to end through the real handlers on a real MySQL database. */
const setup = () => testEnv();
const photo = { catalogId: '', name: 'Grey', material: 'Concrete', images: ['/media/catalog/abc123.jpg'] };
const product = (over: Record<string, unknown> = {}) => ({ name: 'Grey Planter', category: 'concrete', description: '', tags: [], variants: [photo], price: 200, ...over });

type Handler = (c: unknown) => Promise<Response>;
const order = (env: Env, p: { id: string; variants: { catalogId: string }[] }, qty: number, ip: string) =>
  (checkout.onRequestPost as unknown as Handler)({
    env,
    params: {},
    waitUntil: () => undefined,
    request: new Request('https://shop.example/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-ip': ip },
      body: JSON.stringify({
        customer: { name: 'Test Customer', phone: '01012345678', city: 'Cairo', address: '1 Test Street, Cairo' },
        paymentMethod: 'cod',
        items: [{ productId: p.id, variantId: p.variants[0].catalogId, qty }],
      }),
    }),
  });
const setStatus = (env: Env, id: number, status: string) =>
  (adminOrder.onRequestPatch as unknown as Handler)({
    env,
    params: { id: String(id) },
    request: new Request('https://shop.example/api/admin/orders/1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) }),
  });
const stockOf = async (env: Env, id: string) => (await loadOverrides(env.DB))[id]?.stock;

describe('product stock', () => {
  it('is saved from the product form and from the quick-edit list; empty means not tracked', async () => {
    const env = await setup();
    const p = await createProduct(env.DB, product({ stock: 7 }));
    expect(await stockOf(env, p.id)).toBe(7);
    await updateProduct(env.DB, p.id, product({ price: 250 })); // no stock sent → kept
    expect(await stockOf(env, p.id)).toBe(7);
    const put = await (adminProducts.onRequestPut as unknown as Handler)({
      env,
      request: new Request('https://x/api/admin/products', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: p.id, price: 250, hidden: false, soldOut: false, stock: 12 }] }),
      }),
    });
    expect(put.status).toBe(200);
    expect(await stockOf(env, p.id)).toBe(12);
    await updateProduct(env.DB, p.id, product({ stock: '' }));
    expect(await stockOf(env, p.id)).toBeNull();
  });

  it('is subtracted by an order, refused when too much is asked, and returned when the order is cancelled', async () => {
    const env = await setup();
    const p = await createProduct(env.DB, product({ stock: 5 }));

    const tooMany = await order(env, p, 6, '10.0.0.1');
    expect(tooMany.status).toBe(409);
    expect(((await tooMany.json()) as { code: string }).code).toBe('out_of_stock');
    expect(await stockOf(env, p.id)).toBe(5);

    const ok = await order(env, p, 3, '10.0.0.2');
    expect(ok.status).toBe(201);
    expect(await stockOf(env, p.id)).toBe(2);

    await setStatus(env, 1, 'cancelled');
    expect(await stockOf(env, p.id)).toBe(5);
    await setStatus(env, 1, 'new'); // reopened → units are taken out again
    expect(await stockOf(env, p.id)).toBe(2);
  });

  it('shows as sold out in the public catalogue at 0, without revealing the count', async () => {
    const env = await setup();
    const p = await createProduct(env.DB, product({ stock: 1 }));
    expect((await order(env, p, 1, '10.0.0.3')).status).toBe(201);
    expect(await stockOf(env, p.id)).toBe(0);
    const res = await (publicCatalog.onRequestGet as unknown as Handler)({ env, request: new Request('https://x/api/catalog') });
    const { overrides } = (await res.json()) as { overrides: Record<string, Record<string, unknown>> };
    expect(overrides[p.id]).toEqual({ price: 200, hidden: false, soldOut: true });
    expect((await order(env, p, 1, '10.0.0.4')).status).toBe(409);
  });

  it('does not touch products without a tracked stock', async () => {
    const env = await setup();
    const p = await createProduct(env.DB, product());
    expect((await order(env, p, 4, '10.0.0.5')).status).toBe(201);
    expect(await stockOf(env, p.id)).toBeNull();
  });
});
