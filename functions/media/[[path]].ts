import type { Fn } from '../../server/env';

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * GET /media/catalog/<file> — product photos uploaded from the dashboard.
 * Only the catalog/ folder is public; payment screenshots (proofs/) are never reachable from here.
 * File names are random and never reused, so they can be cached for a year.
 */
export const onRequestGet: Fn<'path'> = async ({ env, params }) => {
  const raw = params.path;
  const key = Array.isArray(raw) ? raw.join('/') : (raw ?? '');
  if (!/^catalog\/[A-Za-z0-9._-]{1,120}$/.test(key) || key.includes('..')) return new Response('Not found', { status: 404 });
  const obj = await env.UPLOADS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const stored = obj.httpMetadata?.contentType ?? '';
  return new Response(obj.body, {
    headers: {
      'content-type': TYPES.has(stored) ? stored : 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      // If it were ever opened as a page, it can run nothing and load nothing.
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
};
