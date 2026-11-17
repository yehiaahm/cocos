import type { Fn } from '../../../../server/env';
import { HttpError, handle, intOrNull, json, readJson, str } from '../../../../server/http';
import { PAYMENT_STATUS_AR, STATUS_AR, addEvent, computeTotals, getItems, getOrderRow, promoOf, toAdmin } from '../../../../server/orders';
import { releasePromoUse, retakePromoUse } from '../../../../server/promos';
import { ORDER_STATUSES, PAYMENT_STATUSES, type AdminOrderUpdate } from '../../../../src/lib/api-types';
import { NOW_SQL } from '../../../../server/sql';

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

/** PATCH /api/admin/orders/:id — status, payment status, item prices, delivery fee, internal notes, removing the promo code. */
export const onRequestPatch: Fn<'id'> = handle(async ({ request, env, params }) => {
  const id = idOf(params.id);
  const o = await getOrderRow(env.DB, { id });
  if (!o) throw new HttpError(404, 'الطلب غير موجود', 'not_found');
  const body = await readJson<AdminOrderUpdate>(request);
  const stmts: D1PreparedStatement[] = [];
  const set: string[] = [];
  const args: (string | number | null)[] = [];
  const removingPromo = body.removePromo === true && !!o.promo_code;

  if (body.status !== undefined && body.status !== o.status) {
    if (!ORDER_STATUSES.includes(body.status)) throw new HttpError(400, 'حالة غير صحيحة');
    set.push('status = ?');
    args.push(body.status);
    stmts.push(addEvent(env.DB, id, 'status', `الحالة: ${STATUS_AR[o.status]} ← ${STATUS_AR[body.status]}`, body.status));
    // Cancelling gives the units back to tracked stock; reopening a cancelled order takes them out again.
    const cancelling = body.status === 'cancelled';
    if (cancelling || o.status === 'cancelled') {
      const perProduct = new Map<string, number>();
      for (const i of await getItems(env.DB, id)) perProduct.set(i.productId, (perProduct.get(i.productId) ?? 0) + i.qty);
      for (const [productId, qty] of perProduct) {
        stmts.push(
          env.DB.prepare(
            cancelling
              ? 'UPDATE product_overrides SET stock = stock + ? WHERE product_id = ? AND stock IS NOT NULL'
              : 'UPDATE product_overrides SET stock = GREATEST(stock - ?, 0) WHERE product_id = ? AND stock IS NOT NULL',
          ).bind(qty, productId),
        );
      }
      // The promo code's use follows the order: back to the code on cancel, taken again on reopen.
      if (o.promo_id !== null && !removingPromo) stmts.push(cancelling ? releasePromoUse(env.DB, o.promo_id) : retakePromoUse(env.DB, o.promo_id));
    }
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

  // Shipment details shown to the customer once the order is on its way.
  if (body.courier !== undefined || body.trackingNumber !== undefined) {
    const courier = body.courier !== undefined ? str(body.courier, 60) || null : o.courier;
    const tracking = body.trackingNumber !== undefined ? str(body.trackingNumber, 80) || null : o.tracking_number;
    if (courier !== o.courier || tracking !== o.tracking_number) {
      set.push('courier = ?', 'tracking_number = ?');
      args.push(courier, tracking);
      stmts.push(addEvent(env.DB, id, 'tracking', tracking || courier ? `الشحن: ${[courier, tracking].filter(Boolean).join(' · ')}` : 'تم حذف بيانات الشحن'));
    }
  }

  // Removing the promo code: its use goes back to the code (a cancelled order already gave it back).
  if (removingPromo) {
    set.push('promo_id = NULL', 'promo_code = NULL', 'promo = NULL', 'discount = NULL');
    if (o.promo_id !== null && o.status !== 'cancelled') stmts.push(releasePromoUse(env.DB, o.promo_id));
    stmts.push(addEvent(env.DB, id, 'promo', `تم إلغاء كود الخصم ${o.promo_code}`));
  }

  // Pricing: update line prices and/or delivery fee (or the promo code went), then recompute totals.
  if (body.items !== undefined || body.deliveryFee !== undefined || removingPromo) {
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
    const rules = removingPromo ? null : promoOf(o);
    const { subtotal, discount, total } = computeTotals(items, fee, rules);
    set.push('subtotal = ?', 'delivery_fee = ?', 'total = ?');
    args.push(subtotal, fee, total);
    if (rules) {
      set.push('discount = ?');
      args.push(discount);
    }
    if (total !== o.total) stmts.push(addEvent(env.DB, id, 'pricing', total !== null ? `الإجمالي: ${total} ج.م` : 'تم تحديث الأسعار'));
  }

  if (set.length) {
    set.push(`updated_at = ${NOW_SQL}`);
    stmts.unshift(env.DB.prepare(`UPDATE orders SET ${set.join(', ')} WHERE id = ?`).bind(...args, id));
    await env.DB.batch(stmts);
  }
  const updated = await getOrderRow(env.DB, { id });
  return json({ order: await toAdmin(env.DB, updated!) });
});
