import type { Fn } from '../../../server/env';
import { handle, json } from '../../../server/http';
import { requireUser } from '../../../server/accounts';
import type { AccountOrderSummary } from '../../../src/lib/api-types';

interface Row {
  number: string;
  token: string;
  status: AccountOrderSummary['status'];
  payment_status: AccountOrderSummary['paymentStatus'];
  total: number | null;
  created_at: string;
  item_count: number;
  image: string | null;
}

/** GET /api/account/orders — the signed-in customer's orders, newest first. */
export const onRequestGet: Fn = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const { results } = await env.DB.prepare(
    `SELECT o.number, o.token, o.status, o.payment_status, o.total, o.created_at,
            (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id) AS item_count,
            (SELECT image FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image
     FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 100`,
  )
    .bind(user.id)
    .all<Row>();
  const orders: AccountOrderSummary[] = results.map((r) => ({
    number: r.number,
    token: r.token,
    status: r.status,
    paymentStatus: r.payment_status,
    total: r.total,
    itemCount: r.item_count,
    image: r.image,
    createdAt: r.created_at,
  }));
  return json({ orders });
});
