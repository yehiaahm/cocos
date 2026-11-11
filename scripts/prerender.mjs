// Renders every route to static HTML (fast first paint + full SEO content for crawlers),
// then writes sitemap.xml, robots.txt and 404.html. Runs after the client and SSR builds.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

for (const url of routes) {
  const file = url === '/' ? path.join(dist, 'index.html') : path.join(dist, url.slice(1), 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, page(url));
}
// data-path="*": hosts only serve 404.html for URLs that aren't prerendered routes, so it always hydrates.
await writeFile(path.join(dist, '404.html'), page('/404').replace('data-path="/404"', 'data-path="*"'));

const today = new Date().toISOString().slice(0, 10);
const indexable = routes.filter((r) => r !== '/checkout');
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
  `User-agent: *\nAllow: /\nDisallow: /checkout\n\nSitemap: ${site.url}/sitemap.xml\n`,
);

await rm(ssrDir, { recursive: true, force: true });

if (site.url.includes('example.com')) {
  console.warn('\n[prerender] WARNING: VITE_SITE_URL is not set — canonical, Open Graph and sitemap URLs use example.com.\n');
}
console.log(`[prerender] ${routes.length} pages + 404.html, sitemap.xml (${indexable.length} URLs), robots.txt`);
