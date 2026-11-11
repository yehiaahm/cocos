import type { Fn } from '../../../../../server/env';
import { HttpError, handle } from '../../../../../server/http';
import { getOrderRow } from '../../../../../server/orders';

/** GET /api/admin/orders/:id/proof — the transfer screenshot (admin only, via middleware). */
export const onRequestGet: Fn<'id'> = handle(async ({ env, params }) => {
  const o = await getOrderRow(env.DB, { id: Number(params.id) });
  if (!o?.proof_key) throw new HttpError(404, 'لا توجد صورة', 'not_found');
  const obj = await env.UPLOADS.get(o.proof_key);
  if (!obj) throw new HttpError(404, 'لا توجد صورة', 'not_found');
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
});
