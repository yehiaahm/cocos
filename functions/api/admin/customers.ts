import type { Fn } from '../../../server/env';
import { handle, json } from '../../../server/http';
import type { AdminCustomer } from '../../../src/lib/api-types';

/** GET /api/admin/customers?q= — customers are grouped by phone number. */
export const onRequestGet: Fn = handle(async ({ request, env }) => {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  const digits = q.replace(/\D/g, '');
  const filter = q ? `HAVING name LIKE ?1 OR city LIKE ?1${digits.length >= 3 ? ' OR phone LIKE ?2' : ''}` : '';
  const stmt = env.DB.prepare(
    `SELECT phone,
            (SELECT customer_name FROM orders o2 WHERE o2.phone = o.phone ORDER BY id DESC LIMIT 1) AS name,
            (SELECT city FROM orders o2 WHERE o2.phone = o.phone ORDER BY id DESC LIMIT 1) AS city,
            (SELECT number FROM orders o2 WHERE o2.phone = o.phone ORDER BY id DESC LIMIT 1) AS last_number,
            SUM(status != 'cancelled') AS orders,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total END), 0) AS spent,
            MIN(created_at) AS first_order, MAX(created_at) AS last_order
     FROM orders o GROUP BY phone ${filter} ORDER BY last_order DESC LIMIT 300`,
  );
  const bound = q ? (digits.length >= 3 ? stmt.bind(`%${q}%`, `%${digits.replace(/^20/, '0')}%`) : stmt.bind(`%${q}%`)) : stmt;
  const { results } = await bound.all<{
    phone: string;
    name: string;
    city: string;
    last_number: string;
    orders: number;
    spent: number;
    first_order: string;
    last_order: string;
  }>();
  const customers: AdminCustomer[] = results.map((r) => ({
    phone: r.phone,
    name: r.name,
    city: r.city,
    orders: r.orders,
    spent: r.spent,
    firstOrder: r.first_order,
    lastOrder: r.last_order,
    lastOrderNumber: r.last_number,
  }));
  return json({ customers });
});
