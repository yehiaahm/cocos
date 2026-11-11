import type { Fn } from '../../../server/env';
import { HttpError, handle, json, readJson, str } from '../../../server/http';
import { notifyAdmins, pushConfigured } from '../../../server/push';

interface Sub {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

/** POST /api/admin/push — save this phone/browser for new-order notifications. */
export const onRequestPost: Fn = handle(async ({ request, env }) => {
  if (!pushConfigured(env)) throw new HttpError(503, 'الإشعارات غير مفعّلة على السيرفر (VAPID keys)', 'not_configured');
  const sub = await readJson<Sub>(request, 4000);
  const endpoint = str(sub.endpoint, 1000);
  if (!/^https:\/\//.test(endpoint)) throw new HttpError(400, 'اشتراك غير صالح');
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
  )
    .bind(endpoint, str(sub.keys?.p256dh, 200), str(sub.keys?.auth, 100), str(request.headers.get('user-agent'), 200))
    .run();
  return json({ ok: true });
});

/** DELETE /api/admin/push { endpoint } */
export const onRequestDelete: Fn = handle(async ({ request, env }) => {
  const { endpoint } = await readJson<{ endpoint: string }>(request, 2000);
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(str(endpoint, 1000)).run();
  return json({ ok: true });
});

/** PUT /api/admin/push — send a test notification to every device. */
export const onRequestPut: Fn = handle(async ({ env }) => {
  const r = await notifyAdmins(env, { title: '🔔 إشعار تجريبي', body: 'الإشعارات شغالة — هيوصلك إشعار زي ده مع كل طلب جديد.', url: '/admin' });
  return json(r);
});
