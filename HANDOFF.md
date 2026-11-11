# Coco's Art — Website Build Handoff

Handmade home-decor e-commerce site for **Coco's Art** (Instagram: `@coco_resin_art`), Egypt.
Currency **EGP**. The site is in English, with Arabic accent labels.

This package has the approved design, the product data and all product photos. Build a
production website from it.

---

## 1. What's in this folder

| Path | What it is |
|---|---|
| `design-reference/Main.reference.html` | Homepage design: the visual source of truth |
| `design-reference/Shop.reference.html` | Shop page design, including the cart, fly-to-cart animation and floating cart |
| `data/products.json` | **80 products to show on the site** (variants merged, categories final) |
| `data/catalog-full-110.json` | Full 110-item catalog, including 6 hidden items still under review |
| `data/catalog-review.xlsx` | The same catalog as a spreadsheet, for the owner |
| `public/images/products/*.jpg` | Original product photos (unedited, full quality); file name = image id |
| `public/images/legacy-crops/*.jpg` | Low-res crops used in a few homepage spots (replace later) |

### About the reference files
The `.reference.html` files were built in a design-prototyping format. **Do not copy that
runtime.** Read them for layout, copy, colours, sizes and animation CSS, then rebuild them as
real components:

- `{{value}}` is a template binding.
- `<sc-for list=… as=…>` is a loop.
- `<sc-if value=…>` is a conditional.
- `class Component extends DCLogic { renderVals() … }` holds the state and logic.
- `<helmet><style>` holds the page CSS (keyframes, hover states, media queries).
- Links like `Shop.dc.html` mean the `/shop` route, and `Main.dc.html` means `/`.

---

## 2. Recommended stack
- **React + Vite + TypeScript**, React Router.
- Styling: Tailwind or CSS Modules. Put the tokens below in one theme file.
- State: a small cart store (Zustand or Context) persisted to `localStorage` under the key
  `coco-cart`.
- Data: start from `data/products.json` as a static import. Keep a typed `Product`
  interface so it can later move to an API or CMS.
- Images: serve from `/public/images`. Use `loading="lazy"`, set `width`/`height`, and
  generate responsive WebP versions at build time. **Keep the originals.**

---

## 3. Routes
| Route | Content |
|---|---|
| `/` | Homepage (see §5) |
| `/shop` | All products, with filters |
| `/shop/:category` | Same page, category preselected (`gaming`, `resin`, `wood-decoupage`, `macrame`, `candles`) |
| `/product/:slug` | **New**: product page with image gallery and variant (colour) picker |
| `/checkout` | Placeholder for now (prices pending). Show the order summary and a "Coco will confirm your total" form: name, phone, city, address, notes |
| 404 | Simple branded page |

The cart is a **drawer** on every page, not a route.

---

## 4. Design tokens

### Colours
| Token | Hex | Use |
|---|---|---|
| `cream` | `#F7F3EC` | Page background |
| `sand` | `#ECE3D3` / `#E9DFCF` | Section gradients, panels |
| `ink` | `#0B2E33` | Main text, dark buttons, nav cart |
| `deep` | `#072B33` | Footer background |
| `teal` | `#14A3A0` | Primary CTA, accents |
| `teal-dark` | `#0E6F6C` | Eyebrow labels, links (passes contrast on cream) |
| `teal-light` | `#4FD1C5` / `#A6F0E6` | Highlights on dark backgrounds |
| `gold` | `#D4AF5A` | Badges, secondary CTA on dark |
| `gold-light` | `#F3DE9E` | Script logo on dark, shimmer |
| `gold-dark` | `#8A6A1F` | Script logo on light |
| `price` | `#7A5C14` | "Price pending" text |
| `muted` | `#3F5457` (body), `#4A5E61` (small) | Secondary text |
| `line` | `#D9D0C1` / `#E2D9CA` | Borders, dividers |
| `skeleton` | `#ECE4D6` | Loading shimmer |

### Typography (Google Fonts)
- **Cormorant Garamond** 500/600 + italic: all headings. Display size is `clamp(52px,7vw,104px)`,
  with italic `<em>` used for emphasis.
- **Manrope** 400–700: body, buttons, labels.
- **Pinyon Script**: the "Coco's" logotype and small script accents.
- **Tajawal** 500/700: Arabic labels (`dir="rtl" lang="ar"`).
- Eyebrow labels: 13px / 700 / `letter-spacing:.2em` / uppercase / teal-dark.

### Shape and layout
- Container `max-width:1280px`, side padding 32px (16px on phones).
- Radii: cards 24–28px, inner images 16px, buttons and pills `999px`.
- Touch targets ≥ 44px.
- Shadows: soft and long, e.g. `0 26px 56px -30px rgba(11,46,51,.5)`.

