import type { Fn } from '../../../server/env';
import { checkAdminCredentials, createSession, isAdminEmail, sessionCookie } from '../../../server/auth';
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
} from '../../../server/http';
import {
  clearUserCookie,
  createUserSession,
  destroySession,
  normaliseEmail,
  toAccountUser,
  userCookie,
  verifyPassword,
  type UserRow,
} from '../../../server/accounts';

/** POST /api/auth/login { email, password } — 10 attempts per 15 minutes per IP. */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const bucket = `ulogin:${await ipHash(request, env.SESSION_SECRET ?? 'cocos')}`;
  await rateLimit(env.DB, bucket, 10, 15 * 60);
  const body = await readJson<{ email?: string; password?: string }>(request, 2000);

  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';

  // The shop owner uses this same page: ADMIN_EMAIL + ADMIN_PASSWORD opens the dashboard.
  // That email never falls through to a customer account.
  if (isAdminEmail(env, email)) {
    await assertNotLocked(env.DB, ADMIN_FAIL_BUCKET, ADMIN_FAIL_LIMIT, ADMIN_FAIL_WINDOW);
    if (!(await checkAdminCredentials(env, email, password))) {
      await recordFailure(env.DB, ADMIN_FAIL_BUCKET);
      throw new HttpError(401, 'Wrong email or password.', 'bad_credentials');
    }
    await env.DB.prepare('DELETE FROM rate_limits WHERE bucket = ?').bind(bucket).run();
    return json({ user: null, admin: true }, { headers: { 'set-cookie': sessionCookie(await createSession(env, request), request) } });
  }

  const user = email ? await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>() : null;

  if (user && !user.password_hash && user.google_sub) {
    throw new HttpError(400, 'This account signs in with Google. Use “Continue with Google”.', 'use_google');
  }
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'Wrong email or password.', 'bad_credentials');
  }
  await env.DB.prepare('DELETE FROM rate_limits WHERE bucket = ?').bind(bucket).run();
  const token = await createUserSession(env, user.id);
  return json({ user: toAccountUser(user) }, { headers: { 'set-cookie': userCookie(token, request) } });
});

/** DELETE /api/auth/login — sign out. */
export const onRequestDelete: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  await destroySession(env, request);
  return json({ ok: true }, { headers: { 'set-cookie': clearUserCookie(request) } });
});
