import type { Env } from './env';
import { b64url, fromB64url } from './http';
import { agoSql } from './sql';

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

/** A push service that doesn't answer must never hang the request (Node's own fetch waits ~5 minutes). */
const PUSH_TIMEOUT_MS = 10_000;

export interface PushResult {
  /** Subscriptions stored when the notification went out. */
  total: number;
  sent: number;
  failed: number;
  /** Dead subscriptions (404/410 or a disallowed endpoint) that were deleted. */
  removed: number;
  /** HTTP status the push service answered with for each failure (0 = timeout / network error). */
  statuses: number[];
}

/** Store the notification text, then ping every subscribed device. Never throws. */
export async function notifyAdmins(env: Env, n: { title: string; body: string; url: string }): Promise<PushResult> {
  const out: PushResult = { total: 0, sent: 0, failed: 0, removed: 0, statuses: [] };
  try {
    await env.DB.prepare('INSERT INTO notifications (title, body, url) VALUES (?, ?, ?)').bind(n.title, n.body, n.url).run();
    await env.DB.prepare(`DELETE FROM notifications WHERE created_at < ${agoSql(30, 'DAY')}`).run();
    if (!pushConfigured(env)) return out;

    const { results } = await env.DB.prepare('SELECT endpoint FROM push_subscriptions').all<{ endpoint: string }>();
    out.total = results.length;
    const jwtByAudience = new Map<string, string>();
    const drop = async (endpoint: string) => {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
      out.removed++;
    };
    await Promise.all(
      results.map(async ({ endpoint }) => {
        try {
          if (!isAllowedPushEndpoint(endpoint)) {
            await drop(endpoint);
            out.failed++;
            out.statuses.push(400);
            return;
          }
          const aud = new URL(endpoint).origin;
          if (!jwtByAudience.has(aud)) jwtByAudience.set(aud, await vapidJwt(env, aud));
          const res = await fetch(endpoint, {
            method: 'POST',
            redirect: 'error', // a push service never needs to redirect us somewhere else
            signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
            headers: {
              TTL: '86400',
              Urgency: 'high',
              Authorization: `vapid t=${jwtByAudience.get(aud)}, k=${env.VAPID_PUBLIC_KEY}`,
              'Content-Length': '0',
            },
          });
          if (res.ok) {
            out.sent++;
            return;
          }
          out.failed++;
          out.statuses.push(res.status);
          if (res.status === 404 || res.status === 410) await drop(endpoint);
          else console.warn('Push failed', res.status, new URL(endpoint).hostname, (await res.text().catch(() => '')).slice(0, 300));
        } catch (e) {
          out.failed++;
          out.statuses.push(0);
          console.warn('Push error', new URL(endpoint).hostname, e);
        }
      }),
    );
    return out;
  } catch (e) {
    console.error('notifyAdmins failed', e);
    return out;
  }
}
