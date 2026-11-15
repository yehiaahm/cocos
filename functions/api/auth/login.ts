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
  sha256,
} from '../../../server/http';
import {
  burnPasswordCheck,
  clearUserCookie,
  createUserSession,
  destroySession,
  hashPassword,
  needsRehash,
  normaliseEmail,
  toAccountUser,
  userCookie,
  verifyPassword,
  type UserRow,
} from '../../../server/accounts';

const ACCOUNT_FAIL_LIMIT = 10;
const ACCOUNT_FAIL_WINDOW = 15 * 60;

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

  // Per-account limit on top of the per-IP one, so guessing one account from many IPs is stopped too.
  // (Trade-off: someone can keep a known email's password sign-in locked for the window. Google sign-in is unaffected.)
  const acctBucket = `uacct:${(await sha256(`${env.SESSION_SECRET ?? 'cocos'}:${email}`)).slice(0, 22)}`;
  if (email) await assertNotLocked(env.DB, acctBucket, ACCOUNT_FAIL_LIMIT, ACCOUNT_FAIL_WINDOW);

  const user = email ? await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>() : null;

  // One answer for "no such account", "wrong password" and "this account uses Google", and the same amount of work
  // for each, so neither the message nor the response time reveals which emails have an account.
  let passwordOk = false;
  if (user?.password_hash) passwordOk = await verifyPassword(password, user.password_hash);
  else await burnPasswordCheck(password);
  if (!user || !passwordOk) {
    if (email) await recordFailure(env.DB, acctBucket);
    throw new HttpError(
      401,
      'Wrong email or password. If you created your account with Google, use “Continue with Google”.',
      'bad_credentials',
    );
  }
  await env.DB.prepare('DELETE FROM rate_limits WHERE bucket IN (?, ?)').bind(bucket, acctBucket).run();
  // Upgrade hashes made with an older (weaker) iteration count now that we hold the plaintext.
  if (needsRehash(user.password_hash)) {
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), user.id).run();
  }
  const token = await createUserSession(env, user.id);
  return json({ user: toAccountUser(user) }, { headers: { 'set-cookie': userCookie(token, request) } });
});

/** DELETE /api/auth/login — sign out. */
export const onRequestDelete: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  await destroySession(env, request);
  return json({ ok: true }, { headers: { 'set-cookie': clearUserCookie(request) } });
});
