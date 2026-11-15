import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { StaticSite, SECURITY_HEADERS } from './node/static';
import { readCookie } from './auth';

const makeSite = () => {
  const base = mkdtempSync(path.join(tmpdir(), 'cocos-static-'));
  const dist = path.join(base, 'dist');
  mkdirSync(path.join(base, 'dist-secret'));
  mkdirSync(dist);
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>home</title>');
  writeFileSync(path.join(dist, '404.html'), '<!doctype html><title>nope</title>');
  writeFileSync(path.join(dist, 'csp.txt'), "default-src 'self'; script-src 'self' 'sha256-abc'");
  writeFileSync(path.join(base, 'dist-secret', 'server.mjs'), 'SECRET');
  return new StaticSite(dist);
};
const get = (site: StaticSite, p: string) => site.serve(new Request(`https://x.example${p}`), p);

describe('static file server', () => {
  it('serves the page with the build-time Content-Security-Policy', async () => {
    const res = await get(makeSite(), '/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self' 'sha256-abc'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
  it('never escapes the dist folder, including into a sibling folder that shares its name prefix', async () => {
    const site = makeSite();
    for (const p of ['/../dist-secret/server.mjs', '/..%2Fdist-secret%2Fserver.mjs', '/%2e%2e/dist-secret/server.mjs', '/..%5Cdist-secret%5Cserver.mjs', '/..\dist-secret\server.mjs', '/a%00.html']) {
      const res = await get(site, p);
      expect(res.status, p).toBe(404);
      expect(await res.text(), p).not.toContain('SECRET');
    }
  });
  it('has a restrictive baseline policy for API responses', () => {
    expect(SECURITY_HEADERS['content-security-policy']).toContain("default-src 'none'");
    expect(SECURITY_HEADERS['strict-transport-security']).toContain('includeSubDomains');
  });
});

describe('cookie parsing', () => {
  it('treats a malformed %-escape as "no cookie" instead of throwing', () => {
    const req = (cookie: string) => new Request('https://x.example/', { headers: { cookie } });
    expect(readCookie(req('cocos_admin=%E0%A4%A'), 'cocos_admin')).toBeNull();
    expect(readCookie(req('a=1; cocos_admin=abc%20d'), 'cocos_admin')).toBe('abc d');
    expect(readCookie(req('other=1'), 'cocos_admin')).toBeNull();
  });
});
