/**
 * Node server for Railway (or any Node host). Runs the API handlers in functions/** with MySQL
 * (a D1-shaped layer, see mysql.ts) and the filesystem for uploads, and serves the prerendered site from dist/.
 *
 *   PORT                 set by Railway
 *   DATABASE_URL         required — mysql://user:pass@host:3306/db (Railway's MySQL service provides MYSQL_URL, also accepted)
 *   ADMIN_EMAIL / ADMIN_PASSWORD   the dashboard sign-in
 *   DATA_DIR             where uploads, secrets.json and database dumps live (defaults to the Railway volume mount)
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MySqlDb } from './mysql';
import { FileR2 } from './r2';
import { StaticSite, SECURITY_HEADERS } from './static';
import { loadSecrets } from './secrets';
import { assertNotSilentlyRecreated, databaseStats, listBackups, startBackupSchedule } from './backup';
import { requirePersistent, resolveStorage } from './storage';
import { CLIENT_IP_HEADER, trustedClientIp } from './clientip';
import { limitedBody } from './bodystream';
import { catalogHasPath } from '../catalog';

import * as catalog from '../../functions/api/catalog';
import * as promoCheck from '../../functions/api/promo';
import * as ordersIndex from '../../functions/api/orders/index';
import * as orderStatus from '../../functions/api/orders/status';
import * as orderLookup from '../../functions/api/orders/lookup';
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
import * as adminProduct from '../../functions/api/admin/products/[id]';
import * as adminCategories from '../../functions/api/admin/categories';
import * as adminCategory from '../../functions/api/admin/categories/[slug]';
import * as adminMedia from '../../functions/api/admin/media';
import * as media from '../../functions/media/[[path]]';
import * as adminStats from '../../functions/api/admin/stats';
import * as adminCustomers from '../../functions/api/admin/customers';
import * as adminSettings from '../../functions/api/admin/settings';
import * as adminPromos from '../../functions/api/admin/promos';
import * as adminPromo from '../../functions/api/admin/promos/[id]';
import * as adminWorkshops from '../../functions/api/admin/workshops';
import * as adminWorkshop from '../../functions/api/admin/workshops/[id]';
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
const storage = resolveStorage(process.env, root);
const { dataDir, persistent: storagePersistent } = storage;

/** On Railway, the container's own disk is wiped on every deploy. Only a mounted Volume (or an explicit DATA_DIR) survives. */
console.log(`[storage] files in ${dataDir} (from ${storage.source}) · persistent: ${storagePersistent}`);
if (!storagePersistent) {
  const msg =
    'No Railway Volume attached: uploaded photos, payment screenshots, the push/session keys and database dumps are LOST on every redeploy. ' +
    'Fix: Railway → this service → Volumes → add one with mount path /data, then redeploy.';
  if (requirePersistent(process.env)) {
    console.error(`[fatal] ${msg} (REQUIRE_PERSISTENT_STORAGE is on, so the server will not start.)`);
    process.exit(1);
  }
  console.warn(`
[warn] ############################################################
[warn] ${msg}
[warn] ############################################################
`);
}

mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });

const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
if (!databaseUrl) {
  console.error('[fatal] DATABASE_URL is not set. Add a MySQL service on Railway and set DATABASE_URL=${{MySQL.MYSQL_URL}} on this service.');
  process.exit(1);
}
const backupDir = path.join(dataDir, 'backups');
const db = new MySqlDb({ url: databaseUrl });

