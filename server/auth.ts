import type { Env } from './env';
import { HttpError, b64url, fromB64url } from './http';

export const SESSION_COOKIE = 'cocos_admin';
const SESSION_DAYS = 14;

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function assertConfigured(env: Env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new HttpError(503, 'Admin is not configured: set ADMIN_PASSWORD and SESSION_SECRET (32+ chars).', 'not_configured');
  }
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

/** Session token = payload.signature. The password fingerprint invalidates sessions when the password changes. */
export async function createSession(env: Env): Promise<string> {
  assertConfigured(env);
  const payload = b64url(
    new TextEncoder().encode(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 86_400_000, pw: await fingerprint(env) })),
  );
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), new TextEncoder().encode(payload));
  return `${payload}.${b64url(sig)}`;
}

async function fingerprint(env: Env) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), new TextEncoder().encode(`fp:${env.ADMIN_PASSWORD}`));
  return b64url(sig).slice(0, 12);
}

export async function verifySession(env: Env, token: string | null): Promise<boolean> {
  if (!token || !env.SESSION_SECRET || !env.ADMIN_PASSWORD) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), fromB64url(sig), new TextEncoder().encode(payload));
    if (!ok) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { exp: number; pw: string };
    return data.exp > Date.now() && data.pw === (await fingerprint(env));
  } catch {
    return false;
  }
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
