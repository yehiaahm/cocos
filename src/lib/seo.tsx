import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { absoluteUrl, site } from '../config/site';

export interface SeoProps {
  title: string;
  description?: string;
  /** Path of the page, e.g. "/shop/resin". Used for the canonical URL. */
  path: string;
  image?: string;
  type?: 'website' | 'product';
  noindex?: boolean;
  jsonLd?: object | object[];
}

/** During prerender the server collects the head tags here; in the browser they are applied to document.head. */
export interface HeadCollector {
  head?: string;
}
const HeadContext = createContext<HeadCollector | null>(null);
export const HeadProvider = ({ value, children }: { value: HeadCollector; children: ReactNode }) => (
  <HeadContext.Provider value={value}>{children}</HeadContext.Provider>
);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** JSON-LD inside <script>: escape "<" so no string can close the tag. */
const jsonForScript = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

function buildTags(p: SeoProps) {
  const title = p.title.includes(site.name) ? p.title : `${p.title} · ${site.name}`;
  const description = (p.description ?? site.description).replace(/\s+/g, ' ').trim().slice(0, 300);
  const url = absoluteUrl(p.path);
  const image = absoluteUrl(p.image ?? site.ogImage);
  const meta: [attr: 'name' | 'property', key: string, value: string][] = [
    ['name', 'description', description],
    ['name', 'robots', p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'],
    ['property', 'og:site_name', site.name],
    ['property', 'og:type', p.type === 'product' ? 'product' : 'website'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:image', image],
    ['property', 'og:locale', site.locale],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image],
  ];
  const ld = p.jsonLd ? (Array.isArray(p.jsonLd) ? p.jsonLd : [p.jsonLd]) : [];
  return { title, url, meta, ld };
}

export function Seo(props: SeoProps) {
  const collector = useContext(HeadContext);

  if (collector && typeof document === 'undefined') {
    const { title, url, meta, ld } = buildTags(props);
    collector.head = [
      `<title>${esc(title)}</title>`,
      ...meta.map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}" data-seo>`),
      props.noindex ? '' : `<link rel="canonical" href="${esc(url)}" data-seo>`,
      ...ld.map((o) => `<script type="application/ld+json" data-seo>${jsonForScript(o)}</script>`),
    ]
      .filter(Boolean)
      .join('\n    ');
  }

  const key = JSON.stringify(props);
  useEffect(() => {
    const { title, url, meta, ld } = buildTags(props);
    document.title = title;
    document.head.querySelectorAll('[data-seo]').forEach((n) => n.remove());
    const frag = document.createDocumentFragment();
    for (const [a, k, v] of meta) {
      const m = document.createElement('meta');
      m.setAttribute(a, k);
      m.content = v;
      m.dataset.seo = '';
      frag.appendChild(m);
    }
    if (!props.noindex) {
      const l = document.createElement('link');
      l.rel = 'canonical';
      l.href = url;
      l.dataset.seo = '';
      frag.appendChild(l);
    }
    for (const o of ld) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(o);
      s.dataset.seo = '';
      frag.appendChild(s);
    }
    document.head.appendChild(frag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
