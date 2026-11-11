import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib';

/**
 * Serves the prerendered site from dist/ the way Cloudflare Pages does:
 * clean URLs (/shop/resin → shop/resin.html), 404.html with a real 404,
 * long caching for hashed assets, brotli/gzip for text, security headers.
 */
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.xml', '.txt', '.svg']);

export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000',
};

function cacheFor(urlPath: string, ext: string): string {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (urlPath.startsWith('/images/')) return 'public, max-age=2592000, stale-while-revalidate=86400';
  if (urlPath === '/admin-sw.js' || ext === '.html') return 'no-cache';
  return 'public, max-age=86400';
}

const compressed = new Map<string, Buffer>();

export class StaticSite {
  constructor(private root: string) {}

  private async tryFile(rel: string) {
    const full = path.resolve(this.root, `.${rel}`);
    if (!full.startsWith(path.resolve(this.root))) return null;
    try {
      const s = await stat(full);
      return s.isFile() ? { full, size: s.size, mtime: s.mtimeMs } : null;
    } catch {
      return null;
    }
  }

  /** Returns a Response for a GET/HEAD of `urlPath`, or a 404 page. */
  async serve(request: Request, urlPath: string, opts: { status?: number; headers?: Record<string, string> } = {}): Promise<Response> {
    let p: string;
    try {
      p = decodeURIComponent(urlPath);
    } catch {
      p = '/';
    }
    if (p.includes('\0') || p.split('/').includes('..')) return this.notFound(request);

    // Canonical form: no trailing slash, no ".html".
    const url = new URL(request.url);
    if (p.length > 1 && p.endsWith('/')) return Response.redirect(new URL(p.replace(/\/+$/, '') + url.search, url).href, 308);
    if (p.endsWith('.html') && !p.endsWith('/404.html')) {
      const clean = p === '/index.html' ? '/' : p.slice(0, -5);
      return Response.redirect(new URL(clean + url.search, url).href, 308);
    }

    const file =
      p === '/'
        ? await this.tryFile('/index.html')
        : path.extname(p)
          ? ((await this.tryFile(p)) ?? (await this.tryFile(`${p}.html`)))
          : await this.tryFile(`${p}.html`);
    if (!file) return this.notFound(request);
    return this.respond(request, p, file, opts.status ?? 200, opts.headers);
  }

  async notFound(request: Request): Promise<Response> {
    const file = await this.tryFile('/404.html');
    if (!file) return new Response('Not found', { status: 404 });
    return this.respond(request, '/404.html', file, 404);
  }

  private async respond(request: Request, urlPath: string, file: { full: string; size: number; mtime: number }, status: number, extra?: Record<string, string>) {
    const ext = path.extname(file.full).toLowerCase();
    const etag = `W/"${file.size.toString(36)}-${Math.floor(file.mtime).toString(36)}"`;
    const headers = new Headers({
      ...SECURITY_HEADERS,
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': cacheFor(urlPath, ext),
      etag,
      vary: 'accept-encoding',
      ...extra,
    });
    if (status === 200 && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

    let body: Buffer = await readFile(file.full);
    const accept = request.headers.get('accept-encoding') ?? '';
    if (COMPRESSIBLE.has(ext) && body.length > 1024) {
      const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
      if (enc) {
        const key = `${file.full}:${etag}:${enc}`;
        let out = compressed.get(key);
        if (!out) {
          out = enc === 'br' ? brotliCompressSync(body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } }) : gzipSync(body, { level: 9 });
          compressed.set(key, out);
        }
        body = out;
        headers.set('content-encoding', enc);
      }
    }
    headers.set('content-length', String(body.length));
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(body), { status, headers });
  }
}
