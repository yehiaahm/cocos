# Coco's Art — website

Handmade home-decor shop for **Coco's Art** (Instagram [@coco_resin_art](https://instagram.com/coco_resin_art)), Egypt.
React 19 + Vite + TypeScript + Tailwind CSS 4, with every page prerendered to static HTML.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (catalog, filters, cart, phone validation)
npm run build      # typecheck → client build → prerender → dist/
npm run preview    # serve dist/ on http://localhost:4173
```

Node 20.19+ is required (22 LTS recommended).

## Before going live — owner checklist

| What | Where |
|---|---|
| WhatsApp number (international digits, e.g. `2010…`) | `src/config/site.ts` → `whatsappNumber` |
| Facebook page URL | `src/config/site.ts` → `facebookUrl` |
| Production domain | `src/config/site.ts` → `url` (or a `VITE_SITE_URL` build variable) |
| Prices | `data/products.json` → set `price` and `priceStatus: "set"` |

Until the WhatsApp number is set, every WhatsApp button falls back to Instagram and checkout copies the
order for an Instagram DM. The Facebook button stays hidden until its URL is set. No link is ever dead.

## Deploying

The build outputs a fully static site in `dist/`. Each page is written as `dist/<path>.html`
(e.g. `dist/shop/resin.html`), so hosts serve it at the clean URL `/shop/resin` with no redirect.

### Cloudflare Pages (recommended)

**Option A — connect GitHub (auto-deploys on every push)**

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick this repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version comes from `.node-version` (22).
3. **Save and Deploy**. Then **Custom domains** → add the shop's domain.

**Option B — deploy from your computer**

```bash
npx wrangler login     # once
npm run deploy         # builds, then uploads dist/ to the "cocos-art" Pages project
```

Test the exact Cloudflare behaviour locally with `npm run build && npm run preview:cf` (http://localhost:8788).

What's already configured: `public/_headers` (security headers, long caching for `/assets/*` and images),
`404.html` served with a real 404 status, `wrangler.toml` (project name + output dir).
In the Cloudflare dashboard, leave **Rocket Loader** off (it delays React). Auto Minify isn't needed.

### Other hosts
- **Netlify** / **Vercel**: import the repo; `netlify.toml` / `vercel.json` are already set up.
- **Anything else**: upload `dist/`, serve `/<path>` from `/<path>.html`, use `404.html` for unknown URLs,
  and cache `/assets/*` forever (file names are hashed).

## How it fits together

```
data/products.json          80 live products (source of truth; 6 held-back items are filtered out in code too)
public/images/products      original photos, untouched
public/images/opt           generated responsive WebP (320/480/720/960/1400 px) — git-ignored, rebuilt by `npm run images`
scripts/optimize-images.mjs builds the WebP files + src/generated/image-manifest.json (sizes for srcset/width/height)
scripts/prerender.mjs       renders every route to static HTML, writes sitemap.xml, robots.txt, 404.html
scripts/make-brand-assets.mjs  regenerates favicons + og-image.jpg (outputs are committed)
src/config/site.ts          every business detail (contacts, domain, social)
src/data/catalog.ts         typed Product model, filters, search
src/data/home.ts            homepage copy and photos (swap photos here)
src/store/cart.ts           cart store, persisted to localStorage `coco-cart`, lines keyed by product + variant
src/lib/useAddToCart.ts     add → fly-to-cart → pill bump → "Added to cart ✓"
src/lib/seo.tsx             per-page title/meta/OG/canonical/JSON-LD (prerendered and client-side)
src/pages/*                 Home, Shop (/shop, /shop/:category), Product, Checkout, 404
```

### Adding or changing products
Edit `data/products.json` (same shape as today). New photos go in `public/images/products/`; the next
`npm run dev` / `npm run build` generates their WebP versions automatically.

### Checkout
There is no payment yet (prices are pending). Checkout validates name, Egyptian mobile, city and address,
then opens WhatsApp with the full order (items, options, personalisation, customer details) and an order
reference. When payment is decided, replace `onSubmit` in `src/pages/CheckoutPage.tsx`.

## Quality notes
- Responsive from 360 px with no horizontal scroll; shop grid 4 / 3 / 2 columns, never 1.
- Real buttons and links, labelled icon buttons, visible focus rings, skip link, keyboard tabs,
  drawer focus trap with Esc and focus return, `aria-live` result counts.
- All motion is disabled under `prefers-reduced-motion` (fly and bump are skipped, cart still works).
- Product JSON-LD has no `offers` until prices exist. Filtered/search URLs are `noindex`; checkout is disallowed.
