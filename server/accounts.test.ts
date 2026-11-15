import { describe, expect, it } from 'vitest';
import {
  PBKDF2_ITERATIONS,
  checkPasswordStrength,
  hashPassword,
  isEmail,
  needsRehash,
  normaliseEmail,
  safeNext,
  verifyPassword,
} from './accounts';
import { b64url } from './http';

describe('customer passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('resin-and-gold');
    const b = await hashPassword('resin-and-gold');
    expect(a).not.toBe(b);
    expect(a.startsWith(`pbkdf2$${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(await verifyPassword('resin-and-gold', a)).toBe(true);
    expect(await verifyPassword('resin-and-gold!', a)).toBe(false);
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'garbage')).toBe(false);
  });

  it('uses at least the OWASP iteration count on Node and flags weaker stored hashes for upgrade', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(needsRehash('pbkdf2$100000$salt$hash')).toBe(true);
    expect(needsRehash(`pbkdf2$${PBKDF2_ITERATIONS}$salt$hash`)).toBe(false);
    expect(needsRehash(null)).toBe(false);
    // An old 100k hash still verifies, so existing customers can sign in before they are upgraded.
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('old-password-1'), 'PBKDF2', false, ['deriveBits']);
    const salt = new Uint8Array(16).fill(7);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256));
    const stored = `pbkdf2$100000$${b64url(salt)}$${b64url(bits)}`;
    expect(await verifyPassword('old-password-1', stored)).toBe(true);
    expect(await verifyPassword('old-password-2', stored)).toBe(false);
  });

  it('rejects short, common and email-derived passwords', () => {
    expect(() => checkPasswordStrength('short1')).toThrow(/at least 10/);
    expect(() => checkPasswordStrength('1234567890')).toThrow(/easy to guess/);
    expect(() => checkPasswordStrength('Password123')).toThrow(/easy to guess/);
    expect(() => checkPasswordStrength('aaaaaaaaaaaa')).toThrow(/easy to guess/);
    expect(() => checkPasswordStrength('mycoco-secret-9', 'coco.owner@example.com')).not.toThrow();
    expect(() => checkPasswordStrength('coco.owner-2024', 'coco.owner@example.com')).toThrow(/easy to guess/);
    expect(() => checkPasswordStrength('violet-lantern-tide-47')).not.toThrow();
    expect(() => checkPasswordStrength('x'.repeat(201))).toThrow(/too long/);
  });
});

describe('account helpers', () => {
  it('normalises and validates emails', () => {
    expect(normaliseEmail('  Coco@Example.COM ')).toBe('coco@example.com');
    expect(isEmail('coco@example.com')).toBe(true);
    expect(isEmail('coco@example')).toBe(false);
    expect(isEmail('not an email')).toBe(false);
  });
  it('only redirects to same-site paths after sign-in', () => {
    expect(safeNext('/checkout')).toBe('/checkout');
    expect(safeNext('https://evil.example')).toBe('/account');
    expect(safeNext('//evil.example')).toBe('/account');
    expect(safeNext('/\\evil.example')).toBe('/account');
    expect(safeNext('/api/auth/login')).toBe('/account');
    expect(safeNext(null)).toBe('/account');
  });
  it('rejects tab/newline/control-character tricks that browsers turn into //host', () => {
    for (const bad of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/\u0000/evil.example', '/\u007f/evil.example', '/a\\b']) {
      expect(safeNext(bad)).toBe('/account');
    }
  });
  it('keeps legitimate paths, queries and hashes, and caps the length', () => {
    expect(safeNext('/product/blue-ocean-tray?variant=2#reviews')).toBe('/product/blue-ocean-tray?variant=2#reviews');
    expect(safeNext('/admin/orders/5')).toBe('/admin/orders/5');
    expect(safeNext('/' + 'a'.repeat(400))).toBe('/account');
  });
  it('never yields anything that resolves to another origin', () => {
    const base = 'https://shop.example';
    const inputs = ['/%09/evil.example', '/%5Cevil.example', '/ /evil.example', '/​/evil.example', '/.//evil.example', '/x/../../evil.example', '/..//evil.example', '///evil.example', '/?next=//evil.example'];
    for (const i of inputs) {
      const out = safeNext(i);
      expect(new URL(out, base).origin).toBe(base);
      expect(out.startsWith('//')).toBe(false);
    }
  });
});

describe('Google account linking', async () => {
  const { NodeD1 } = await import('./node/d1');
  const { upsertGoogleUser, createUserSession } = await import('./accounts');
  const path = await import('node:path');

  const setup = () => {
    const db = new NodeD1(':memory:');
    db.migrate(path.resolve(__dirname, '../migrations'));
    return { DB: db } as unknown as import('./env').Env;
  };
  const g = { sub: 'g-123', email: 'coco@example.com', emailVerified: true, name: 'Coco', picture: null };

  it('creates a new verified account', async () => {
    const env = setup();
    const u = await upsertGoogleUser(env, g);
    expect(u.email).toBe('coco@example.com');
    expect(u.google_sub).toBe('g-123');
    expect(u.email_verified).toBe(1);
    expect((await upsertGoogleUser(env, g)).id).toBe(u.id);
  });

  it('links an unverified password account and drops its password and sessions', async () => {
    const env = setup();
    await env.DB.prepare("INSERT INTO users (email, name, password_hash) VALUES ('coco@example.com', 'Someone', 'pbkdf2$1$a$b')").run();
    await createUserSession(env, 1);
    const u = await upsertGoogleUser(env, g);
    expect(u.id).toBe(1);
    expect(u.google_sub).toBe('g-123');
    expect(u.password_hash).toBeNull();
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM user_sessions').first('n')).toBe(0);
  });

  it('refuses Google accounts whose email is not verified', async () => {
    await expect(upsertGoogleUser(setup(), { ...g, emailVerified: false })).rejects.toMatchObject({ code: 'google_unverified' });
  });
});
