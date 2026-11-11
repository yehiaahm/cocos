# Coco's Resin Art — website

Handmade home-decor shop for **Coco's Resin Art** (Instagram [@coco_resin_art](https://instagram.com/coco_resin_art)), Egypt.
React 19 + Vite + TypeScript + Tailwind CSS 4, with every page prerendered to static HTML.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (storefront; /api is proxied to dev:api below)
npm test           # unit tests (catalog, filters, cart, phone validation, order totals)
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
| Prices, sold out, hidden | Dashboard → **المنتجات** (`/admin/products`) — live on the site within a minute |
| InstaPay / wallet number, delivery fee | Dashboard → **الإعدادات** (`/admin/settings`) |

Until the WhatsApp number is set, every WhatsApp button falls back to Instagram and checkout copies the
order for an Instagram DM. The Facebook button stays hidden until its URL is set. No link is ever dead.

## Orders & admin dashboard

Customers order on the site; orders land in the dashboard at **`/admin`** (Arabic, works on phones).
On Railway, see *Deploying → Railway* for the two settings it needs; the Cloudflare setup below is only for Cloudflare hosting.

- **Checkout** (`/checkout`) saves the order to the database: cash on delivery, InstaPay or mobile wallet.
  Prices come from the dashboard and are always recalculated on the server.
- **Order page** (`/order/CA-1001?t=…`) — the customer's private link: status tracker, total, payment
  details, and upload of the transfer screenshot. Shared automatically in the dashboard's WhatsApp messages.
- **Dashboard**: sales stats and charts, orders (status, pricing, payment confirmation, transfer screenshot,
  ready-made WhatsApp messages, print), products (price / sold out / hidden), customers, settings.
- **Phone notifications**: every new order and transfer screenshot pops up on the phone like a WhatsApp
  message (Web Push). Enable it from the dashboard. On iPhone first open `/admin` in Safari →
  Share → *Add to Home Screen*, then enable it from the home-screen app.

It runs on Cloudflare: **Pages Functions** (`functions/` + `server/`) for the API, **D1** for the database
(`migrations/`), **R2** for transfer screenshots.

### One-time Cloudflare setup

```bash
npx wrangler login
npx wrangler d1 create cocos-art                 # paste the printed database_id into wrangler.toml
npx wrangler r2 bucket create cocos-art-uploads
npm run db:migrate:prod                          # creates the tables
npm run setup:secrets -- "your-dashboard-password"   # prints the values below (and writes .dev.vars)
npx wrangler pages secret put ADMIN_PASSWORD
npx wrangler pages secret put SESSION_SECRET
npx wrangler pages secret put VAPID_PUBLIC_KEY
npx wrangler pages secret put VAPID_PRIVATE_KEY
npx wrangler pages secret put VAPID_SUBJECT      # mailto:you@example.com
```

Then deploy (Git integration or `npm run deploy`), open `https://<your-domain>/admin`, sign in, fill in
**الإعدادات** (InstaPay, wallet, delivery fee) and prices in **المنتجات**, and enable notifications on your phone.
Keep the VAPID keys forever — new keys mean every phone has to enable notifications again.
To change the dashboard password, update the `ADMIN_PASSWORD` secret; all devices are signed out.

### Local development with the API

```bash
npm run setup:secrets            # once: .dev.vars with a random password (printed)
npm run db:migrate               # once: local D1 database
npm run build && npm run dev:api # full site + API + dashboard on http://localhost:8788
npm run dev                      # optional: hot-reload storefront on :5173, /api proxied to :8788
```

Security: dashboard sessions are signed HttpOnly cookies (SameSite=Strict); login is rate-limited; all writes
check the request origin; order creation is rate-limited per IP with a bot honeypot; customer order pages need
their secret token; transfer screenshots are private (served only to the dashboard).

## Deploying

The build outputs a fully static site in `dist/`. Each page is written as `dist/<path>.html`
(e.g. `dist/shop/resin.html`), so hosts serve it at the clean URL `/shop/resin` with no redirect.

### Railway (current host)

The repo runs on Railway as one Node service (`server/node/server.ts`, bundled to `dist-server/server.mjs`).
It serves the site and runs the same API/dashboard code as Cloudflare, with Node's built-in SQLite as the
database and files for transfer screenshots. `railway.json` already sets the build (`npm run build`),
start (`npm start`) and health check (`/healthz`).

One-time setup in the Railway service:

1. **Volume** → add one, mount path **`/data`**. Required — without it orders are lost on every redeploy.
2. **Variables** → add **`ADMIN_PASSWORD`** (the dashboard password). Optional: `VAPID_SUBJECT=mailto:you@example.com`.
3. Redeploy, then open `https://<your-railway-domain>/admin`.

The session secret and push-notification keys are generated on first start and saved on the volume
(`/data/secrets.json`); the database is `/data/cocos.db` (back it up by downloading it from the volume).
Migrations in `migrations/` run automatically on start.

Run the same server locally: `npm run build && ADMIN_PASSWORD=test npm start` → http://localhost:3000.

### Cloudflare Pages (alternative)

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
`404.html` served with a real 404 status, `wrangler.toml` (project name, output dir, D1 + R2 bindings).
The API and dashboard need the one-time setup in *Orders & admin dashboard* above.
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
src/pages/*                 Home, Shop (/shop, /shop/:category), Product, Checkout, Order, 404
src/store/live.ts           live prices / stock / payment details from the dashboard (GET /api/catalog)
src/admin/*                 the dashboard (lazy-loaded chunk, Arabic RTL): pages, charts, push notifications
functions/api/*             Cloudflare Pages Functions: /api/orders, /api/catalog, /api/admin/*
functions/admin, order      serve the client-rendered shells for /admin/* and /order/*
server/*                    shared API code: auth, D1 queries, catalog, Web Push (VAPID)
migrations/*.sql            D1 schema
public/admin-sw.js          service worker that shows new-order notifications
```

### Adding or changing products
Edit `data/products.json` (same shape as today). New photos go in `public/images/products/`; the next
`npm run dev` / `npm run build` generates their WebP versions automatically.

### Checkout
Checkout validates name, Egyptian mobile, city and address on both the browser and the server, then saves
the order (`POST /api/orders`) and sends the customer to their order page. Unpriced items stay
"Price pending" until Coco sets the price on the order in the dashboard. Online card payment (Paymob/Fawry)
can be added later as a fourth payment method.

## Quality notes
- Responsive from 360 px with no horizontal scroll; shop grid 4 / 3 / 2 columns, never 1.
- Real buttons and links, labelled icon buttons, visible focus rings, skip link, keyboard tabs,
  drawer focus trap with Esc and focus return, `aria-live` result counts.
- All motion is disabled under `prefers-reduced-motion` (fly and bump are skipped, cart still works).
- Product JSON-LD has no `offers` until prices exist. Filtered/search URLs are `noindex`; checkout is disallowed.
