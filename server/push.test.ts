import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from './push';

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
