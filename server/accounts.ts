import type { Env } from './env';
import { HttpError, b64url, fromB64url, randomToken, sha256 } from './http';
import { readCookie as readCookieValue } from './auth';
import type { AccountUser } from '../src/lib/api-types';

/**
 * Customer accounts (separate from the admin dashboard login in ./auth.ts).
 *  - Passwords: PBKDF2-SHA256 (Web Crypto, works on Cloudflare and Node), random salt per user.
 *  - Sessions: random token in an HttpOnly cookie; only its SHA-256 is stored in user_sessions.
 *  - Google: OAuth 2.0 authorization-code flow with PKCE + state (see functions/api/auth/google/*).
 */

export const USER_COOKIE = 'cocos_user';
const SESSION_DAYS = 30;
// Cloudflare Workers cap PBKDF2 at 100k iterations.
const PBKDF2_ITERATIONS = 100_000;

export interface UserRow {
  id: number;
  email: string;
  email_verified: number;
  name: string;
  password_hash: string | null;
  google_sub: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
}

export function toAccountUser(u: UserRow): AccountUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatar_url,
    phone: u.phone,
    city: u.city,
    address: u.address,
    hasPassword: !!u.password_hash,
    google: !!u.google_sub,
    createdAt: u.created_at,
  };
}

export const normaliseEmail = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 254) : '');
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/* ---------------- passwords ---------------- */

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const got = await pbkdf2(password, fromB64url(salt), Number(iter));
  const want = fromB64url(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export function checkPasswordStrength(password: string): void {
  if (password.length < 8) throw new HttpError(400, 'Use at least 8 characters for your password.', 'password');
  if (password.length > 200) throw new HttpError(400, 'That password is too long.', 'password');
}

/* ---------------- sessions ---------------- */

export async function createUserSession(env: Env, userId: number): Promise<string> {
  const token = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(
      await sha256(`s:${token}`),
      userId,
      now + SESSION_DAYS * 86_400,
    ),
    env.DB.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(userId),
    env.DB.prepare('DELETE FROM user_sessions WHERE expires_at < ?').bind(now),
  ]);
  return token;
}

/** The signed-in customer for this request, or null. */
export async function getSessionUser(env: Env, request: Request): Promise<UserRow | null> {
  const token = readCookieValue(request, USER_COOKIE);
  if (!token || token.length > 100) return null;
  return env.DB.prepare(
    `SELECT u.* FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(`s:${token}`), Math.floor(Date.now() / 1000))
    .first<UserRow>();
}

export async function requireUser(env: Env, request: Request): Promise<UserRow> {
  const user = await getSessionUser(env, request);
  if (!user) throw new HttpError(401, 'Please sign in.', 'unauthorized');
  return user;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = readCookieValue(request, USER_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM user_sessions WHERE token_hash = ?').bind(await sha256(`s:${token}`)).run();
}

const secureFlag = (request: Request) => (new URL(request.url).protocol === 'https:' ? '; Secure' : '');

// SameSite=Lax (not Strict) so the cookie is sent when Google redirects back to the site.
export const userCookie = (token: string, request: Request) =>
  `${USER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secureFlag(request)}`;
export const clearUserCookie = (request: Request) => `${USER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(request)}`;

/** Only same-site paths are allowed as a post-login destination (no open redirects). */
export function safeNext(v: string | null | undefined): string {
  const FALLBACK = '/account';
  // Control characters (TAB/CR/LF are stripped by browsers when they resolve a Location header, so "/<TAB>/evil.example"
  // would become "//evil.example") and backslashes are never legitimate in a destination path.
  if (!v || v.length > 300 || /[\u0000-\u001f\u007f\\]/.test(v)) return FALLBACK;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/api/')) return FALLBACK;
  // Parse it the way a browser would and insist it stays on this origin.
  try {
    const u = new URL(v, 'https://placeholder.invalid');
    if (u.origin !== 'https://placeholder.invalid') return FALLBACK;
    const out = u.pathname + u.search + u.hash;
    return out.startsWith('//') || out.startsWith('/api/') ? FALLBACK : out;
  } catch {
    return FALLBACK;
  }
}

/* ---------------- Google ---------------- */

export const googleConfigured = (env: Env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const OAUTH_COOKIE = 'cocos_oauth';
export const googleRedirectUri = (request: Request) => `${new URL(request.url).origin}/api/auth/google/callback`;

export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

export const oauthCookie = (value: string, request: Request) =>
  `${OAUTH_COOKIE}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secureFlag(request)}`;
export const clearOauthCookie = (request: Request) =>
  `${OAUTH_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(request)}`;

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/**
 * Exchanges the authorization code for tokens. The ID token comes straight from Google's token
 * endpoint over TLS, so (per Google's docs) its claims can be trusted without re-checking the
 * signature; we still check issuer, audience and expiry.
 */
export async function exchangeGoogleCode(env: Env, request: Request, code: string, verifier: string): Promise<GoogleProfile> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(request),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !data.id_token) {
    console.error('[google] token exchange failed', res.status, data.error);
    throw new HttpError(502, 'Google sign-in failed.', 'google_exchange');
  }
  const part = data.id_token.split('.')[1];
  const claims = JSON.parse(new TextDecoder().decode(fromB64url(part))) as {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    given_name?: string;
    picture?: string;
  };
  const issOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  if (!issOk || claims.aud !== env.GOOGLE_CLIENT_ID || !claims.exp || claims.exp * 1000 < Date.now() || !claims.sub) {
    throw new HttpError(502, 'Google sign-in failed.', 'google_claims');
  }
  const email = normaliseEmail(claims.email);
  if (!email) throw new HttpError(400, 'Your Google account has no email address.', 'google_email');
  return {
    sub: claims.sub,
    email,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: (claims.name || claims.given_name || email.split('@')[0]).slice(0, 80),
    picture: claims.picture && /^https:\/\//.test(claims.picture) ? claims.picture.slice(0, 500) : null,
  };
}

/** Finds or creates the account for a Google profile. */
export async function upsertGoogleUser(env: Env, g: GoogleProfile): Promise<UserRow> {
  const bySub = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(g.sub).first<UserRow>();
  if (bySub) {
    await env.DB.prepare('UPDATE users SET avatar_url = COALESCE(?, avatar_url) WHERE id = ?').bind(g.picture, bySub.id).run();
    return bySub;
  }
  if (!g.emailVerified) throw new HttpError(400, 'Please verify your email address with Google first.', 'google_unverified');

  const byEmail = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(g.email).first<UserRow>();
  if (byEmail) {
    // Google just proved this person owns the address. If the existing account was never
    // verified, its password could have been set by someone else: drop it and its sessions.
    const stmts = [
      env.DB.prepare(
        `UPDATE users SET google_sub = ?, email_verified = 1, avatar_url = COALESCE(avatar_url, ?)${
          byEmail.email_verified ? '' : ', password_hash = NULL'
        } WHERE id = ?`,
      ).bind(g.sub, g.picture, byEmail.id),
    ];
    if (!byEmail.email_verified) stmts.push(env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(byEmail.id));
    await env.DB.batch(stmts);
    return (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(byEmail.id).first<UserRow>())!;
  }

  await env.DB.prepare('INSERT INTO users (email, email_verified, name, google_sub, avatar_url) VALUES (?, 1, ?, ?, ?)')
    .bind(g.email, g.name, g.sub, g.picture)
    .run();
  return (await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(g.sub).first<UserRow>())!;
}
