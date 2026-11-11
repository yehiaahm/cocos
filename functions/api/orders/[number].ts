import type { Fn } from '../../../server/env';
import { HttpError, handle, json } from '../../../server/http';
import { getItems, getOrderRow, getSettings, toPublic } from '../../../server/orders';

/** GET /api/orders/CA-1001?t=<token> — the customer's own order page. */
export const onRequestGet: Fn<'number'> = handle(async ({ request, env, params }) => {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const order = await getOrderRow(env.DB, { number: String(params.number) });
  if (!order || !token || order.token !== token) throw new HttpError(404, 'Order not found.', 'not_found');
  const [items, settings] = await Promise.all([getItems(env.DB, order.id), getSettings(env.DB)]);
  return json({ order: toPublic(order, items), payment: settings });
});
