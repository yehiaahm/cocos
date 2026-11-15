import { describe, expect, it } from 'vitest';
import { afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { isAllowedPushEndpoint, notifyAdmins } from './push';
import type { Env } from './env';

describe('push endpoint allow-list', () => {
  it('accepts the real browser push services', () => {
    for (const u of [
      'https://fcm.googleapis.com/fcm/send/abc123',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGxyz',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) expect(isAllowedPushEndpoint(u), u).toBe(true);
  });
  it('rejects internal, plain-http, look-alike and credentialed URLs', () => {
    for (const u of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://169.254.169.254/latest/meta-data/',
      'https://localhost/x',
      'https://127.0.0.1:8080/x',
      'https://evil.example/fcm.googleapis.com',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evilpush.apple.com.evil.example/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'file:///etc/passwd',
      'not a url',
    ]) expect(isAllowedPushEndpoint(u), u).toBe(false);
  });
});

describe('notifyAdmins', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, 'base64url'), Buffer.from(pub.y!, 'base64url')]).toString('base64url');

  const fakeEnv = (endpoints: string[]) => {
    const deleted: string[] = [];
    const env = {
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: priv.d!,
      DB: {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            run: async () => {
              if (sql.startsWith('DELETE FROM push_subscriptions')) deleted.push(String(args[0]));
            },
          }),
          run: async () => undefined,
          all: async () => ({ results: endpoints.map((endpoint) => ({ endpoint })) }),
        }),
      },
    } as unknown as Env;
    return { env, deleted };
  };

  afterEach(() => vi.unstubAllGlobals());

  it('reports why a device was not notified, drops dead ones, and never waits forever', async () => {
    const ok = 'https://fcm.googleapis.com/fcm/send/ok';
    const gone = 'https://fcm.googleapis.com/fcm/send/gone';
    const stale = 'https://fcm.googleapis.com/fcm/send/stale';
    const calls: { url: string; signal?: AbortSignal | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, signal: init.signal });
        return new Response('x', { status: url === ok ? 201 : url === gone ? 410 : 403 });
      }),
    );
    const { env, deleted } = fakeEnv([ok, gone, stale]);
    const r = await notifyAdmins(env, { title: 't', body: 'b', url: '/admin' });
    expect(r).toMatchObject({ total: 3, sent: 1, failed: 2, removed: 1 });
    expect(r.statuses.sort()).toEqual([403, 410]);
    expect(deleted).toEqual([gone]);
    expect(calls.every((c) => c.signal)).toBe(true); // every send has a timeout
  });

  it('counts a push service that times out as a failure instead of hanging', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('timed out', 'TimeoutError'))));
    const { env } = fakeEnv(['https://fcm.googleapis.com/fcm/send/slow']);
    const r = await notifyAdmins(env, { title: 't', body: 'b', url: '/admin' });
    expect(r).toMatchObject({ total: 1, sent: 0, failed: 1, statuses: [0] });
  });
});
