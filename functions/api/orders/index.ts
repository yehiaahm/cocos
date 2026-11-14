import type { Fn } from '../../../server/env';
import { HttpError, assertSameOrigin, handle, ipHash, json, rateLimit, randomToken, readJson, str } from '../../../server/http';
import { getProduct, loadOverrides, overrideFor } from '../../../server/catalog';
import { addEvent, computeTotals, getSettings } from '../../../server/orders';
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

  const overrides = await loadOverrides(env.DB);
  const lines = body.items.map((raw) => {
    const p = getProduct(str(raw.productId, 20));
    const v = p?.variants.find((x) => x.catalogId === str(raw.variantId, 20));
    const o = p ? overrideFor(overrides, p.id) : null;
    if (!p || !v || o?.hidden) throw new HttpError(409, 'Something in your cart is no longer available. Please review your cart.', 'unavailable');
    if (o?.soldOut) throw new HttpError(409, `${p.name} is sold out. Please remove it from your cart.`, 'sold_out');
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

  const settings = await getSettings(env.DB);
  const { subtotal, total } = computeTotals(lines, settings.deliveryFee);
  const token = randomToken();
  // Signed-in customers: the order joins their account and their delivery details are remembered.
  const user = await getSessionUser(env, request);

  // One transaction: order, its number (CA-1001…), items, first timeline event.
  const stmts = [
    env.DB.prepare(
      `INSERT INTO orders (token, payment_method, customer_name, phone, city, address, notes, subtotal, delivery_fee, total, ip_hash, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(token, method, name, phone, city, address, notes, subtotal, settings.deliveryFee, total, hash, user?.id ?? null),
    ...(user ? [env.DB.prepare('UPDATE users SET phone = ?, city = ?, address = ? WHERE id = ?').bind(phone, city, address, user.id)] : []),
    env.DB.prepare("UPDATE orders SET number = 'CA-' || (1000 + id) WHERE token = ?").bind(token),
    ...lines.map((l) =>
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_name, image, qty, personalisation, unit_price)
         VALUES ((SELECT id FROM orders WHERE token = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(token, l.productId, l.variantId, l.name, l.variantName, l.image, l.qty, l.personalisation, l.unitPrice),
    ),
  ];
  await env.DB.batch(stmts);
  const row = await env.DB.prepare('SELECT id, number FROM orders WHERE token = ?').bind(token).first<{ id: number; number: string }>();
  if (!row) throw new HttpError(500, 'Order could not be saved. Please try again.');
  await addEvent(env.DB, row.id, 'created', 'تم استلام الطلب من الموقع').run();

  const pieces = lines.reduce((t, l) => t + l.qty, 0);
  const methodAr = { cod: 'كاش عند الاستلام', instapay: 'إنستاباي', wallet: 'محفظة' }[method];
  waitUntil(
    notifyAdmins(env, {
      title: `🛍️ طلب جديد ${row.number}`,
      body: `${name} · ${city}\n${pieces} قطعة · ${methodAr}${total !== null ? ` · ${total} ج.م` : ''}`,
      url: `/admin/orders/${row.id}`,
    }),
  );

  return json({ number: row.number, token }, { status: 201 });
});
