// Renders every route to static HTML (fast first paint + full SEO content for crawlers),
// then writes sitemap.xml, robots.txt and 404.html. Runs after the client and SSR builds.
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');

let template = await readFile(path.join(dist, 'index.html'), 'utf8');

// Inline the (small, ~11 kB gzip) stylesheet so first paint doesn't wait on another request.
const cssLink = template.match(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/);
if (cssLink) {
  const css = await readFile(path.join(dist, cssLink[1]), 'utf8');
  template = template.replace(cssLink[0], () => `<style>${css}</style>`);
}
if (!template.includes('<div id="root"><!--app-html--></div>')) throw new Error('index.html is missing the <!--app-html--> root placeholder');
const { render, routes, site } = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href);

const page = (url) => {
  const { html, head } = render(url);
  return template
    .replace('<!--app-head-->', head)
    .replace('<div id="root"><!--app-html--></div>', `<div id="root" data-path="${url}">${html}</div>`);
};

// "/shop/resin" is written as dist/shop/resin.html (not shop/resin/index.html) so Cloudflare Pages,
// Netlify and Vercel all serve it at the clean URL with no trailing-slash redirect.
for (const url of routes) {
  const file = url === '/' ? path.join(dist, 'index.html') : path.join(dist, `${url.slice(1)}.html`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, page(url));
}
// data-path="*": hosts only serve 404.html for URLs that aren't prerendered routes, so it always hydrates.
await writeFile(path.join(dist, '404.html'), page('/404').replace('data-path="/404"', 'data-path="*"'));

// Client-rendered shells: the dashboard and customers' private order pages are never prerendered
// (they need live data and must not be indexed). functions/admin and functions/order serve them for every sub-URL.
const shell = (title, extraHead = '') =>
  template
    .replace('<!--app-head-->', `<title>${title}</title>\n    <meta name="robots" content="noindex, nofollow">${extraHead}`)
    .replace('<div id="root"><!--app-html--></div>', '<div id="root"></div>');
await writeFile(
  path.join(dist, 'admin.html'),
  shell(
    `Dashboard · ${site.name}`,
    '\n    <meta name="apple-mobile-web-app-capable" content="yes">\n    <meta name="apple-mobile-web-app-title" content="Coco Admin">',
  ).replace('href="/site.webmanifest"', 'href="/admin.webmanifest"'),
);
await writeFile(path.join(dist, 'order.html'), shell(`Your order · ${site.name}`));
// Products and categories created in the dashboard after this build have no prerendered page. The Node server answers
// those URLs with this shell (indexable, client-rendered) once it has checked that the slug exists in the catalogue.
await writeFile(
  path.join(dist, 'app.html'),
  template.replace('<!--app-head-->', `<title>${site.name}</title>`).replace('<div id="root"><!--app-html--></div>', '<div id="root"></div>'),
);

const today = new Date().toISOString().slice(0, 10);
const indexable = routes.filter((r) => !['/checkout', '/login', '/account', '/orders'].includes(r));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable
  .map(
    (r) =>
      `  <url><loc>${site.url}${r === '/' ? '/' : r}</loc><lastmod>${today}</lastmod><priority>${
        r === '/' ? '1.0' : r.startsWith('/shop') ? '0.8' : '0.6'
      }</priority></url>`,
  )
  .join('\n')}
</urlset>
`;
await writeFile(path.join(dist, 'sitemap.xml'), sitemap);
await writeFile(
  path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /login\nDisallow: /account\nDisallow: /orders\nDisallow: /admin\nDisallow: /order/\nDisallow: /api/\n\nSitemap: ${site.url}/sitemap.xml\n`,
);

// Content-Security-Policy. The only inline script is the tiny head snippet in index.html, allowed by its hash
// (computed here from every built page, so editing the snippet never needs a manual CSP change).
const htmlFiles = [];
const walk = async (dir) => {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
};
await walk(dist);
const hashes = new Set();
for (const f of htmlFiles) {
  const src = await readFile(f, 'utf8');
  // Executable inline scripts only: no src, not a data block such as application/ld+json.
  for (const m of src.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*\btype="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) {
    // Browsers normalise CRLF / lone CR to LF before checking a CSP hash, so the hash must be taken on the same text
    // (index.html may have Windows line endings on a developer machine).
    const text = m[1].replace(/\r\n?/g, '\n');
    hashes.add(`'sha256-${createHash('sha256').update(text).digest('base64')}'`);
  }
}
const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
await writeFile(path.join(dist, 'csp.txt'), csp);
// Cloudflare Pages / Netlify read dist/_headers; the Node server reads dist/csp.txt.
await appendFile(path.join(dist, '_headers'), `\n# Added by scripts/prerender.mjs (script hashes change with index.html)\n/*\n  Content-Security-Policy: ${csp}\n`);

await rm(ssrDir, { recursive: true, force: true });

if (site.url.includes('example.com')) {
  console.warn('\n[prerender] WARNING: VITE_SITE_URL is not set — canonical, Open Graph and sitemap URLs use example.com.\n');
}
console.log(`[prerender] ${routes.length} pages + 404.html, sitemap.xml (${indexable.length} URLs), robots.txt`);