---

## 5. Homepage sections (in order)
1. **Nav**
   - Logo: SVG brush-stroke "C" that draws itself on load, "Coco's" in script and "ART" in caps.
   - Links: Shop, Categories, Board games, Workshops, Custom gifts.
   - Account icon, and a Cart button with a count badge.
   - On phones the links collapse. **Add a hamburger menu** (the reference just hides them).
2. **Hero**
   - Left: headline "Art you can *hold,* poured by hand." with gold shimmer on "hold,", a
     subtitle, the CTAs "Shop now" (→ /shop) and "Book a workshop", and three stats.
   - Right: an animated **resin disc**:
     - The blob morphs shape (14s loop).
     - Two conic and radial highlight layers spin in opposite directions (26s and 40s).
     - Gold flecks twinkle.
     - Glossy highlight, white rim.
     - Floating product photos, a "Personalised" chip and a rotating text badge.
3. **Marquee** (dark, rotated −1.2°): Resin ✦ Candles ✦ Decoupage ✦ Board games ✦ Macramé ✦
   Ramadan & Eid ✦ Custom gifts.
4. **Shop by category**
   - Left: 5 tabs. Right: a panel with photo, Arabic name, product count, description,
     sub-category chips and "Shop all X".
   - Each chip and button links to `/shop/:category`.
5. **Best sellers**: 4 product cards with Add to cart, and a "View all 80 products" link.
6. **Board games** (dark section):
   - Photo, plus a mini XO board whose X/O marks pop in one by one.
   - Game list: XO, Domino, Chess. CTA → `/shop/gaming`.
7. **Workshops**: 4 tabs (Resin, Candle making, Decoupage, Concrete art). Each tab shows a
   photo, a description and a 2-day timeline: Day 1 → one-week cure → Day 2. CTA "Book & pay online".
8. **Custom gifts**: 3 numbered steps, plus layered floating photos.
9. **Instagram strip**: 6 square tiles that link to Instagram.
10. **Footer CTA**: "Let's make something / poured *just for you.*" with buttons for custom
    orders on WhatsApp, Instagram and Facebook, then the footer bar.

---

## 6. Shop page
- **Header band**: eyebrow, headline "Every piece, *made by hand.*", subtitle.
- **Category pills**: All / Board Games / Resin / Wood & Decoupage / Macramé / Candles, each
  with a live count. Counts respect the occasion filter and the search.
- **Occasion pills**: All / Ramadan & Eid / Halloween / Christmas / Personalised (from `tags`).
- **Search**: by name and description.
- **Results**: a results count with `aria-live`, a skeleton loading grid, an empty state with
  "Clear filters", and an error state.
- **Grid**:
  - **4 columns ≥1100px, 3 columns ≥820px, 2 columns on tablets and phones.**
  - **Never one product per row**, even on phones.
- **Product card**:
  - Photo (4:5, `object-fit: cover`, zooms on hover), category badge, and an "N options"
    badge when it has variants.
  - Serif name, a 2-line clamped description (hidden on phones), "Price pending", and an
    "Add to cart" button that becomes "In cart ✓".
  - The card links to `/product/:slug`. The button must not navigate.
- **Phones (≤560px)**: smaller card padding, 18px name, full-width button, and the filter
  pills scroll horizontally.

---

## 7. Cart behaviour (important — the owner asked for this exactly)
1. **Add to cart never opens the drawer and never goes to checkout.**
2. On add, play the **fly-to-cart animation**:
   - Clone the product photo as an 80px circle with a white border.
   - Start it at the clicked card, roughly one third down the image.
   - Move it to the floating cart at the bottom centre over 0.8s, in an **arc**. The outer
     element moves X linearly. The inner element moves Y with
     `cubic-bezier(.6,-.55,.9,.5)` (a small hop up, then a drop), scales from 1 to 0.3 and
     fades to 0.35.
   - Remove the clone after about 900ms.
3. **Floating cart pill**, fixed bottom-centre and 20px from the bottom:
   - Dark pill containing a teal circle with a bag icon and a gold count badge, the text
     "N items in your cart", and a cream "View ▲" button.
   - Appears only when the cart has at least one item (slide up + scale in).
   - When the flying photo lands (0.7s delay), the pill does a **bump**: scale 1 → 1.14 →
     0.95 → 1.04 → 1 with a slight rotation, over 0.6s.
   - Its text reads "Added to cart ✓" for about 1.9s, then goes back to the count.
