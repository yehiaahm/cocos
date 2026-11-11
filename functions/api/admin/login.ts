import type { Fn } from '../../../server/env';
import { checkPassword, clearCookie, createSession, sessionCookie } from '../../../server/auth';
import { HttpError, handle, ipHash, json, rateLimit, readJson, str } from '../../../server/http';

/** POST /api/admin/login { password } — 8 attempts per 15 minutes per IP. */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  const { password } = await readJson<{ password?: string }>(request, 2000);
  const bucket = `login:${await ipHash(request, env.SESSION_SECRET ?? 'cocos')}`;
  await rateLimit(env.DB, bucket, 8, 15 * 60);
  if (!(await checkPassword(env, str(password, 200)))) throw new HttpError(401, 'كلمة المرور غير صحيحة', 'bad_password');
  await env.DB.prepare('DELETE FROM rate_limits WHERE bucket = ?').bind(bucket).run();
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(await createSession(env), request) } });
});

/** DELETE /api/admin/login — sign out. */
export const onRequestDelete: Fn = handle(async () => json({ ok: true }, { headers: { 'set-cookie': clearCookie } }));
