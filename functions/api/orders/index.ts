import type { Fn } from '../../../server/env';
import { HttpError, assertNotLocked, assertSameOrigin, handle, ipHash, json, rateLimit, randomToken, readJson, recordFailure, str } from '../../../server/http';
import { isSoldOut, loadCatalog, loadOverrides, overrideFor } from '../../../server/catalog';
import { addEvent, computeTotals, getSettings } from '../../../server/orders';
import {
  PROMO_FAIL_LIMIT,
  PROMO_FAIL_WINDOW,
  assertUsable,
  findPromoByCode,
  releasePromoUse,
  reservePromoUse,
  rulesOf,
  usesByPhone,
  type PromoRow,
} from '../../../server/promos';
import { normalisePromoCode } from '../../../src/lib/promo';
import { notifyAdmins } from '../../../server/push';
import { getSessionUser } from '../../../server/accounts';
import { normaliseEgyptPhone } from '../../../src/lib/phone';
import { PAYMENT_METHODS, type CreateOrderInput, type PaymentMethod } from '../../../src/lib/api-types';

/** POST /api/orders — the storefront checkout. Prices are always taken from the server, never the client. */
export const onRequestPost: Fn = handle(async ({ request, env, waitUntil }) => {
  assertSameOrigin(request);
  // Throttle before reading the body, so oversized/garbage requests cost the sender their allowance.
  const hash = await ipHash(request, env.SESSION_SECRET ?? 'cocos');
  await rateLimit(env.DB, `order:${hash}`, 6, 15 * 60);
  const body = await readJson<CreateOrderInput>(request);

  // Bots fill every field; people never see this one.
  if (body.website) return json({ error: 'Rejected' }, { status: 400 });

  const name = str(body.customer?.name, 80);
  const phone = normaliseEgyptPhone(str(body.customer?.phone, 30));
  const city = str(body.customer?.city, 60);
  const address = str(body.customer?.address, 400);
  const notes = str(body.customer?.notes, 1000) || null;
  const method = body.paymentMethod as PaymentMethod;

  if (name.length < 2) throw new HttpError(400, 'Please enter your name.', 'name');
  if (!phone) throw new HttpError(400, 'Enter an Egyptian mobile number, e.g. 010 1234 5678.', 'phone');
  if (city.length < 2) throw new HttpError(400, 'Please enter your city or governorate.', 'city');
  if (address.length < 6) throw new HttpError(400, 'Please enter a delivery address.', 'address');
  if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, 'Choose a payment method.', 'payment');
  if (!Array.isArray(body.items) || body.items.length === 0) throw new HttpError(400, 'Your cart is empty.', 'empty');
  if (body.items.length > 40) throw new HttpError(400, 'Too many items in one order.', 'too_many');

  const [catalog, overrides] = await Promise.all([loadCatalog(env.DB), loadOverrides(env.DB)]);
  const lines = body.items.map((raw) => {
    const p = catalog.byId.get(str(raw.productId, 20));
    const v = p?.variants.find((x) => x.catalogId === str(raw.variantId, 20));
    const o = p ? overrideFor(overrides, p.id) : null;
    if (!p || !v || o?.hidden) throw new HttpError(409, 'Something in your cart is no longer available. Please review your cart.', 'unavailable');
    if (o && isSoldOut(o)) throw new HttpError(409, `${p.name} is sold out. Please remove it from your cart.`, 'sold_out');
    const qty = Math.floor(Number(raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) throw new HttpError(400, 'Invalid quantity.', 'qty');
    const personalisation = p.tags.includes('personalised') ? str(raw.personalisation, 80) || null : null;
    return {
      productId: p.id,
      variantId: v.catalogId,
      name: p.name,
      variantName: p.variants.length > 1 ? v.name : null,
      image: v.images[0] ?? p.image,
      qty,
      personalisation,
      unitPrice: o?.price ?? null,
    };
  });

  // Tracked stock (set in the dashboard): all variants of a product draw from the same pool.
  const wanted = new Map<string, { name: string; qty: number }>();
  for (const l of lines) {
    const w = wanted.get(l.productId) ?? { name: l.name, qty: 0 };
    w.qty += l.qty;
    wanted.set(l.productId, w);
  }
  for (const [productId, w] of wanted) {
    const stock = overrideFor(overrides, productId).stock;
    if (typeof stock === 'number' && w.qty > stock) {
      throw new HttpError(409, `Only ${stock} of ${w.name} left. Please lower the quantity in your cart.`, 'out_of_stock');
    }
  }

  const settings = await getSettings(env.DB);

  // Promo code: checked again here whatever the browser said; the discount is always worked out on the server.
  let promo: PromoRow | null = null;
  const promoCode = normalisePromoCode(body.promoCode);
  if (promoCode) {
    const failBucket = `promofail:${hash}`;
    await assertNotLocked(env.DB, failBucket, PROMO_FAIL_LIMIT, PROMO_FAIL_WINDOW);
    const found = await findPromoByCode(env.DB, promoCode);
    if (!found) await recordFailure(env.DB, failBucket);
    assertUsable(found);
    promo = found;
  }
  const rules = promo ? rulesOf(promo) : null;
  const { subtotal, discount, total } = computeTotals(lines, settings.deliveryFee, rules);
  if (promo && rules && subtotal !== null && rules.minSubtotal !== null && subtotal < rules.minSubtotal) {
    throw new HttpError(400, `This code needs an order of at least EGP ${rules.minSubtotal}. Add EGP ${rules.minSubtotal - subtotal} more to use it.`, 'promo');
  }
  if (promo && promo.per_customer_limit !== null && (await usesByPhone(env.DB, promo.id, phone)) >= promo.per_customer_limit) {
    throw new HttpError(400, 'You’ve already used this promo code.', 'promo');
  }
  // Take one use now (atomic): if the last use of a limited code just went to someone else, say so.
  if (promo && !(await reservePromoUse(env.DB, promo.id))) throw new HttpError(409, 'This promo code has just been fully redeemed.', 'promo');

  const token = randomToken();
  // Signed-in customers: the order joins their account and their delivery details are remembered.
  const user = await getSessionUser(env, request);

  // One transaction: order, its number (CA-1001…), items, first timeline event.
  const stmts = [
    env.DB.prepare(
      `INSERT INTO orders (token, payment_method, customer_name, phone, city, address, notes, subtotal, delivery_fee, total, ip_hash, user_id,
                           promo_id, promo_code, promo, discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      token, method, name, phone, city, address, notes, subtotal, settings.deliveryFee, total, hash, user?.id ?? null,
      promo?.id ?? null, promo?.code ?? null, rules ? JSON.stringify(rules) : null, promo ? discount : null,
    ),
    ...(user ? [env.DB.prepare('UPDATE users SET phone = ?, city = ?, address = ? WHERE id = ?').bind(phone, city, address, user.id)] : []),
    env.DB.prepare("UPDATE orders SET number = 'CA-' || (1000 + id) WHERE token = ?").bind(token),
    ...lines.map((l) =>
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_name, image, qty, personalisation, unit_price)
         VALUES ((SELECT id FROM orders WHERE token = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(token, l.productId, l.variantId, l.name, l.variantName, l.image, l.qty, l.personalisation, l.unitPrice),
    ),
    // Takes the units out of tracked stock (never below 0); products without a stock number are untouched.
    ...[...wanted].map(([productId, w]) =>
      env.DB.prepare('UPDATE product_overrides SET stock = MAX(stock - ?, 0) WHERE product_id = ? AND stock IS NOT NULL').bind(w.qty, productId),
    ),
  ];
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    // The order wasn't saved: give the reserved use back.
    if (promo) await releasePromoUse(env.DB, promo.id).run().catch(() => undefined);
    throw e;
  }
  const row = await env.DB.prepare('SELECT id, number FROM orders WHERE token = ?').bind(token).first<{ id: number; number: string }>();
  if (!row) throw new HttpError(500, 'Order could not be saved. Please try again.');
  await addEvent(env.DB, row.id, 'created', 'تم استلام الطلب من الموقع').run();
  if (promo) await addEvent(env.DB, row.id, 'promo', `كود خصم: ${promo.code}${discount ? ` (−${discount} ج.م)` : ''}`).run();

  const pieces = lines.reduce((t, l) => t + l.qty, 0);
  const methodAr = { cod: 'كاش عند الاستلام', instapay: 'إنستاباي', wallet: 'محفظة' }[method];
  waitUntil(
    notifyAdmins(env, {
      title: `🛍️ طلب جديد ${row.number}`,
      body: `${name} · ${city}\n${pieces} قطعة · ${methodAr}${total !== null ? ` · ${total} ج.م` : ''}${promo ? ` · 🏷️ ${promo.code}` : ''}`,
      url: `/admin/orders/${row.id}`,
    }),
  );

  return json({ number: row.number, token }, { status: 201 });
});
