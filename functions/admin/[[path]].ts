import type { Fn } from '../../server/env';

/** /admin and every /admin/* URL get the dashboard shell (the React app routes from there). */
export const onRequestGet: Fn<'path'> = async ({ request, env }) => {
  const res = await env.ASSETS.fetch(new URL('/admin', request.url));
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'no-store');
  out.headers.set('x-robots-tag', 'noindex, nofollow');
  return out;
};
