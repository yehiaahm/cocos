import type { Fn } from '../../../../server/env';
import { HttpError, handle, intOrNull, json, readJson, str } from '../../../../server/http';
import { PAYMENT_STATUS_AR, STATUS_AR, addEvent, computeTotals, getItems, getOrderRow, toAdmin } from '../../../../server/orders';
import { ORDER_STATUSES, PAYMENT_STATUSES, type AdminOrderUpdate } from '../../../../src/lib/api-types';

const idOf = (p: string | string[]) => {
  const n = Number(Array.isArray(p) ? p[0] : p);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'الطلب غير موجود', 'not_found');
  return n;
};

/** GET /api/admin/orders/:id */
export const onRequestGet: Fn<'id'> = handle(async ({ env, params }) => {
  const o = await getOrderRow(env.DB, { id: idOf(params.id) });
  if (!o) throw new HttpError(404, 'الطلب غير موجود', 'not_found');
  return json({ order: await toAdmin(env.DB, o) });
});

/** PATCH /api/admin/orders/:id — status, payment status, item prices, delivery fee, internal notes. */
export const onRequestPatch: Fn<'id'> = handle(async ({ request, env, params }) => {
  const id = idOf(params.id);
  const o = await getOrderRow(env.DB, { id });
  if (!o) throw new HttpError(404, 'الطلب غير موجود', 'not_found');
  const body = await readJson<AdminOrderUpdate>(request);
  const stmts: D1PreparedStatement[] = [];
  const set: string[] = [];
  const args: (string | number | null)[] = [];

  if (body.status !== undefined && body.status !== o.status) {
    if (!ORDER_STATUSES.includes(body.status)) throw new HttpError(400, 'حالة غير صحيحة');
    set.push('status = ?');
    args.push(body.status);
    stmts.push(addEvent(env.DB, id, 'status', `الحالة: ${STATUS_AR[o.status]} ← ${STATUS_AR[body.status]}`));
  }
  if (body.paymentStatus !== undefined && body.paymentStatus !== o.payment_status) {
    if (!PAYMENT_STATUSES.includes(body.paymentStatus)) throw new HttpError(400, 'حالة دفع غير صحيحة');
    set.push('payment_status = ?');
    args.push(body.paymentStatus);
    stmts.push(addEvent(env.DB, id, 'payment', `الدفع: ${PAYMENT_STATUS_AR[o.payment_status]} ← ${PAYMENT_STATUS_AR[body.paymentStatus]}`));
  }
  if (body.adminNotes !== undefined) {
    set.push('admin_notes = ?');
    args.push(str(body.adminNotes, 2000) || null);
  }

  // Pricing: update line prices and/or delivery fee, then recompute totals.
  if (body.items !== undefined || body.deliveryFee !== undefined) {
    const items = await getItems(env.DB, id);
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const u of body.items ?? []) {
      const item = byId.get(Number(u.id));
      if (!item) throw new HttpError(400, 'صنف غير موجود في الطلب');
      const price = intOrNull(u.unitPrice, { max: 1_000_000 });
      if (price !== item.unitPrice) {
        item.unitPrice = price;
        stmts.push(env.DB.prepare('UPDATE order_items SET unit_price = ? WHERE id = ? AND order_id = ?').bind(price, item.id, id));
      }
    }
    const fee = body.deliveryFee !== undefined ? intOrNull(body.deliveryFee, { max: 100_000 }) : o.delivery_fee;
    const { subtotal, total } = computeTotals(items, fee);
    set.push('subtotal = ?', 'delivery_fee = ?', 'total = ?');
    args.push(subtotal, fee, total);
    if (total !== o.total) stmts.push(addEvent(env.DB, id, 'pricing', total !== null ? `الإجمالي: ${total} ج.م` : 'تم تحديث الأسعار'));
  }

  if (set.length) {
    set.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    stmts.unshift(env.DB.prepare(`UPDATE orders SET ${set.join(', ')} WHERE id = ?`).bind(...args, id));
    await env.DB.batch(stmts);
  }
  const updated = await getOrderRow(env.DB, { id });
  return json({ order: await toAdmin(env.DB, updated!) });
});
