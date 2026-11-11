import type { Fn } from '../../../server/env';
import { handle, json } from '../../../server/http';
import { loadOverrides, products } from '../../../server/catalog';
import type { AdminStats, OrderStatus, PaymentMethod } from '../../../src/lib/api-types';

const ACTIVE = "status != 'cancelled'";

/** GET /api/admin/stats?range=7|30|90 — dashboard numbers and chart data (Cairo days). */
export const onRequestGet: Fn = handle(async ({ request, env }) => {
  const range = [7, 30, 90].includes(Number(new URL(request.url).searchParams.get('range')))
    ? Number(new URL(request.url).searchParams.get('range'))
    : 30;
  const db = env.DB;
  // Egypt is UTC+2/+3; bucketing by +2h keeps late-evening orders on the right day in most of the year.
  const day = "date(created_at, '+2 hours')";
  const since = `strftime('%Y-%m-%dT%H:%M:%fZ','now','-${range} days')`;
  const prev = `strftime('%Y-%m-%dT%H:%M:%fZ','now','-${range * 2} days')`;

  const [cur, before, open, daily, statuses, payments, top, cities, cust, overrides] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS rev, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total END),0) AS paid,
                AVG(total) AS avg FROM orders WHERE ${ACTIVE} AND created_at >= ${since}`).first<{ n: number; rev: number; paid: number; avg: number | null }>(),
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS rev FROM orders WHERE ${ACTIVE} AND created_at >= ${prev} AND created_at < ${since}`).first<{ n: number; rev: number }>(),
    db.prepare(`SELECT SUM(status='new') AS new_orders, SUM(${ACTIVE} AND total IS NULL) AS unpriced, SUM(payment_status='pending_review') AS proofs FROM orders`).first<{ new_orders: number | null; unpriced: number | null; proofs: number | null }>(),
    db.prepare(`SELECT ${day} AS d, COUNT(*) AS n, COALESCE(SUM(total),0) AS rev FROM orders WHERE ${ACTIVE} AND created_at >= ${since} GROUP BY d ORDER BY d`).all<{ d: string; n: number; rev: number }>(),
    db.prepare(`SELECT status, COUNT(*) AS n FROM orders WHERE created_at >= ${since} GROUP BY status`).all<{ status: OrderStatus; n: number }>(),
    db.prepare(`SELECT payment_method AS m, COUNT(*) AS n FROM orders WHERE ${ACTIVE} AND created_at >= ${since} GROUP BY m`).all<{ m: PaymentMethod; n: number }>(),
    db.prepare(`SELECT i.product_id, MAX(i.name) AS name, MAX(i.image) AS image, SUM(i.qty) AS qty, COALESCE(SUM(i.qty * i.unit_price),0) AS rev
                FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.${ACTIVE} AND o.created_at >= ${since}
                GROUP BY i.product_id ORDER BY qty DESC LIMIT 6`).all<{ product_id: string; name: string; image: string | null; qty: number; rev: number }>(),
    db.prepare(`SELECT city, COUNT(*) AS n FROM orders WHERE ${ACTIVE} AND created_at >= ${since} GROUP BY lower(city) ORDER BY n DESC LIMIT 6`).all<{ city: string; n: number }>(),
    db.prepare(`SELECT COUNT(*) AS c, SUM(cnt > 1) AS r FROM (SELECT phone, COUNT(*) AS cnt FROM orders WHERE ${ACTIVE} GROUP BY phone)`).first<{ c: number; r: number | null }>(),
    loadOverrides(db),
  ]);

  // Fill missing days so the chart has a continuous axis.
  const byDay = new Map(daily.results.map((r) => [r.d, r]));
  const days: AdminStats['daily'] = [];
  const today = new Date(Date.now() + 2 * 3600_000);
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(d);
    days.push({ date: d, orders: r?.n ?? 0, revenue: r?.rev ?? 0 });
  }

  const stats: AdminStats = {
    range,
    kpis: {
      orders: cur?.n ?? 0,
      ordersPrev: before?.n ?? 0,
      revenue: cur?.rev ?? 0,
      revenuePrev: before?.rev ?? 0,
      paidRevenue: cur?.paid ?? 0,
      avgOrder: cur?.avg != null ? Math.round(cur.avg) : null,
      newOrders: open?.new_orders ?? 0,
      awaitingPrice: open?.unpriced ?? 0,
      proofsToReview: open?.proofs ?? 0,
      customers: cust?.c ?? 0,
      returningCustomers: cust?.r ?? 0,
    },
    daily: days,
    statuses: statuses.results.map((s) => ({ status: s.status, count: s.n })),
    payments: payments.results.map((p) => ({ method: p.m, count: p.n })),
    topProducts: top.results.map((t) => ({ productId: t.product_id, name: t.name, image: t.image, qty: t.qty, revenue: t.rev })),
    cities: cities.results.map((c) => ({ city: c.city, count: c.n })),
    pricedProducts: Object.values(overrides).filter((o) => o.price !== null).length,
    totalProducts: products.length,
  };
  return json(stats);
});
