// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createTestDb } from './testDb';
import type { Env } from './env';
import { createProduct } from './catalogAdmin';
import { computeDiscount, orderTotals, type PromoRules } from '../src/lib/promo';
import * as checkout from '../functions/api/orders/index';
import * as adminOrder from '../functions/api/admin/orders/[id]';
import * as adminPromos from '../functions/api/admin/promos';
import * as adminPromo from '../functions/api/admin/promos/[id]';
import * as promoCheck from '../functions/api/promo';
import * as publicCatalog from '../functions/api/catalog';
import * as publicOrder from '../functions/api/orders/[number]';
import type { AdminOrder, AdminPromo, AdminPromoInput, PublicOrder, PublicPromo } from '../src/lib/api-types';

type Handler = (c: unknown) => Promise<Response>;
const call = (h: unknown, ctx: Record<string, unknown>) => (h as Handler)({ params: {}, waitUntil: () => undefined, ...ctx });
const jsonReq = (url: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://shop.example${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const setup = async (deliveryFee: number | null = 50) => {
  const db = await createTestDb();
  const env = { DB: db, SESSION_SECRET: 'test-secret-'.repeat(4) } as unknown as Env;
  if (deliveryFee !== null) await env.DB.prepare("INSERT INTO settings (`key`, `value`) VALUES ('deliveryFee', ?)").bind(String(deliveryFee)).run();
  return env;
};
const photo = { catalogId: '', name: 'Grey', material: 'Concrete', images: ['/media/catalog/abc123.jpg'] };
const makeProduct = (env: Env, price: number | null = 200) =>
  createProduct(env.DB, { name: `Planter ${Math.random()}`, category: 'concrete', description: '', tags: [], variants: [photo], price });

const base: AdminPromoInput = {
  code: 'EID15',
  type: 'percent',
  value: 15,
  minSubtotal: null,
  maxDiscount: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perCustomerLimit: null,
  active: true,
  banner: false,
  bannerText: '',
  note: '',
};
const createPromo = async (env: Env, over: Partial<AdminPromoInput> = {}) => {
  const res = await call(adminPromos.onRequestPost, { env, request: jsonReq('/api/admin/promos', 'POST', { ...base, ...over }) });
  return { res, body: (await res.json()) as { promo: AdminPromo; code?: string } };
};
const patchPromo = async (env: Env, id: number, body: Partial<AdminPromoInput>) =>
  call(adminPromo.onRequestPatch, { env, params: { id: String(id) }, request: jsonReq(`/api/admin/promos/${id}`, 'PATCH', body) });

let ipSeq = 0;
const placeOrder = async (
  env: Env,
  p: { id: string; variants: { catalogId: string }[] },
  opts: { qty?: number; promoCode?: string; phone?: string; ip?: string } = {},
) => {
  const res = await call(checkout.onRequestPost, {
    env,
    request: jsonReq(
      '/api/orders',
      'POST',
      {
        customer: { name: 'Test Customer', phone: opts.phone ?? '01012345678', city: 'Cairo', address: '1 Test Street, Cairo' },
        paymentMethod: 'cod',
        items: [{ productId: p.id, variantId: p.variants[0].catalogId, qty: opts.qty ?? 1 }],
        ...(opts.promoCode !== undefined ? { promoCode: opts.promoCode } : {}),
      },
      { 'x-client-ip': opts.ip ?? `10.1.0.${++ipSeq}` },
    ),
  });
  return { res, body: (await res.json()) as { number?: string; token?: string; error?: string; code?: string } };
};
const getOrder = async (env: Env, id: number) =>
  ((await (await call(adminOrder.onRequestGet, { env, params: { id: String(id) } })).json()) as { order: AdminOrder }).order;
const patchOrder = async (env: Env, id: number, body: unknown) =>
  ((await (await call(adminOrder.onRequestPatch, { env, params: { id: String(id) }, request: jsonReq(`/api/admin/orders/${id}`, 'PATCH', body) })).json()) as {
    order: AdminOrder;
  }).order;
const usedCount = async (env: Env, code: string) =>
  (await env.DB.prepare('SELECT used_count AS n FROM promo_codes WHERE code = ?').bind(code).first<{ n: number }>())?.n;

