import type { Fn } from '../../../../server/env';
import { HttpError, assertSameOrigin, handle, ipHash, json, rateLimit, randomToken } from '../../../../server/http';
import { addEvent, getOrderRow } from '../../../../server/orders';
import { notifyAdmins } from '../../../../server/push';

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** POST /api/orders/CA-1001/proof?t=<token> — upload an InstaPay / wallet transfer screenshot. */
export const onRequestPost: Fn<'number'> = handle(async ({ request, env, params, waitUntil }) => {
  assertSameOrigin(request);
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const order = await getOrderRow(env.DB, { number: String(params.number) });
  if (!order || !token || order.token !== token) throw new HttpError(404, 'Order not found.', 'not_found');
  if (order.status === 'cancelled') throw new HttpError(409, 'This order was cancelled.', 'cancelled');
  if (order.payment_status === 'paid') throw new HttpError(409, 'This order is already marked as paid.', 'paid');

  await rateLimit(env.DB, `proof:${await ipHash(request, env.SESSION_SECRET ?? 'cocos')}`, 10, 3600);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'Choose a screenshot to upload.', 'no_file');
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(415, 'Please upload a JPG, PNG or WebP image.', 'bad_type');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'The image is too large (max 6 MB).', 'too_large');

  const key = `proofs/${order.id}/${randomToken(9)}.${ext}`;
  await env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  if (order.proof_key) waitUntil(env.UPLOADS.delete(order.proof_key));

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE orders SET proof_key = ?, payment_status = 'pending_review', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    ).bind(key, order.id),
    addEvent(env.DB, order.id, 'proof', 'العميل رفع صورة التحويل'),
  ]);

  waitUntil(
    notifyAdmins(env, {
      title: `💳 إيصال تحويل ${order.number}`,
      body: `${order.customer_name} رفع صورة التحويل — راجعها وأكّد الدفع`,
      url: `/admin/orders/${order.id}`,
    }),
  );
  return json({ ok: true });
});
