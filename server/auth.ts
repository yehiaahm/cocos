import type { Env } from './env';
import { HttpError, b64url, ipHash, randomToken, sha256, str } from './http';

export const SESSION_COOKIE = 'cocos_admin';
/** Absolute session lifetime (was 14 days, and unrevocable). */
const SESSION_DAYS = 7;

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function assertConfigured(env: Env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new HttpError(503, 'Admin is not configured: set ADMIN_PASSWORD and SESSION_SECRET (32+ chars).', 'not_configured');
  }
}

/** The owner's sign-in email(s): ADMIN_EMAIL, comma-separated, compared lower-case. */
export function adminEmails(env: Pick<Env, 'ADMIN_EMAIL'>): string[] {
  return (env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdminEmail = (env: Pick<Env, 'ADMIN_EMAIL'>, email: string) => !!email && adminEmails(env).includes(email.trim().toLowerCase());

/** The owner signs in on the shop's normal login page with ADMIN_EMAIL + ADMIN_PASSWORD. */
export async function checkAdminCredentials(env: Env, email: string, password: string): Promise<boolean> {
  // Always run the password check so a wrong email takes as long as a wrong password.
  const passwordOk = await checkPassword(env, password);
  return isAdminEmail(env, email) && passwordOk;
}

/** Constant-time password check (compares HMACs so length differences don't leak). */
export async function checkPassword(env: Env, candidate: string): Promise<boolean> {
  assertConfigured(env);
  const key = await hmacKey(env.SESSION_SECRET);
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(`pw:${candidate}`)),
    crypto.subtle.sign('HMAC', key, enc.encode(`pw:${env.ADMIN_PASSWORD}`)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * Admin sessions live in the database (table admin_sessions): the cookie is a random token and only its hash is
 * stored, so signing out deletes the row and a copied cookie stops working at once.
 *  - absolute lifetime: SESSION_DAYS, idle timeout: IDLE_HOURS (measured from the last request)
 *  - the fingerprint ties a session to the current ADMIN_EMAIL + ADMIN_PASSWORD, so changing either signs everyone out
 */
const IDLE_HOURS = 24;
/** last_seen_at is only rewritten when it is older than this, to avoid a write on every request. */
const TOUCH_AFTER_SEC = 300;

const nowSec = () => Math.floor(Date.now() / 1000);
const tokenHash = (token: string) => sha256(`a:${token}`);

export async function createSession(env: Env, request?: Request): Promise<string> {
  assertConfigured(env);
  const token = randomToken(32);
  const now = nowSec();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO admin_sessions (token_hash, fingerprint, created_at, expires_at, last_seen_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      await tokenHash(token),
      await fingerprint(env),
      now,
      now + SESSION_DAYS * 86_400,
      now,
      request ? await ipHash(request, env.SESSION_SECRET) : null,
      request ? str(request.headers.get('user-agent'), 200) || null : null,
    ),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR last_seen_at < ?').bind(now, now - IDLE_HOURS * 3600),
  ]);
  return token;
}

async function fingerprint(env: Env) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), new TextEncoder().encode(`fp:${adminEmails(env).join(',')}:${env.ADMIN_PASSWORD}`));
  return b64url(sig).slice(0, 12);
}

export async function verifySession(env: Env, token: string | null): Promise<boolean> {
  if (!token || token.length > 100 || !env.SESSION_SECRET || !env.ADMIN_PASSWORD) return false;
  const hash = await tokenHash(token);
  const row = await env.DB.prepare('SELECT fingerprint, expires_at, last_seen_at FROM admin_sessions WHERE token_hash = ?')
    .bind(hash)
    .first<{ fingerprint: string; expires_at: number; last_seen_at: number }>();
  if (!row) return false;
  const now = nowSec();
  if (row.expires_at <= now || now - row.last_seen_at > IDLE_HOURS * 3600) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(hash).run();
    return false;
  }
  if (row.fingerprint !== (await fingerprint(env))) return false;
  if (now - row.last_seen_at > TOUCH_AFTER_SEC) {
    await env.DB.prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?').bind(now, hash).run();
  }
  return true;
}

/** Sign out this one session (the cookie holder's). */
export async function destroySession(env: Env, token: string | null): Promise<void> {
  if (!token || token.length > 100) return;
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await tokenHash(token)).run();
}

/** Sign out every device. */
export async function destroyAllSessions(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM admin_sessions').run();
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86_400}${secure}`;
}

export const clearCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
