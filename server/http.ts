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

const tooLarge = () => new HttpError(413, 'Request too large', 'too_large');

/** Rejects up front when the client declares a body bigger than `maxBytes` (nothing is read). */
export function assertDeclaredSize(request: Request, maxBytes: number): void {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
}

/** Passes the body through but errors with 413 as soon as more than `maxBytes` have gone by (works for chunked bodies too). */
function capped(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let seen = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > maxBytes) throw tooLarge();
        controller.enqueue(chunk);
      },
    }),
  );
}

/** Reads a request body as text without ever holding more than `maxBytes` of it. */
export async function readBodyText(request: Request, maxBytes: number): Promise<string> {
  assertDeclaredSize(request, maxBytes);
  if (!request.body) return '';
  const reader = capped(request.body as ReadableStream<Uint8Array>, maxBytes).getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** Parses a multipart upload without ever holding more than `maxBytes` of it. Returns null when it is not valid form data. */
export async function readFormData(request: Request, maxBytes: number): Promise<FormData | null> {
  assertDeclaredSize(request, maxBytes);
  const type = request.headers.get('content-type');
  if (!request.body || !type) return null;
  try {
    return await new Response(capped(request.body as ReadableStream<Uint8Array>, maxBytes), { headers: { 'content-type': type } }).formData();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // The cap's error can surface wrapped; if we saw more than the limit it is a 413 either way.
    if (e instanceof Error && e.cause instanceof HttpError) throw e.cause;
    return null;
  }
}

export async function readJson<T>(request: Request, maxBytes = 64_000): Promise<T> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected JSON', 'bad_content_type');
  const text = await readBodyText(request, maxBytes);
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

/**
 * Hash of the client IP (never stored raw).
 * Only headers the platform sets itself are trusted: `cf-connecting-ip` (Cloudflare overwrites it) and
 * `x-client-ip` (set by server/node/server.ts after discarding any client-supplied value). `x-forwarded-for`
 * is deliberately NOT read here: a client can put anything in it.
 */
export async function ipHash(request: Request, secret: string): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-client-ip') ?? 'local';
  return (await sha256(`${secret}:${ip}`)).slice(0, 22);
}

/** Throws 429 while `bucket` has `limit` or more recorded failures in the last `windowSec` (does not record anything). */
export async function assertNotLocked(db: D1Database, bucket: string, limit: number, windowSec: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND created_at > ?')
    .bind(bucket, now - windowSec)
    .first<{ n: number }>();
  if ((row?.n ?? 0) >= limit) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', 'rate_limited');
}

/** Records one failure against `bucket` (pair with assertNotLocked). */
export async function recordFailure(db: D1Database, bucket: string): Promise<void> {
  await db
    .prepare('INSERT INTO rate_limits (bucket, created_at) VALUES (?, ?)')
    .bind(bucket, Math.floor(Date.now() / 1000))
    .run();
}

/**
 * Admin sign-in is protected by a limit that does not depend on who the client says they are:
 * at most ADMIN_FAIL_LIMIT failed attempts per window across ALL sources. (Trade-off: someone can lock the
 * owner out of the sign-in form for the window; an already-signed-in session keeps working.)
 */
export const ADMIN_FAIL_BUCKET = 'adminfail:global';
export const ADMIN_FAIL_LIMIT = 30;
export const ADMIN_FAIL_WINDOW = 15 * 60;

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
