import { describe, expect, it } from 'vitest';
import { trustedClientIp } from './node/clientip';
import { ipHash } from './http';

const req = (headers: Record<string, string>) => new Request('https://shop.test/api/x', { headers });

describe('trustedClientIp (Node behind one proxy)', () => {
  it('takes the entry the proxy appended (right-most), not what the client put on the left', () => {
    expect(trustedClientIp('1.2.3.4, 203.0.113.9', '10.0.0.1')).toBe('203.0.113.9');
    expect(trustedClientIp('6.6.6.6, 7.7.7.7, 203.0.113.9', '10.0.0.1')).toBe('203.0.113.9');
  });
  it('a single entry is that entry', () => {
    expect(trustedClientIp('203.0.113.9', '10.0.0.1')).toBe('203.0.113.9');
  });
  it('falls back to the socket address, then "local", when there is no proxy header', () => {
    expect(trustedClientIp(undefined, '198.51.100.2')).toBe('198.51.100.2');
    expect(trustedClientIp('', undefined)).toBe('local');
  });
  it('honours the number of proxy hops', () => {
    expect(trustedClientIp('9.9.9.9, 203.0.113.9, 10.1.1.1', '10.0.0.1', 2)).toBe('203.0.113.9');
  });
  it('joins repeated header lines', () => {
    expect(trustedClientIp(['1.1.1.1', '203.0.113.9'], undefined)).toBe('203.0.113.9');
  });
});

describe('ipHash', () => {
  it('ignores X-Forwarded-For, which clients control', async () => {
    const a = await ipHash(req({ 'x-forwarded-for': '1.1.1.1' }), 's');
    const b = await ipHash(req({ 'x-forwarded-for': '2.2.2.2' }), 's');
    expect(a).toBe(b);
  });
  it('uses cf-connecting-ip (Cloudflare) first, then x-client-ip (Node server)', async () => {
    const cf = await ipHash(req({ 'cf-connecting-ip': '1.1.1.1', 'x-client-ip': '9.9.9.9' }), 's');
    const cfOnly = await ipHash(req({ 'cf-connecting-ip': '1.1.1.1' }), 's');
    expect(cf).toBe(cfOnly);
    const n1 = await ipHash(req({ 'x-client-ip': '3.3.3.3' }), 's');
    const n2 = await ipHash(req({ 'x-client-ip': '4.4.4.4' }), 's');
    expect(n1).not.toBe(n2);
  });
});
