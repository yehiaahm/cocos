import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { NodeD1 } from './node/d1';
import { hashPassword, createUserSession, PBKDF2_ITERATIONS, USER_COOKIE } from './accounts';
import type { Env } from './env';
import * as login from '../functions/api/auth/login';
import * as me from '../functions/api/auth/me';

/** End-to-end through the real handlers, on an in-memory database. */
const setup = () => {
  const db = new NodeD1(':memory:');
  db.migrate(path.resolve(__dirname, '../migrations'));
  return { DB: db, SESSION_SECRET: 'test-secret-'.repeat(4), ADMIN_EMAIL: '', ADMIN_PASSWORD: '' } as unknown as Env;
};

const call = (fn: unknown, env: Env, init: { method: string; ip?: string; cookie?: string; body?: unknown }) => {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-client-ip': init.ip ?? '10.0.0.1' };
  if (init.cookie) headers.cookie = init.cookie;
  const request = new Request('https://shop.example/api/auth/x', {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return (fn as (c: unknown) => Promise<Response>)({ request, env, params: {}, data: {}, waitUntil: () => undefined });
};

const addUser = async (env: Env, email: string, password: string | null, extra = '') => {
  await env.DB.prepare(`INSERT INTO users (email, name, password_hash${extra ? ', google_sub' : ''}) VALUES (?, 'Test User', ?${extra ? ', ?' : ''})`)
    .bind(...[email, password ? await hashPassword(password) : null, ...(extra ? [extra] : [])])
    .run();
};

describe('customer sign-in does not reveal which emails exist', () => {
  it('answers identically for unknown email, wrong password and Google-only accounts', async () => {
    const env = setup();
    await addUser(env, 'real@example.com', 'a-good-password-1');
    await addUser(env, 'google@example.com', null, 'g-1');
    const answers = [];
    for (const [i, email] of ['nobody@example.com', 'real@example.com', 'google@example.com'].entries()) {
      const res = await call(login.onRequestPost, env, { method: 'POST', ip: `10.0.1.${i}`, body: { email, password: 'wrong-password-9' } });
      answers.push({ status: res.status, body: await res.json() });
    }
    expect(answers[0].status).toBe(401);
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
  }, 60_000);

  it('locks one account after 10 wrong passwords even when each guess comes from a different IP', async () => {
    const env = setup();
    await addUser(env, 'victim@example.com', 'a-good-password-1');
    for (let i = 0; i < 10; i++) {
      const res = await call(login.onRequestPost, env, { method: 'POST', ip: `10.9.0.${i}`, body: { email: 'victim@example.com', password: `guess-number-${i}` } });
      expect(res.status).toBe(401);
    }
    // 11th attempt from yet another IP — even the CORRECT password is refused while locked.
    const locked = await call(login.onRequestPost, env, { method: 'POST', ip: '10.9.1.1', body: { email: 'victim@example.com', password: 'a-good-password-1' } });
    expect(locked.status).toBe(429);
    // Other accounts are unaffected.
    await addUser(env, 'other@example.com', 'another-good-pass-2');
    const ok = await call(login.onRequestPost, env, { method: 'POST', ip: '10.9.1.2', body: { email: 'other@example.com', password: 'another-good-pass-2' } });
    expect(ok.status).toBe(200);
  }, 120_000);

  it('upgrades an old 100k hash to the current cost after a successful sign-in', async () => {
    const env = setup();
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('old-password-77'), 'PBKDF2', false, ['deriveBits']);
    const salt = new Uint8Array(16).fill(3);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256));
    const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64url');
    await env.DB.prepare("INSERT INTO users (email, name, password_hash) VALUES ('old@example.com', 'T', ?)")
      .bind(`pbkdf2$100000$${b64(salt)}$${b64(bits)}`)
      .run();
    const res = await call(login.onRequestPost, env, { method: 'POST', body: { email: 'old@example.com', password: 'old-password-77' } });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT password_hash FROM users WHERE email = 'old@example.com'").first<{ password_hash: string }>();
    expect(row!.password_hash.startsWith(`pbkdf2$${PBKDF2_ITERATIONS}$`)).toBe(true);
    // …and the new hash still signs in.
    const again = await call(login.onRequestPost, env, { method: 'POST', body: { email: 'old@example.com', password: 'old-password-77' } });
    expect(again.status).toBe(200);
  }, 60_000);
});

describe('changing a password signs out the other devices', () => {
  it('keeps this device signed in and drops every other session', async () => {
    const env = setup();
    await addUser(env, 'me@example.com', 'a-good-password-1');
    const phone = await createUserSession(env, 1);
    const laptop = await createUserSession(env, 1);
    const thief = await createUserSession(env, 1);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM user_sessions').first('n')).toBe(3);

    const res = await call(me.onRequestPatch, env, {
      method: 'PATCH',
      cookie: `${USER_COOKIE}=${laptop}`,
      body: { currentPassword: 'a-good-password-1', newPassword: 'a-brand-new-passphrase-2' },
    });
    expect(res.status).toBe(200);

    const alive = async (token: string) =>
      (await (await call(me.onRequestGet, env, { method: 'GET', cookie: `${USER_COOKIE}=${token}` })).json() as { user: unknown }).user !== null;
    expect(await alive(laptop)).toBe(true);
    expect(await alive(phone)).toBe(false);
    expect(await alive(thief)).toBe(false);
  }, 60_000);

  it('does not touch other sessions when only the profile changes', async () => {
    const env = setup();
    await addUser(env, 'me@example.com', 'a-good-password-1');
    const a = await createUserSession(env, 1);
    await createUserSession(env, 1);
    const res = await call(me.onRequestPatch, env, { method: 'PATCH', cookie: `${USER_COOKIE}=${a}`, body: { name: 'New Name' } });
    expect(res.status).toBe(200);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM user_sessions').first('n')).toBe(2);
  });
});