describe('discount maths', () => {
  const pct = (value: number, extra: Partial<PromoRules> = {}): PromoRules => ({ type: 'percent', value, minSubtotal: null, maxDiscount: null, ...extra });

  it('takes a percentage off the products (rounded down), capped by the maximum', () => {
    expect(computeDiscount(pct(15), 999, 50)).toBe(149);
    expect(computeDiscount(pct(50, { maxDiscount: 200 }), 1000, 50)).toBe(200);
  });
  it('never takes off more than the products cost', () => {
    expect(computeDiscount({ type: 'fixed', value: 500, minSubtotal: null, maxDiscount: null }, 300, 50)).toBe(300);
    expect(orderTotals([{ qty: 1, unitPrice: 300 }], 50, { type: 'fixed', value: 500, minSubtotal: null, maxDiscount: null }).total).toBe(50);
  });
  it('gives nothing below the minimum order', () => {
    expect(computeDiscount(pct(10, { minSubtotal: 500 }), 499, 50)).toBe(0);
    expect(computeDiscount(pct(10, { minSubtotal: 500 }), 500, 50)).toBe(50);
  });
  it('free delivery waives the fee, and waits for it to be known', () => {
    const free: PromoRules = { type: 'free_shipping', value: 0, minSubtotal: null, maxDiscount: null };
    expect(orderTotals([{ qty: 2, unitPrice: 100 }], 60, free)).toEqual({ subtotal: 200, discount: 60, total: 200 });
    expect(orderTotals([{ qty: 2, unitPrice: 100 }], null, free)).toEqual({ subtotal: 200, discount: null, total: null });
  });
  it('waits for every price before working out a discount', () => {
    expect(orderTotals([{ qty: 1, unitPrice: 100 }, { qty: 1, unitPrice: null }], 50, pct(10))).toEqual({ subtotal: null, discount: null, total: null });
  });
});

describe('promo codes in the dashboard', () => {
  it('validates codes and rules', async () => {
    const env = await setup();
    expect((await createPromo(env, { code: 'x' })).body.code).toBe('promo_code_invalid');
    expect((await createPromo(env, { value: 120 })).body.code).toBe('promo_value_percent');
    expect((await createPromo(env, { type: 'fixed', value: null })).body.code).toBe('promo_value_fixed');
    expect((await createPromo(env, { startsAt: '2030-02-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' })).body.code).toBe('promo_dates');

    const ok = await createPromo(env, { code: ' eid 15 ', maxDiscount: 300 });
    expect(ok.res.status).toBe(201);
    expect(ok.body.promo).toMatchObject({ code: 'EID15', type: 'percent', value: 15, maxDiscount: 300, state: 'active', usedCount: 0 });
    expect((await createPromo(env, { code: 'Eid15' })).body.code).toBe('promo_code_taken');
  });

  it('works out the state: scheduled, expired, paused', async () => {
    const env = await setup();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect((await createPromo(env, { code: 'SOON', startsAt: future })).body.promo.state).toBe('scheduled');
    expect((await createPromo(env, { code: 'OLD', endsAt: past })).body.promo.state).toBe('expired');
    expect((await createPromo(env, { code: 'PAUSED', active: false })).body.promo.state).toBe('paused');
  });

  it('announces one code at a time in the top bar of the shop', async () => {
    const env = await setup();
    const a = (await createPromo(env, { code: 'FIRST', banner: true, bannerText: 'Eid sale!' })).body.promo;
    const catalog = async () =>
      ((await (await call(publicCatalog.onRequestGet, { env, request: new Request('https://x/api/catalog') })).json()) as { promo: PublicPromo | null }).promo;
    expect(await catalog()).toMatchObject({ code: 'FIRST', type: 'percent', value: 15, bannerText: 'Eid sale!' });

    const b = (await createPromo(env, { code: 'SECOND', banner: true })).body.promo;
    expect((await catalog())?.code).toBe('SECOND');
    const list = ((await (await call(adminPromos.onRequestGet, { env })).json()) as { promos: AdminPromo[] }).promos;
    expect(list.find((p) => p.id === a.id)?.banner).toBe(false);

    await patchPromo(env, b.id, { active: false }); // paused codes are never announced
    expect(await catalog()).toBeNull();
  });
});