/** The database service can still be starting when this one does: wait for it instead of crashing. */
async function connectWithRetry(timeoutMs = 90_000) {
  const t0 = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      await db.ping();
      return;
    } catch (e) {
      if (Date.now() - t0 > timeoutMs) throw e;
      console.warn(`[db] not reachable yet (${(e as { code?: string }).code ?? (e as Error).message}), retrying (${attempt})…`);
      await new Promise((r) => setTimeout(r, Math.min(5000, 500 * attempt)));
    }
  }
}
try {
  const target = new URL(databaseUrl);
  await connectWithRetry();
  console.log(`[db] connected to MySQL ${target.hostname}:${target.port || 3306}${target.pathname}`);
  await assertNotSilentlyRecreated(db, backupDir, process.env);
  const applied = await db.migrate(path.join(root, 'migrations'));
  console.log(`[db] migrations up to date${applied.length ? ` (applied ${applied.join(', ')})` : ''}`);
  console.log(`[db] rows: ${JSON.stringify(await databaseStats(db))}`);
} catch (e) {
  console.error('[fatal] database failed to start:', (e as Error).message);
  process.exit(1);
}
const stopBackups = startBackupSchedule(db, backupDir, {
  everyHours: Number(process.env.BACKUP_INTERVAL_HOURS) || 24,
  keep: Number(process.env.BACKUP_KEEP) || 14,
});
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
add('/api/promo', promoCheck);
add('/api/orders', ordersIndex);
add('/api/orders/status', orderStatus);
add('/api/orders/lookup', orderLookup);
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
add('/api/admin/products/:id', adminProduct, true);
add('/api/admin/categories', adminCategories, true);
add('/api/admin/categories/:slug', adminCategory, true);
add('/api/admin/media', adminMedia, true);
add('/api/admin/stats', adminStats, true);
add('/api/admin/customers', adminCustomers, true);
add('/api/admin/settings', adminSettings, true);
add('/api/admin/promos', adminPromos, true);
add('/api/admin/promos/:id', adminPromo, true);
add('/api/admin/workshops', adminWorkshops, true);
add('/api/admin/workshops/:id', adminWorkshop, true);
add('/api/admin/push', adminPush, true);
add('/api/admin/notifications/latest', adminLatest, true);
add('/admin/:path*', adminShell);
add('/order/:path*', orderShell);
add('/media/:path*', media);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/healthz') {
    // `persistent: false` means uploads/keys/dumps are written to the container disk and vanish on the next deploy.
    // With REQUIRE_PERSISTENT_STORAGE=1 that is a failed health check, so Railway keeps the previous deployment running.
    try {
      await db.ping();
    } catch (e) {
      console.error('[healthz] database check failed:', (e as Error).message);
      return json(503, { ok: false, error: 'database unavailable' });
    }
    const lastBackup = listBackups(backupDir).at(-1);
    const ok = storagePersistent || !requirePersistent(process.env);
    return json(ok ? 200 : 503, {
      ok,
      persistent: storagePersistent,
      lastBackupAt: lastBackup ? new Date(lastBackup.mtimeMs).toISOString() : null,
    });
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
  const res = await site.serve(request, url.pathname);
  // Products and categories added from the dashboard have no prerendered page: serve the client-rendered shell
  // for them (the browser loads the catalogue and draws the page). Anything that is not in the catalogue stays a 404.
  const dynamic = /^\/(product|shop)\/([^/]+)\/?$/.exec(url.pathname);
  if (res.status === 404 && dynamic) {
    const kind = dynamic[1] === 'product' ? 'product' : 'category';
    if (await catalogHasPath(db as unknown as D1Database, kind, decodeURIComponent(dynamic[2]))) return site.serve(request, '/app');
  }
  return res;
}

/** Hard ceiling for any request body (the largest legitimate one is a 6 MB payment screenshot). Routes enforce smaller limits themselves. */
const MAX_BODY_BYTES = 7 * 1024 * 1024;

/** Number of reverse proxies in front of this server (Railway's edge = 1). */
const TRUSTED_PROXY_HOPS = Number(process.env.TRUSTED_PROXY_HOPS) || 1;

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
  // Rate limits key on the client IP. Nothing the client sends may influence it: drop every IP-identity
  // header they could have supplied, then set our own from what the platform proxy appended.
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  headers.delete(CLIENT_IP_HEADER);
  headers.set(CLIENT_IP_HEADER, trustedClientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress, TRUSTED_PROXY_HOPS));
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`${proto}://${host}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: hasBody ? limitedBody(req, MAX_BODY_BYTES) : undefined,
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
  // Don't keep reading the rest of an oversized upload on this connection.
  if (response.status === 413) headers['connection'] = 'close';
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
    // A declared body over the ceiling is refused before a single byte of it is read.
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
      res.writeHead(413, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', connection: 'close' });
      res.end(JSON.stringify({ error: 'Request too large', code: 'too_large' }));
      return;
    }
    const response = await handle(toRequest(req));
    await send(res, response);
    if (req.url?.startsWith('/api/')) console.log(`${req.method} ${req.url?.split('?')[0]} ${response.status} ${Date.now() - started}ms`);
  } catch (e) {
    console.error('[server]', e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error' }));
  }
});

// Slow-loris style clients: headers must arrive quickly and a whole request must finish in two minutes.
server.headersTimeout = 30_000;
server.requestTimeout = 120_000;

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`[server] Coco's site on :${port} · data in ${dataDir}`));

const shutdown = () =>
  server.close(async () => {
    stopBackups();
    try {
      await db.close();
      console.log('[db] connections closed');
    } catch (e) {
      console.error('[db] error while closing:', (e as Error).message);
    }
    process.exit(0);
  });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
