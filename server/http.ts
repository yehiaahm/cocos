export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
  ) {
    super(message);
  }
}

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

export function json(data: unknown, init: ResponseInit & { cache?: string } = {}): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(baseHeaders)) headers.set(k, v);
  headers.set('cache-control', init.cache ?? 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message, code: err.code }, { status: err.status });
  console.error('Unhandled API error', err);
  return json({ error: 'Something went wrong. Please try again.', code: 'server_error' }, { status: 500 });
}

/** Wraps a handler so thrown HttpErrors become JSON responses. */
export function handle<C>(fn: (ctx: C) => Promise<Response>) {
  return async (ctx: C): Promise<Response> => {
    try {
      return await fn(ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson<T>(request: Request, maxBytes = 64_000): Promise<T> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected JSON', 'bad_content_type');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large', 'too_large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON', 'bad_json');
  }
}

export const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function intOrNull(v: unknown, { min = 0, max = 10_000_000 } = {}): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, 'Invalid number', 'bad_number');
  return Math.round(n);
}

export function randomToken(bytes = 18): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return b64url(b);
}

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export async function sha256(text: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** Hash of the client IP (never stored raw). */
export async function ipHash(request: Request, secret: string): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'local';
  return (await sha256(`${secret}:${ip}`)).slice(0, 22);
}

/** Simple sliding-window limiter backed by D1. Throws 429 when `limit` is exceeded within `windowSec`. */
export async function rateLimit(db: D1Database, bucket: string, limit: number, windowSec: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND created_at > ?')
    .bind(bucket, now - windowSec)
    .first<{ n: number }>();
  if ((row?.n ?? 0) >= limit) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', 'rate_limited');
  await db.batch([
    db.prepare('INSERT INTO rate_limits (bucket, created_at) VALUES (?, ?)').bind(bucket, now),
    db.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(now - 86_400),
  ]);
}

/** Blocks cross-site writes: the Origin of a state-changing request must be this site. */
export function assertSameOrigin(request: Request): void {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-site request blocked', 'bad_origin');
}