describe('promo codes at checkout', () => {
  it('checks a code for the cart, and refuses unknown, paused and expired ones', async () => {
    const env = await setup();
    await createPromo(env, { code: 'GOOD', minSubtotal: 400 });
    await createPromo(env, { code: 'STOPPED', active: false });
    await createPromo(env, { code: 'GONE', endsAt: new Date(Date.now() - 1000).toISOString() });
    const check = async (code: string) => {
      const res = await call(promoCheck.onRequestPost, { env, request: jsonReq('/api/promo', 'POST', { code }, { 'x-client-ip': '10.9.9.9' }) });
      return { status: res.status, body: (await res.json()) as { promo?: PublicPromo; error?: string } };
    };
    const good = await check('good');
    expect(good.status).toBe(200);
    expect(good.body.promo).toEqual({ code: 'GOOD', type: 'percent', value: 15, minSubtotal: 400, maxDiscount: null, endsAt: null, bannerText: '' });
    expect((await check('NOPE')).body.error).toMatch(/isn’t valid/);
    expect((await check('STOPPED')).body.error).toMatch(/no longer available/);
    expect((await check('GONE')).body.error).toMatch(/expired/);
  });

  it('stops guessing after 10 wrong codes', async () => {
    const env = await setup();
    const check = (code: string) => call(promoCheck.onRequestPost, { env, request: jsonReq('/api/promo', 'POST', { code }, { 'x-client-ip': '10.7.7.7' }) });
    for (let i = 0; i < 10; i++) expect((await check(`WRONG${i}`)).status).toBe(400);
    expect((await check('WRONG99')).status).toBe(429);
  });

  it('saves the discount on the order, server-side, and shows it to the customer', async () => {
    const env = await setup(50);
    await createPromo(env, { code: 'EID15', maxDiscount: 100 });
    const p = await makeProduct(env, 400);
    const { res, body } = await placeOrder(env, p, { qty: 2, promoCode: 'eid15' });
    expect(res.status).toBe(201);
    const o = await getOrder(env, 1);
    // 15% of 800 = 120, capped at 100
    expect(o).toMatchObject({ subtotal: 800, discount: 100, deliveryFee: 50, total: 750, promoCode: 'EID15' });
    expect(o.promo).toEqual({ type: 'percent', value: 15, minSubtotal: null, maxDiscount: 100 });
    expect(await usedCount(env, 'EID15')).toBe(1);

    const pub = await call(publicOrder.onRequestGet, { env, params: { number: body.number }, request: new Request(`https://x/api/orders/${body.number}?t=${body.token}`) });
    expect(((await pub.json()) as { order: PublicOrder }).order).toMatchObject({ promoCode: 'EID15', discount: 100, total: 750 });
  });

  it('refuses a code below its minimum order', async () => {
    const env = await setup();
    await createPromo(env, { code: 'BIG', minSubtotal: 1000 });
    const p = await makeProduct(env, 400);
    const r = await placeOrder(env, p, { promoCode: 'BIG' });
    expect(r.res.status).toBe(400);
    expect(r.body.code).toBe('promo');
    expect(r.body.error).toMatch(/EGP 600 more/);
    expect(await usedCount(env, 'BIG')).toBe(0);
  });

  it('enforces the total and per-customer limits, and gives the use back on cancel', async () => {
    const env = await setup();
    await createPromo(env, { code: 'TWO', usageLimit: 2, perCustomerLimit: 1 });
    const p = await makeProduct(env);
    expect((await placeOrder(env, p, { promoCode: 'TWO', phone: '01011111111' })).res.status).toBe(201);
    const again = await placeOrder(env, p, { promoCode: 'TWO', phone: '01011111111' });
    expect(again.body).toMatchObject({ code: 'promo', error: expect.stringMatching(/already used/) });
    expect((await placeOrder(env, p, { promoCode: 'TWO', phone: '01022222222' })).res.status).toBe(201);
    const full = await placeOrder(env, p, { promoCode: 'TWO', phone: '01033333333' });
    expect(full.body).toMatchObject({ code: 'promo', error: expect.stringMatching(/fully redeemed/) });
    expect(await usedCount(env, 'TWO')).toBe(2);

    await patchOrder(env, 1, { status: 'cancelled' });
    expect(await usedCount(env, 'TWO')).toBe(1);
    expect((await placeOrder(env, p, { promoCode: 'TWO', phone: '01033333333' })).res.status).toBe(201);
    await patchOrder(env, 1, { status: 'new' }); // reopening takes the use again
    expect(await usedCount(env, 'TWO')).toBe(3);
  });

  it('works out the discount once the owner prices the order, and can remove the code', async () => {
    const env = await setup(null);
    await createPromo(env, { code: 'TENOFF', type: 'fixed', value: 100 });
    const p = await makeProduct(env, null);
    expect((await placeOrder(env, p, { promoCode: 'TENOFF' })).res.status).toBe(201);
    let o = await getOrder(env, 1);
    expect(o).toMatchObject({ subtotal: null, discount: null, total: null, promoCode: 'TENOFF' });

    // Editing the code later must not change the order's own copy of the rules.
    const id = (await env.DB.prepare("SELECT id FROM promo_codes WHERE code = 'TENOFF'").first<{ id: number }>())!.id;
    await patchPromo(env, id, { value: 999 });

    o = await patchOrder(env, 1, { items: [{ id: o.items[0].id, unitPrice: 450 }], deliveryFee: 60 });
    expect(o).toMatchObject({ subtotal: 450, discount: 100, deliveryFee: 60, total: 410 });

    o = await patchOrder(env, 1, { removePromo: true });
    expect(o).toMatchObject({ promoCode: null, discount: 0, total: 510 });
    expect(await usedCount(env, 'TENOFF')).toBe(0);
  });

  it('keeps orders without a code exactly as before', async () => {
    const env = await setup(50);
    const p = await makeProduct(env, 300);
    expect((await placeOrder(env, p)).res.status).toBe(201);
    expect(await getOrder(env, 1)).toMatchObject({ subtotal: 300, discount: 0, total: 350, promoCode: null, promo: null });
  });
});