4. **Clicking the pill** (or the nav Cart button) opens the **cart drawer** from the right:
   - Max width 420px, scrim at `rgba(7,43,51,.5)`, slide-in over 0.45s.
   - Header: "Your cart (N)" and a close ✕. It also closes on scrim click and on **Esc**,
     with a focus trap and focus returned to the trigger.
   - Line items: thumbnail, name, chosen variant, "Price pending", a − qty + stepper, and Remove.
   - Footer: Subtotal "Price pending", the note "Coco will confirm your total before payment.
     Delivery across Egypt.", a **Checkout** button (→ `/checkout`) and "Continue shopping".
   - Empty state: "Your cart is *empty.*"
5. The cart is shared across all pages and **persisted to `localStorage`** (`coco-cart`).
   Cart lines are keyed by product id + variant id.
6. Respect `prefers-reduced-motion`: skip the fly and bump, and keep the pill and drawer working.

---

## 8. Product page (new — not in the reference; build it in the same style)
- Gallery built from the selected variant's `images` (thumbnails + main image).
- Name, category link, description and material.
- **Variant picker** when `variants.length > 1`: show each option as a small photo chip
  labelled with its name. Switching a variant swaps the gallery.
- "Price pending" (or the price once known), a quantity stepper and Add to cart (same
  fly-to-cart behaviour).
- Personalised products (tag `personalised`) get a "Name / text to add" input that is stored
  on the cart line.
- "You may also like": 4 products from the same category.

---

## 9. Data (`data/products.json`)
```ts
type Product = {
  id: string;            // "coco-052"
  slug: string;
  name: string;
  category: "gaming" | "resin" | "wood-decoupage" | "macrame" | "candles";
  categoryName: string;
  description: string;
  image: string;         // card image
  tags: ("ramadan" | "halloween" | "christmas" | "personalised")[];
  price: number | null;  // null = pending
  currency: "EGP";
  priceStatus: "pending" | "set";
  variants: { catalogId: string; name: string; material: string; images: string[] }[];
};
```
- When `price` is `null`, show **"Price pending"**. Never invent a price.
- When a price is set, show it as `EGP 1,250`.
- **Do not show** the 6 items held back in `catalog-full-110.json`: coco-014, coco-015,
  coco-021, coco-027, coco-043 and coco-084 (material unconfirmed, and #21 shows a real
  child's photo).

---

## 10. Animations reference (all CSS is in the reference files)
| Name | Where | Spec |
|---|---|---|
| `rise` | Hero text, sections | translateY 28 → 0 + fade, 0.9s, staggered 0.1–0.7s |
| reveal on scroll | Sections | `animation-timeline: view()` where supported. Fall back to IntersectionObserver |
| `morph` | Resin disc, blobs | border-radius morph, 14s loop |
| `spin` / `spinRev` | Disc layers, badge | 26s / 40s / 22s linear |
| `twinkle` | Gold flecks | 3.6s scale + opacity |
| `float` | Floating photos | translateY −18px, 7–9s |
| `draw` | Logo "C" | stroke-dashoffset 900 → 0, 2.2s |
| `marquee` | Strip | translateX −50%, 38s linear |
| `shimmer` | Gold text, skeletons | background-position sweep |
| `pop` | XO marks | scale 0.3 → 1.12 → 1, staggered 0.35s |
| hover lift | Cards | translateY −6/−8px + shadow; inner image scale 1.07 |
| fly / bump / slideUp / slideIn | Cart | see §7 |

Everything must be disabled under `prefers-reduced-motion: reduce`.

---

## 11. Quality bar
- Fully responsive from 360px up, with no horizontal scroll.
- Accessible: real `<button>` and `<a>` elements, labelled icon buttons, visible focus rings,
  and text contrast of at least 4.5:1. Drawer focus management is described in §7.
- SEO: per-page `<title>`/meta, Open Graph image, product JSON-LD (no `offers` until
  prices exist).
- Performance: lazy images, responsive sizes, fonts with `display=swap`, Lighthouse ≥ 90 on mobile.

---

## 12. Open items (owner still has to supply these)
1. **Prices** for all products. Everything shows "Price pending" until then.
2. **Contact details**: WhatsApp number and the Facebook page URL. Leave placeholders in one
   config file.
3. **Checkout and payment method** (cash on delivery, card, wallet), plus delivery fees.
   `/checkout` is a placeholder until these are decided.
4. **Replacement photos** for:
   - Watermarked images: #4, #7, #8, #13, #32.
   - A business card with a phone number in shot: #47, #60.
   - Instagram screenshots: #59, #60.
   - AI-looking backgrounds: #109, #110.
   - The low-res `legacy-crops`.
5. Six hidden products waiting on confirmation (see §9).
6. Workshop dates, prices and booking flow. The "Book & pay online" button is a placeholder.
