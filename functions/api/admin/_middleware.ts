import type { Fn } from '../../../server/env';
import { SESSION_COOKIE, readCookie, verifySession } from '../../../server/auth';
import { assertSameOrigin, errorResponse, json } from '../../../server/http';

const PUBLIC = new Set(['/api/admin/login']);

/** Every /api/admin/* route needs a valid session, except login (which also handles sign-out). */
export const onRequest: Fn = async (ctx) => {
  try {
    assertSameOrigin(ctx.request);
    const path = new URL(ctx.request.url).pathname.replace(/\/+$/, '');
    if (!PUBLIC.has(path) && !(await verifySession(ctx.env, readCookie(ctx.request, SESSION_COOKIE)))) {
      return json({ error: 'Please sign in.', code: 'unauthorized' }, { status: 401 });
    }
    const res = await ctx.next();
    res.headers.set('cache-control', 'no-store');
    res.headers.set('x-robots-tag', 'noindex');
    return res;
  } catch (e) {
    return errorResponse(e);
  }
};
