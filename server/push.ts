import type { Env } from './env';
import { b64url, fromB64url } from './http';

/**
 * Web Push with VAPID (RFC 8292), sent without a payload: the admin dashboard's
 * service worker wakes up, fetches /api/admin/notifications/latest and shows it.
 * Works on Android, desktop, and iPhone when the dashboard is added to the home screen.
 */

/**
 * Browsers hand out push endpoints on their vendor's push service. Only those hosts are ever contacted, so a
 * stolen admin session can't use "register a push device" to make the server call internal or arbitrary URLs.
 */
const PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge, Brave, Opera, Samsung (Android)
  'android.googleapis.com',
  'updates.push.services.mozilla.com', // Firefox
  '.push.services.mozilla.com',
  '.push.apple.com', // Safari / iPhone home-screen web apps (web.push.apple.com)
  '.notify.windows.com', // legacy Edge
  '.wns.windows.com',
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => (h.startsWith('.') ? host.endsWith(h) : host === h));
}

export const pushConfigured = (env: Env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

async function signingKey(env: Env): Promise<CryptoKey> {
  const pub = fromB64url(env.VAPID_PUBLIC_KEY!);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY!,
    ext: true,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function vapidJwt(env: Env, audience: string): Promise<string> {
  const enc = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:admin@example.com',
  })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(env), new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

/** Store the notification text, then ping every subscribed device. Never throws. */
export async function notifyAdmins(env: Env, n: { title: string; body: string; url: string }): Promise<{ sent: number; failed: number }> {
  try {
    await env.DB.prepare('INSERT INTO notifications (title, body, url) VALUES (?, ?, ?)').bind(n.title, n.body, n.url).run();
    await env.DB.prepare("DELETE FROM notifications WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')").run();
    if (!pushConfigured(env)) return { sent: 0, failed: 0 };

    const { results } = await env.DB.prepare('SELECT endpoint FROM push_subscriptions').all<{ endpoint: string }>();
    let sent = 0;
    let failed = 0;
    const jwtByAudience = new Map<string, string>();
    await Promise.all(
      results.map(async ({ endpoint }) => {
        try {
          if (!isAllowedPushEndpoint(endpoint)) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
            failed++;
            return;
          }
          const aud = new URL(endpoint).origin;
          if (!jwtByAudience.has(aud)) jwtByAudience.set(aud, await vapidJwt(env, aud));
          const res = await fetch(endpoint, {
            method: 'POST',
            redirect: 'error', // a push service never needs to redirect us somewhere else
            headers: {
              TTL: '86400',
              Urgency: 'high',
              Authorization: `vapid t=${jwtByAudience.get(aud)}, k=${env.VAPID_PUBLIC_KEY}`,
              'Content-Length': '0',
            },
          });
          if (res.status === 404 || res.status === 410) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
            failed++;
          } else if (res.ok) sent++;
          else {
            failed++;
            console.warn('Push failed', res.status, await res.text().catch(() => ''));
          }
        } catch (e) {
          failed++;
          console.warn('Push error', e);
        }
      }),
    );
    return { sent, failed };
  } catch (e) {
    console.error('notifyAdmins failed', e);
    return { sent: 0, failed: 0 };
  }
}
