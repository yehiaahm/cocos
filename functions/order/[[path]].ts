import type { Fn } from '../../server/env';

/** /order/CA-1001?t=… — a customer's private order page, rendered in the browser from the shell. */
export const onRequestGet: Fn<'path'> = async ({ request, env }) => {
  const res = await env.ASSETS.fetch(new URL('/order', request.url));
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'no-store');
  out.headers.set('x-robots-tag', 'noindex, nofollow');
  return out;
};
