import type { Fn } from '../../../../../server/env';
import { HttpError, handle } from '../../../../../server/http';
import { getOrderRow } from '../../../../../server/orders';

/** GET /api/admin/orders/:id/proof — the transfer screenshot (admin only, via middleware). */
export const onRequestGet: Fn<'id'> = handle(async ({ env, params }) => {
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'لا توجد صورة', 'not_found');
  const o = await getOrderRow(env.DB, { id });
  if (!o?.proof_key) throw new HttpError(404, 'لا توجد صورة', 'not_found');
  const obj = await env.UPLOADS.get(o.proof_key);
  if (!obj) throw new HttpError(404, 'لا توجد صورة', 'not_found');
  // Only ever serve it as one of the three accepted image types, whatever the stored metadata says.
  const stored = obj.httpMetadata?.contentType ?? '';
  const type = ['image/jpeg', 'image/png', 'image/webp'].includes(stored) ? stored : 'application/octet-stream';
  return new Response(obj.body, {
    headers: {
      'content-type': type,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      // If it were ever opened as a page, it can run nothing and load nothing.
      'content-security-policy': "default-src 'none'; sandbox",
      'content-disposition': 'inline',
    },
  });
});
