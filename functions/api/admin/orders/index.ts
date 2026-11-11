import type { Fn } from '../../../../server/env';
import { handle, json } from '../../../../server/http';
import { toSummary, type OrderRow } from '../../../../server/orders';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../../../src/lib/api-types';

/** GET /api/admin/orders?status=&payment=&q=&page= */
export const onRequestGet: Fn = handle(async ({ request, env }) => {
  const sp = new URL(request.url).searchParams;
  const status = sp.get('status') ?? '';
  const payment = sp.get('payment') ?? '';
  const q = (sp.get('q') ?? '').trim().slice(0, 60);
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const size = 25;

  const where: string[] = [];
  const args: (string | number)[] = [];
  if ((ORDER_STATUSES as string[]).includes(status)) {
    where.push('o.status = ?');
    args.push(status);
  }
  if ((PAYMENT_STATUSES as string[]).includes(payment)) {
    where.push('o.payment_status = ?');
    args.push(payment);
  }
  if (q) {
    const digits = q.replace(/\D/g, '');
    where.push(`(o.number LIKE ? OR o.customer_name LIKE ? OR o.city LIKE ?${digits.length >= 3 ? ' OR o.phone LIKE ?' : ''})`);
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    if (digits.length >= 3) args.push(`%${digits.replace(/^20/, '0')}%`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows, total, counts] = await Promise.all([
    env.DB.prepare(
      `SELECT o.*, (SELECT COALESCE(SUM(qty),0) FROM order_items i WHERE i.order_id = o.id) AS item_count
       FROM orders o ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...args, size, (page - 1) * size)
      .all<OrderRow & { item_count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM orders o ${w}`).bind(...args).first<{ n: number }>(),
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all<{ status: string; n: number }>(),
  ]);

  return json({
    orders: rows.results.map(toSummary),
    total: total?.n ?? 0,
    page,
    pageSize: size,
    counts: Object.fromEntries(counts.results.map((c) => [c.status, c.n])),
  });
});
