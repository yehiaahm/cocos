/**
 * Node server for Railway (or any Node host). Runs the exact same API handlers as
 * Cloudflare Pages Functions (functions/**), with SQLite instead of D1 and the
 * filesystem instead of R2, and serves the prerendered site from dist/.
 *
 *   PORT                 set by Railway
 *   ADMIN_PASSWORD       required — the dashboard password
 *   DATA_DIR             where the database + uploads live (defaults to the Railway volume mount)
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { NodeD1 } from './d1';
import { FileR2 } from './r2';
import { StaticSite, SECURITY_HEADERS } from './static';
import { loadSecrets } from './secrets';

import * as catalog from '../../functions/api/catalog';
import * as ordersIndex from '../../functions/api/orders/index';
import * as orderView from '../../functions/api/orders/[number]';
import * as orderProof from '../../functions/api/orders/[number]/proof';
import * as authRegister from '../../functions/api/auth/register';
import * as authLogin from '../../functions/api/auth/login';
import * as authMe from '../../functions/api/auth/me';
import * as authGoogle from '../../functions/api/auth/google/index';
import * as authGoogleCallback from '../../functions/api/auth/google/callback';
import * as accountOrders from '../../functions/api/account/orders';
import * as adminMiddleware from '../../functions/api/admin/_middleware';
import * as adminLogin from '../../functions/api/admin/login';
import * as adminMe from '../../functions/api/admin/me';
import * as adminOrders from '../../functions/api/admin/orders/index';
import * as adminOrder from '../../functions/api/admin/orders/[id]';
import * as adminOrderProof from '../../functions/api/admin/orders/[id]/proof';
import * as adminProducts from '../../functions/api/admin/products';
import * as adminStats from '../../functions/api/admin/stats';
import * as adminCustomers from '../../functions/api/admin/customers';
import * as adminSettings from '../../functions/api/admin/settings';
import * as adminPush from '../../functions/api/admin/push';
import * as adminLatest from '../../functions/api/admin/notifications/latest';
import * as adminShell from '../../functions/admin/[[path]]';
import * as orderShell from '../../functions/order/[[path]]';

type Handler = (ctx: Ctx) => Promise<Response> | Response;
type Mod = Partial<Record<'onRequest' | 'onRequestGet' | 'onRequestPost' | 'onRequestPut' | 'onRequestPatch' | 'onRequestDelete', Handler>>;
interface Ctx {
  request: Request;
  env: Record<string, unknown>;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  waitUntil: (p: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: () => Promise<Response>;
  functionPath: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..'); // dist-server/.. = project root
const distDir = path.join(root, 'dist');
const dataDir = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(root, '.data'));
mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });

if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) {
  console.warn('\n[warn] No Railway Volume attached — orders will be LOST on every redeploy. Add a Volume (mount path /data).\n');
}

const db = new NodeD1(path.join(dataDir, 'cocos.db'));
db.migrate(path.join(root, 'migrations'));
const site = new StaticSite(distDir);
const secrets = loadSecrets(dataDir);
if (!secrets.ADMIN_EMAIL || !secrets.ADMIN_PASSWORD) {
  console.warn('[warn] ADMIN_EMAIL and ADMIN_PASSWORD must both be set — the dashboard sign-in is disabled until you add them.');
}

const env: Record<string, unknown> = {
  ...secrets,
  DB: db,
  UPLOADS: new FileR2(path.join(dataDir, 'uploads')),
  ASSETS: { fetch: (input: string | URL | Request) => site.serve(new Request(input), new URL(input instanceof Request ? input.url : input).pathname) },
};

/** Route table mirroring the functions/ folder (Cloudflare file-based routing). */
const routes: { pattern: RegExp; keys: string[]; mod: Mod; admin?: boolean }[] = [];
const add = (p: string, m: unknown, admin = false) => {
  const mod = m as Mod;
  const keys: string[] = [];
  const re = p
    .replace(/\/:\w+\*$/, () => (keys.push('path'), '(?:/(.*))?'))
    .replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'));
  routes.push({ pattern: new RegExp(`^${re}/?$`), keys, mod, admin });
};
add('/api/catalog', catalog);
add('/api/orders', ordersIndex);
add('/api/orders/:number', orderView);
add('/api/orders/:number/proof', orderProof);
add('/api/auth/register', authRegister);
add('/api/auth/login', authLogin);
add('/api/auth/me', authMe);
add('/api/auth/google', authGoogle);
add('/api/auth/google/callback', authGoogleCallback);
add('/api/account/orders', accountOrders);
add('/api/admin/login', adminLogin, true);
add('/api/admin/me', adminMe, true);
add('/api/admin/orders', adminOrders, true);
add('/api/admin/orders/:id', adminOrder, true);
add('/api/admin/orders/:id/proof', adminOrderProof, true);
add('/api/admin/products', adminProducts, true);
add('/api/admin/stats', adminStats, true);
add('/api/admin/customers', adminCustomers, true);
add('/api/admin/settings', adminSettings, true);
add('/api/admin/push', adminPush, true);
add('/api/admin/notifications/latest', adminLatest, true);
add('/admin/:path*', adminShell);
add('/order/:path*', orderShell);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/healthz') {
    await db.prepare('SELECT 1').first();
    return json(200, { ok: true });
  }

  for (const r of routes) {
    const m = r.pattern.exec(url.pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
    const method = request.method === 'HEAD' ? 'Get' : request.method[0] + request.method.slice(1).toLowerCase();
    const fn = r.mod[`onRequest${method}` as keyof Mod] ?? r.mod.onRequest;
    if (!fn) return json(405, { error: 'Method not allowed' });
    const ctx: Ctx = {
      request,
      env,
      params,
      data: {},
      waitUntil: (p) => void p.catch((e) => console.error('[waitUntil]', e)),
      passThroughOnException: () => undefined,
      functionPath: url.pathname,
      next: async () => fn(ctx),
    };
    // Same behaviour as functions/api/admin/_middleware.ts on Cloudflare.
    return r.admin && adminMiddleware.onRequest ? (adminMiddleware.onRequest as unknown as Handler)(ctx) : fn(ctx);
  }

  if (url.pathname.startsWith('/api/')) return json(404, { error: 'Not found' });
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, { error: 'Method not allowed' });
  return site.serve(request, url.pathname);
}

/** Node req → Web Request (behind Railway's proxy: trust X-Forwarded-Proto/Host). */
function toRequest(req: IncomingMessage): Request {
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost').split(',')[0].trim();
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`${proto}://${host}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error Node needs duplex for streamed request bodies
    duplex: hasBody ? 'half' : undefined,
  });
}

async function send(res: ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((v, k) => {
    if (k === 'set-cookie') return;
    headers[k] = v;
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers['set-cookie'] = cookies;
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!(k in headers)) headers[k] = v;
  res.writeHead(response.status, headers);
  if (!response.body) return void res.end();
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    const response = await handle(toRequest(req));
    await send(res, response);
    if (req.url?.startsWith('/api/')) console.log(`${req.method} ${req.url?.split('?')[0]} ${response.status} ${Date.now() - started}ms`);
  } catch (e) {
    console.error('[server]', e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error' }));
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`[server] Coco's site on :${port} · data in ${dataDir}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
