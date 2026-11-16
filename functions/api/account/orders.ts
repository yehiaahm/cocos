import type { Fn } from '../../../server/env';
import { handle, json } from '../../../server/http';
import { requireUser } from '../../../server/accounts';
import { TRACKED_SELECT, toTracked, type TrackedRow } from '../../../server/orders';

/** GET /api/account/orders — the signed-in customer's orders, newest first. */
export const onRequestGet: Fn = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const { results } = await env.DB.prepare(`${TRACKED_SELECT} WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 100`).bind(user.id).all<TrackedRow>();
  return json({ orders: results.map(toTracked) });
});
