import type { Fn } from '../../../server/env';
import { handle, json } from '../../../server/http';
import { pushConfigured } from '../../../server/push';

/** GET /api/admin/me — session check + what the dashboard needs to boot. */
export const onRequestGet: Fn = handle(async ({ env }) => {
  const counts = await env.DB.prepare(
    "SELECT SUM(status = 'new') AS new_orders, SUM(payment_status = 'pending_review') AS proofs FROM orders",
  ).first<{ new_orders: number | null; proofs: number | null }>();
  return json({
    ok: true,
    vapidPublicKey: pushConfigured(env) ? env.VAPID_PUBLIC_KEY : null,
    badges: { newOrders: counts?.new_orders ?? 0, proofs: counts?.proofs ?? 0 },
  });
});
