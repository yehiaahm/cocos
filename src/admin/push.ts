import { api } from './api';
import { t } from './i18n';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' });
}

/** The browser's push service can silently never answer (blocked network, no Google services) — fail with a clear message instead of spinning. */
function withTimeout<T>(p: Promise<T>, ms = 20_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(t('push.timeout'))), ms);
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/** True when this browser subscription was created with a different server key than the one in use now (it can never receive anything). */
function keyMismatch(sub: PushSubscription, vapidKey: string): boolean {
  const have = sub.options?.applicationServerKey;
  if (!have) return false;
  const a = new Uint8Array(have);
  const b = keyBytes(vapidKey);
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

export async function pushState(vapidKey?: string | null): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iPhone only exposes Web Push to apps added to the home screen.
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/admin');
  const sub = await reg?.pushManager.getSubscription();
  if (sub && vapidKey && keyMismatch(sub, vapidKey)) return 'off'; // stale subscription: ask to enable again
  return sub ? 'on' : 'off';
}

export async function enablePush(vapidKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  await withTimeout(navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  if (sub && keyMismatch(sub, vapidKey)) {
    // Left over from before the server's push keys changed: the push service would reject every send to it.
    await api('/api/admin/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
  await api('/api/admin/push', { method: 'POST', body: sub.toJSON() });
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/admin');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api('/api/admin/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return 'off';
}

/** Keep the service worker registered so clicks on notifications open the dashboard. */
export function ensureWorker() {
  if ('serviceWorker' in navigator) void registration().catch(() => undefined);
}
