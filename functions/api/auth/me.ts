import type { Fn } from '../../../server/env';
import { HttpError, assertSameOrigin, handle, json, readJson, str } from '../../../server/http';
import {
  checkPasswordStrength,
  getSessionUser,
  googleConfigured,
  hashPassword,
  requireUser,
  toAccountUser,
  verifyPassword,
  type UserRow,
} from '../../../server/accounts';
import { normaliseEgyptPhone } from '../../../src/lib/phone';
import type { AuthMe } from '../../../src/lib/api-types';

/** GET /api/auth/me — who is signed in (null for guests) and which sign-in methods are available. */
export const onRequestGet: Fn = handle(async ({ request, env }) => {
  const user = await getSessionUser(env, request);
  const body: AuthMe = { user: user ? toAccountUser(user) : null, google: googleConfigured(env) };
  return json(body);
});

/** PATCH /api/auth/me { name?, phone?, city?, address?, currentPassword?, newPassword? } — update the profile. */
export const onRequestPatch: Fn = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const user = await requireUser(env, request);
  const body = await readJson<Record<string, unknown>>(request, 4000);

  const name = body.name === undefined ? user.name : str(body.name, 80);
  if (name.length < 2) throw new HttpError(400, 'Please enter your name.', 'name');
  let phone = user.phone;
  if (body.phone !== undefined) {
    const raw = str(body.phone, 30);
    phone = raw ? normaliseEgyptPhone(raw) : null;
    if (raw && !phone) throw new HttpError(400, 'Enter an Egyptian mobile number, e.g. 010 1234 5678.', 'phone');
  }
  const city = body.city === undefined ? user.city : str(body.city, 60) || null;
  const address = body.address === undefined ? user.address : str(body.address, 400) || null;

  let passwordHash = user.password_hash;
  if (typeof body.newPassword === 'string' && body.newPassword) {
    if (user.password_hash && !(await verifyPassword(String(body.currentPassword ?? ''), user.password_hash))) {
      throw new HttpError(400, 'Your current password is not correct.', 'currentPassword');
    }
    checkPasswordStrength(body.newPassword);
    passwordHash = await hashPassword(body.newPassword);
  }

  await env.DB.prepare('UPDATE users SET name = ?, phone = ?, city = ?, address = ?, password_hash = ? WHERE id = ?')
    .bind(name, phone, city, address, passwordHash, user.id)
    .run();
  const fresh = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>())!;
  return json({ user: toAccountUser(fresh) });
});
