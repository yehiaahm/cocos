import { describe, expect, it } from 'vitest';
import { hashPassword, isEmail, normaliseEmail, safeNext, verifyPassword } from './accounts';

describe('customer passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('resin-and-gold');
    const b = await hashPassword('resin-and-gold');
    expect(a).not.toBe(b);
    expect(a.startsWith('pbkdf2$100000$')).toBe(true);
    expect(await verifyPassword('resin-and-gold', a)).toBe(true);
    expect(await verifyPassword('resin-and-gold!', a)).toBe(false);
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'garbage')).toBe(false);
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
