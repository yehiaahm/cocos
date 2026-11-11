import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import { adminEmails, checkAdminCredentials, createSession, isAdminEmail, verifySession } from './auth';

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

  it('signs everyone out when the admin email or password changes', async () => {
    const token = await createSession(env());
    expect(await verifySession(env(), token)).toBe(true);
    expect(await verifySession(env({ ADMIN_EMAIL: 'new@example.com' }), token)).toBe(false);
    expect(await verifySession(env({ ADMIN_PASSWORD: 'changed' }), token)).toBe(false);
  });
});
