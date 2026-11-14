import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import { adminEmails, checkAdminCredentials, createSession, destroyAllSessions, destroySession, isAdminEmail, verifySession } from './auth';

const env = (over: Partial<Env> = {}) =>
  ({ ADMIN_EMAIL: 'Owner@Example.com', ADMIN_PASSWORD: 'resin-and-gold', SESSION_SECRET: 'x'.repeat(40), ...over }) as Env;

describe('owner sign-in on the shared login page', () => {
  it('matches the admin email case-insensitively, including a comma-separated list', () => {
    expect(isAdminEmail(env(), 'owner@example.com')).toBe(true);
    expect(isAdminEmail(env(), ' OWNER@example.com ')).toBe(true);
    expect(isAdminEmail(env(), 'someone@example.com')).toBe(false);
    expect(isAdminEmail(env({ ADMIN_EMAIL: '' }), '')).toBe(false);
    expect(adminEmails(env({ ADMIN_EMAIL: 'a@x.com, B@x.com,' }))).toEqual(['a@x.com', 'b@x.com']);
  });

  it('needs both the right email and the right password', async () => {
    expect(await checkAdminCredentials(env(), 'owner@example.com', 'resin-and-gold')).toBe(true);
    expect(await checkAdminCredentials(env(), 'owner@example.com', 'wrong')).toBe(false);
    expect(await checkAdminCredentials(env(), 'customer@example.com', 'resin-and-gold')).toBe(false);
    expect(await checkAdminCredentials(env({ ADMIN_EMAIL: undefined }), '', 'resin-and-gold')).toBe(false);
  });

});

describe('admin sessions (server-side, revocable)', async () => {
  const { NodeD1 } = await import('./node/d1');
  const path = await import('node:path');
  const fresh = (over: Partial<Env> = {}) => {
    const db = new NodeD1(':memory:');
    db.migrate(path.resolve(__dirname, '../migrations'));
    return env({ DB: db as unknown as D1Database, ...over });
  };
  const row = (e: Env, token: string) =>
    e.DB.prepare('SELECT * FROM admin_sessions').all<{ token_hash: string; expires_at: number; last_seen_at: number; created_at: number }>();

  it('accepts a fresh session and rejects garbage, empty and old-format tokens', async () => {
    const e = fresh();
    const token = await createSession(e);
    expect(await verifySession(e, token)).toBe(true);
    expect(await verifySession(e, null)).toBe(false);
    expect(await verifySession(e, '')).toBe(false);
    expect(await verifySession(e, token + 'x')).toBe(false);
    expect(await verifySession(e, 'eyJleHAiOjk5OTk5OTk5OTk5OTksInB3IjoieCJ9.AAAA')).toBe(false); // the old HMAC cookie format
  });

  it('stores only a hash of the token', async () => {
    const e = fresh();
    const token = await createSession(e);
    const { results } = await row(e, token);
    expect(results).toHaveLength(1);
    expect(results[0].token_hash).not.toContain(token);
    expect(results[0].token_hash).not.toBe(token);
  });

  it('sign-out revokes that session at once, even for a copied cookie, and leaves other sessions alone', async () => {
    const e = fresh();
    const a = await createSession(e);
    const b = await createSession(e);
    await destroySession(e, a);
    expect(await verifySession(e, a)).toBe(false);
    expect(await verifySession(e, b)).toBe(true);
  });

  it('"sign out everywhere" revokes every session', async () => {
    const e = fresh();
    const tokens = [await createSession(e), await createSession(e), await createSession(e)];
    await destroyAllSessions(e);
    for (const t of tokens) expect(await verifySession(e, t)).toBe(false);
  });

  it('signs everyone out when the admin email or password changes', async () => {
    const e = fresh();
    const token = await createSession(e);
    expect(await verifySession(e, token)).toBe(true);
    expect(await verifySession({ ...e, ADMIN_EMAIL: 'new@example.com' } as Env, token)).toBe(false);
    expect(await verifySession({ ...e, ADMIN_PASSWORD: 'changed' } as Env, token)).toBe(false);
  });

  it('expires after the absolute lifetime and after the idle timeout', async () => {
    const e = fresh();
    const now = Math.floor(Date.now() / 1000);
    const abs = await createSession(e);
    await e.DB.prepare('UPDATE admin_sessions SET expires_at = ?').bind(now - 1).run();
    expect(await verifySession(e, abs)).toBe(false);

    const idle = await createSession(e);
    await e.DB.prepare('UPDATE admin_sessions SET last_seen_at = ?').bind(now - 25 * 3600).run();
    expect(await verifySession(e, idle)).toBe(false);
  });

  it('is valid for a week at most, and activity refreshes the idle clock', async () => {
    const e = fresh();
    const token = await createSession(e);
    const { results } = await row(e, token);
    expect(results[0].expires_at - results[0].created_at).toBe(7 * 86_400);
    const old = Math.floor(Date.now() / 1000) - 3600; // seen an hour ago → older than the 5-minute touch threshold
    await e.DB.prepare('UPDATE admin_sessions SET last_seen_at = ?').bind(old).run();
    expect(await verifySession(e, token)).toBe(true);
    const after = (await row(e, token)).results[0];
    expect(after.last_seen_at).toBeGreaterThan(old);
  });

  it('cleans up expired sessions when a new one is created', async () => {
    const e = fresh();
    await createSession(e);
    await e.DB.prepare('UPDATE admin_sessions SET expires_at = 1').run();
    await createSession(e);
    expect((await row(e, '')).results).toHaveLength(1);
  });
});
