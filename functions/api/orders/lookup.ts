import type { Fn } from '../../../server/env';
import { HttpError, assertSameOrigin, handle, ipHash, json, rateLimit, readJson, str } from '../../../server/http';
import { TRACKED_SELECT, normaliseOrderNumber, toTracked, type TrackedRow } from '../../../server/orders';
import { normaliseEgyptPhone } from '../../../src/lib/phone';

/**
 * POST /api/orders/lookup — a customer who lost their order link finds the order again with its
 * number and the mobile number used at checkout. Wrong number, wrong phone and unknown order all look the same.
 */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const hash = await ipHash(request, env.SESSION_SECRET ?? 'cocos');
  await rateLimit(env.DB, `olookup:${hash}`, 8, 15 * 60);
  const body = await readJson<{ number?: unknown; phone?: unknown }>(request);
  const number = normaliseOrderNumber(str(body.number, 30));
  const phone = normaliseEgyptPhone(str(body.phone, 30));
  if (!number) throw new HttpError(400, 'Enter your order number, e.g. CA-1001.', 'number');
  if (!phone) throw new HttpError(400, 'Enter the mobile number you ordered with, e.g. 010 1234 5678.', 'phone');
  const row = await env.DB.prepare(`${TRACKED_SELECT} WHERE o.number = ? AND o.phone = ?`).bind(number, phone).first<TrackedRow>();
  if (!row) throw new HttpError(404, "We couldn't find an order with those details. Check the number and the mobile you ordered with.", 'not_found');
  return json({ order: toTracked(row) });
});
