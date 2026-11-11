import type { Fn } from '../../../server/env';
import { isAdminEmail } from '../../../server/auth';
import { HttpError, assertSameOrigin, handle, ipHash, json, rateLimit, readJson, str } from '../../../server/http';
import {
  checkPasswordStrength,
  createUserSession,
  hashPassword,
  isEmail,
  normaliseEmail,
  toAccountUser,
  userCookie,
  type UserRow,
} from '../../../server/accounts';

/** POST /api/auth/register { name, email, password } — creates an account and signs in. */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const body = await readJson<{ name?: string; email?: string; password?: string; website?: string }>(request, 4000);
  if (body.website) return json({ error: 'Rejected' }, { status: 400 });
  await rateLimit(env.DB, `register:${await ipHash(request, env.SESSION_SECRET ?? 'cocos')}`, 6, 60 * 60);

  const name = str(body.name, 80);
  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (name.length < 2) throw new HttpError(400, 'Please enter your name.', 'name');
  if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.', 'email');
  checkPasswordStrength(password);
  // The owner's email is reserved for the dashboard sign-in.
  if (isAdminEmail(env, email)) throw new HttpError(409, 'This email already has an account. Sign in instead.', 'email_taken');

  const existing = await env.DB.prepare('SELECT id, google_sub, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<Pick<UserRow, 'id' | 'google_sub' | 'password_hash'>>();
  if (existing) {
    throw new HttpError(
      409,
      existing.google_sub && !existing.password_hash
        ? 'This email already has an account. Use “Continue with Google”.'
        : 'This email already has an account. Sign in instead.',
      'email_taken',
    );
  }

  await env.DB.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').bind(email, name, await hashPassword(password)).run();
  const user = (await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>())!;
  const token = await createUserSession(env, user.id);
  return json({ user: toAccountUser(user) }, { status: 201, headers: { 'set-cookie': userCookie(token, request) } });
});
