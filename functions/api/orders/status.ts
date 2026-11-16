import type { Fn } from '../../../server/env';
import { HttpError, assertSameOrigin, handle, ipHash, json, rateLimit, readJson, str } from '../../../server/http';
import { TRACKED_SELECT, toTracked, type TrackedRow } from '../../../server/orders';

const MAX_ORDERS = 20;

/**
 * POST /api/orders/status — live status of the orders a browser has saved ("My orders" and the banner).
 * Body: { orders: [{ number, token }] }. Orders whose token doesn't match are left out, so this never
 * confirms that an order number exists.
 */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const hash = await ipHash(request, env.SESSION_SECRET ?? 'cocos');
  await rateLimit(env.DB, `ostatus:${hash}`, 60, 10 * 60);
  const body = await readJson<{ orders?: { number?: unknown; token?: unknown }[] }>(request);
  if (!Array.isArray(body.orders)) throw new HttpError(400, 'Invalid request.');
  const asked = new Map<string, string>();
  for (const o of body.orders.slice(0, MAX_ORDERS)) {
    const number = str(o?.number, 20);
    const token = str(o?.token, 80);
    if (number && token) asked.set(number, token);
  }
  if (asked.size === 0) return json({ orders: [] });
  const numbers = [...asked.keys()];
  const { results } = await env.DB.prepare(`${TRACKED_SELECT} WHERE o.number IN (${numbers.map(() => '?').join(',')}) ORDER BY o.id DESC`)
    .bind(...numbers)
    .all<TrackedRow>();
  return json({ orders: results.filter((r) => asked.get(r.number) === r.token).map(toTracked) });
});
