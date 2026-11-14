import type { Fn } from '../../../server/env';
import {
  SESSION_COOKIE,
  checkAdminCredentials,
  clearCookie,
  createSession,
  destroyAllSessions,
  destroySession,
  readCookie,
  sessionCookie,
  verifySession,
} from '../../../server/auth';
import {
  ADMIN_FAIL_BUCKET,
  ADMIN_FAIL_LIMIT,
  ADMIN_FAIL_WINDOW,
  HttpError,
  assertNotLocked,
  assertSameOrigin,
  handle,
  ipHash,
  json,
  rateLimit,
  readJson,
  recordFailure,
  str,
} from '../../../server/http';

/**
 * POST /api/admin/login { email, password } — 8 attempts per 15 minutes per IP.
 * The site signs the owner in through /api/auth/login (the shop's normal login page); this stays for API clients.
 */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const bucket = `login:${await ipHash(request, env.SESSION_SECRET ?? 'cocos')}`;
  await rateLimit(env.DB, bucket, 8, 15 * 60);
  const { email, password } = await readJson<{ email?: string; password?: string }>(request, 2000);
  await assertNotLocked(env.DB, ADMIN_FAIL_BUCKET, ADMIN_FAIL_LIMIT, ADMIN_FAIL_WINDOW);
  if (!(await checkAdminCredentials(env, str(email, 200), str(password, 200)))) {
    await recordFailure(env.DB, ADMIN_FAIL_BUCKET);
    throw new HttpError(401, 'الإيميل أو كلمة المرور غير صحيحة', 'bad_credentials');
  }
  await env.DB.prepare('DELETE FROM rate_limits WHERE bucket = ?').bind(bucket).run();
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(await createSession(env, request), request) } });
});

/**
 * DELETE /api/admin/login — sign out: the session row is deleted, so a copied cookie stops working immediately.
 * DELETE /api/admin/login?all=1 — sign out every device (needs a valid session; otherwise only signs out this cookie).
 */
export const onRequestDelete: Fn = handle(async ({ request, env }) => {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    const everywhere = new URL(request.url).searchParams.get('all') === '1';
    if (everywhere && (await verifySession(env, token))) await destroyAllSessions(env);
    else await destroySession(env, token);
  }
  return json({ ok: true }, { headers: { 'set-cookie': clearCookie } });
});
