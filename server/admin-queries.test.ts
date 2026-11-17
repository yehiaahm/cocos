// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { testEnv } from './testDb';
import { createProduct } from './catalogAdmin';
import { notifyAdmins } from './push';
import { createUserSession } from './accounts';
import type { Env } from './env';
import * as checkout from '../functions/api/orders/index';
import * as adminOrders from '../functions/api/admin/orders/index';
import * as adminStats from '../functions/api/admin/stats';
import * as adminCustomers from '../functions/api/admin/customers';
import * as adminSettings from '../functions/api/admin/settings';
import * as adminPush from '../functions/api/admin/push';
import * as latest from '../functions/api/admin/notifications/latest';

/** The dashboard's reporting / search / upsert queries, run on real MySQL (strict mode, ONLY_FULL_GROUP_BY). */
type Handler = (c: unknown) => Promise<Response>;
const get = (fn: unknown, env: Env, url: string) => (fn as Handler)({ env, params: {}, request: new Request(`https://shop.example${url}`) });
const send = (fn: unknown, env: Env, url: string, method: string, body: unknown) =>
  (fn as Handler)({
    env,
    params: {},
    waitUntil: () => undefined,
    request: new Request(`https://shop.example${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });

const order = async (env: Env, p: { id: string; variants: { catalogId: string }[] }, who: { name: string; phone: string; city: string }, ip: string, qty = 1) => {
  const res = await (checkout.onRequestPost as unknown as Handler)({
    env,
    params: {},
    waitUntil: () => undefined,
    request: new Request('https://shop.example/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-ip': ip },
      body: JSON.stringify({
        customer: { ...who, address: '1 Test Street, Cairo' },
        paymentMethod: 'cod',
        items: [{ productId: p.id, variantId: p.variants[0].catalogId, qty }],
      }),
    }),
  });
  expect(res.status).toBe(201);
};

const seed = async () => {
  const env = await testEnv();
  // Totals need a delivery fee; 0 keeps the arithmetic obvious.
  await env.DB.prepare("INSERT INTO settings (`key`, `value`) VALUES ('deliveryFee', '0')").run();
  const p = await createProduct(env.DB, {
    name: 'Report Planter',
    category: 'concrete',
    description: '',
    tags: [],
    variants: [{ catalogId: '', name: 'Grey', material: 'Concrete', images: ['/media/catalog/abc123.jpg'] }],
    price: 100,
  });
  await order(env, p, { name: 'Mona Ali', phone: '01011111111', city: 'Cairo' }, '10.9.0.1', 2); // 200
  await order(env, p, { name: 'Mona Ali', phone: '01011111111', city: 'cairo' }, '10.9.0.2', 1); // 100, same customer, other casing
  await order(env, p, { name: 'سارة أحمد', phone: '01022222222', city: 'الإسكندرية' }, '10.9.0.3', 3); // 300
  return { env, p };
};

describe('dashboard statistics', () => {
  it('counts orders, revenue, days, cities and customers', async () => {
    const { env } = await seed();
    const res = await get(adminStats.onRequestGet, env, '/api/admin/stats?range=7');
    expect(res.status).toBe(200);
    const s = (await res.json()) as {
      kpis: { orders: number; revenue: number; avgOrder: number | null; newOrders: number; customers: number; returningCustomers: number };
      daily: { date: string; orders: number; revenue: number }[];
      cities: { city: string; count: number }[];
      topProducts: { qty: number; revenue: number }[];
      statuses: { status: string; count: number }[];
      payments: { method: string; count: number }[];
    };
    expect(s.kpis).toMatchObject({ orders: 3, revenue: 600, avgOrder: 200, newOrders: 3, customers: 2, returningCustomers: 1 });
    expect(typeof s.kpis.revenue).toBe('number'); // DECIMAL sums arrive as numbers, not strings
    // "Cairo" and "cairo" are one city.
    expect(s.cities.find((c) => c.city.toLowerCase() === 'cairo')?.count).toBe(2);
    expect(s.cities.length).toBe(2);
    // Today (Cairo day, UTC+2) holds all three orders.
    const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
    expect(s.daily.find((d) => d.date === today)).toEqual({ date: today, orders: 3, revenue: 600 });
    expect(s.topProducts[0]).toMatchObject({ qty: 6, revenue: 600 });
    expect(s.statuses).toEqual([{ status: 'new', count: 3 }]);
    expect(s.payments).toEqual([{ method: 'cod', count: 3 }]);
    for (const range of [30, 90]) expect((await get(adminStats.onRequestGet, env, `/api/admin/stats?range=${range}`)).status).toBe(200);
  });
});

describe('dashboard customers and order search', () => {
  it('groups customers by phone and searches by name, city and digits', async () => {
    const { env } = await seed();
    const list = async (q = '') => ((await (await get(adminCustomers.onRequestGet, env, `/api/admin/customers?q=${encodeURIComponent(q)}`)).json()) as { customers: { phone: string; name: string; orders: number; spent: number }[] }).customers;
    const all = await list();
    expect(all.map((c) => c.phone).sort()).toEqual(['01011111111', '01022222222']);
    expect(all.find((c) => c.phone === '01011111111')).toMatchObject({ name: 'Mona Ali', orders: 2, spent: 300 });
    expect((await list('mona')).map((c) => c.phone)).toEqual(['01011111111']); // case-insensitive
    expect((await list('سارة')).map((c) => c.phone)).toEqual(['01022222222']); // Arabic
    expect((await list('Alex')).length).toBe(0);
    expect((await list('0102222')).map((c) => c.phone)).toEqual(['01022222222']); // digits → phone
    expect((await list('الإسكندرية')).length).toBe(1); // city
  });

  it('lists, filters, searches and pages orders', async () => {
    const { env } = await seed();
    const list = async (qs = '') => (await (await get(adminOrders.onRequestGet, env, `/api/admin/orders${qs}`)).json()) as { orders: { number: string }[]; total: number; counts: Record<string, number> };
    const all = await list();
    expect(all.total).toBe(3);
    expect(all.counts).toEqual({ new: 3 });
    expect(all.orders.map((o) => o.number)).toEqual(['CA-1003', 'CA-1002', 'CA-1001']); // newest first
    expect((await list('?q=CA-1002')).orders.map((o) => o.number)).toEqual(['CA-1002']);
    expect((await list('?q=mona')).total).toBe(2);
    expect((await list('?q=01022')).total).toBe(1);
    expect((await list('?status=cancelled')).total).toBe(0);
    expect((await list('?status=new&payment=unpaid')).total).toBe(3);
    expect((await list('?page=2')).orders.length).toBe(0); // page size is 25
  });
});

describe('upserts and housekeeping', () => {
  it('saves payment settings (insert, then update the same keys)', async () => {
    const env = await testEnv();
    const put = (b: unknown) => send(adminSettings.onRequestPut, env, '/api/admin/settings', 'PUT', b);
    expect((await put({ wallet: '01099999999', walletName: 'Vodafone Cash', deliveryFee: 60, deliveryNote: 'n1' })).status).toBe(200);
    expect((await put({ wallet: '01088888888', walletName: 'Etisalat Cash', deliveryFee: 70, deliveryNote: 'n2' })).status).toBe(200);
    const s = ((await (await get(adminSettings.onRequestGet, env, '/api/admin/settings')).json()) as { settings: Record<string, unknown> }).settings;
    expect(s).toMatchObject({ wallet: '01088888888', walletName: 'Etisalat Cash', deliveryFee: 70, deliveryNote: 'n2' });
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM settings WHERE `key` = 'wallet'").first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });

  it('stores a push subscription once per endpoint and updates it in place', async () => {
    const env = await testEnv({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' });
    const endpoint = 'https://fcm.googleapis.com/fcm/send/' + 'x'.repeat(600); // long endpoints are real
    const sub = (auth: string) => send(adminPush.onRequestPost, env, '/api/admin/push', 'POST', { endpoint, keys: { p256dh: 'k1', auth } });
    expect((await sub('a1')).status).toBe(200);
    expect((await sub('a2')).status).toBe(200);
    const rows = await env.DB.prepare('SELECT auth FROM push_subscriptions').all<{ auth: string }>();
    expect(rows.results).toEqual([{ auth: 'a2' }]);
  });

  it('records a notification, serves the latest one for ten minutes, and sweeps old ones', async () => {
    const env = await testEnv();
    await env.DB.prepare("INSERT INTO notifications (title, body, url, created_at) VALUES ('old', 'b', '/x', '2020-01-01T00:00:00.000Z')").run();
    await notifyAdmins(env, { title: 'New order', body: 'CA-1001', url: '/admin/orders/1' });
    const left = await env.DB.prepare('SELECT title FROM notifications ORDER BY id').all<{ title: string }>();
    expect(left.results.map((r) => r.title)).toEqual(['New order']); // the 2020 one was swept (30 days)
    const n = ((await (await get(latest.onRequestGet, env, '/api/admin/notifications/latest')).json()) as { notification: { title: string } | null }).notification;
    expect(n?.title).toBe('New order');
    await env.DB.prepare("UPDATE notifications SET created_at = '2020-01-01T00:00:00.000Z'").run();
    const none = ((await (await get(latest.onRequestGet, env, '/api/admin/notifications/latest')).json()) as { notification: unknown }).notification;
    expect(none).toBeNull();
  });

  it('writes timestamps in the same ISO format JavaScript produces', async () => {
    const env = await testEnv();
    await createUserSession(env, (await (async () => {
      await env.DB.prepare("INSERT INTO users (email, name) VALUES ('t@test.invalid', 'T')").run();
      return (await env.DB.prepare("SELECT id FROM users WHERE email = 't@test.invalid'").first<{ id: number }>())!.id;
    })()));
    const row = await env.DB.prepare('SELECT created_at FROM users').first<{ created_at: string }>();
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(new Date(row!.created_at).getTime() - Date.now())).toBeLessThan(60_000);
  });
});
