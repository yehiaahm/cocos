import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { App } from './App';
import { HeadProvider, type HeadCollector } from './lib/seo';
import { products, categories } from './data/catalog';

/** Render one route to HTML for static prerendering (see scripts/prerender.mjs). */
export function render(url: string) {
  const head: HeadCollector = {};
  const html = renderToString(
    <StrictMode>
      <HeadProvider value={head}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </HeadProvider>
    </StrictMode>,
  );
  return { html, head: head.head ?? '' };
}

/** Every public URL, for prerendering and sitemap.xml. */
export const routes: string[] = [
  '/',
  '/shop',
  ...categories.map((c) => `/shop/${c.slug}`),
  ...products.map((p) => `/product/${p.slug}`),
  '/checkout',
];

export { site } from './config/site';
