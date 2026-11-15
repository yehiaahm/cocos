import raw from '../data/products.json';
import type { CatalogOverride, CatalogOverrides } from '../src/lib/api-types';

/**
 * Server side of the catalogue.
 *
 * The catalogue lives in the database (catalog_categories / catalog_products) and is edited from the dashboard.
 * data/products.json is only the starting point: the first request copies it into the tables, once.
 * Price / hidden / sold-out stay in product_overrides, keyed by the same product id.
 */
export interface Variant {
  catalogId: string;
  name: string;
  material: string;
  images: string[];
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  image: string;
  tags: string[];
  variants: Variant[];
}
export interface CatalogCategory {
  slug: string;
  name: string;
  nameAr: string;
  description: string;
}
export interface Catalog {
  categories: CatalogCategory[];
  products: Product[];
  byId: Map<string, Product>;
  /** Bumps on every dashboard change; 0 means "still exactly data/products.json". */
  rev: number;
  /** Highest coco-NNN number ever handed out, kept even after that product is deleted (ids are never reused). */
  maxId: number;
}

/** Items held back by the owner (HANDOFF §9); they are never seeded, and their ids are never reused. */
export const HIDDEN_IDS = new Set(['coco-014', 'coco-015', 'coco-021', 'coco-027', 'coco-043', 'coco-084']);

interface RawCatalog {
  categories: { slug: string; name: string; nameAr?: string; description?: string }[];
  occasions: { slug: string; name: string }[];
  products: (Product & { categoryName?: string })[];
}
const seed = raw as unknown as RawCatalog;

export const OCCASIONS: { slug: string; name: string }[] = seed.occasions;
export const OCCASION_SLUGS: string[] = OCCASIONS.map((o) => o.slug);

export const seedCategories: CatalogCategory[] = seed.categories.map((c) => ({
  slug: c.slug,
  name: c.name,
  nameAr: c.nameAr ?? c.name,
  description: c.description ?? '',
}));

export const seedProducts: Product[] = seed.products
  .filter((p) => !HIDDEN_IDS.has(p.id) && !p.variants.some((v) => HIDDEN_IDS.has(v.catalogId)))
  .map(({ id, slug, name, category, description, image, tags, variants }) => ({ id, slug, name, category, description, image, tags, variants }));

const parseJson = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const seededDbs = new WeakSet<object>();

/** Copies data/products.json into the tables the first time, and never again (even if everything is deleted later). */
export async function ensureSeeded(db: D1Database): Promise<void> {
  if (seededDbs.has(db)) return;
  const done = await db.prepare("SELECT 1 AS x FROM settings WHERE key = 'catalog_seeded'").first<{ x: number }>();
  if (!done) {
    await db.batch([
      ...seedCategories.map((c, i) =>
        db
          .prepare('INSERT OR IGNORE INTO catalog_categories (slug, name, name_ar, description, sort_order) VALUES (?, ?, ?, ?, ?)')
          .bind(c.slug, c.name, c.nameAr, c.description, i),
      ),
      ...seedProducts.map((p, i) =>
        db
          .prepare(
            'INSERT OR IGNORE INTO catalog_products (id, slug, name, description, category, tags, image, variants, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(p.id, p.slug, p.name, p.description, p.category, JSON.stringify(p.tags), p.image, JSON.stringify(p.variants), i),
      ),
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('catalog_seeded', '1')"),
    ]);
  }
  seededDbs.add(db);
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  image: string;
  variants: string;
}

/** The whole catalogue, in display order. */
export async function loadCatalog(db: D1Database): Promise<Catalog> {
  await ensureSeeded(db);
  const [cats, prods, meta] = await Promise.all([
    db
      .prepare('SELECT slug, name, name_ar, description FROM catalog_categories ORDER BY sort_order, slug')
      .all<{ slug: string; name: string; name_ar: string; description: string }>(),
    db
      .prepare('SELECT id, slug, name, description, category, tags, image, variants FROM catalog_products ORDER BY sort_order, id')
      .all<ProductRow>(),
    db.prepare("SELECT key, value FROM settings WHERE key IN ('catalog_rev', 'catalog_max_id')").all<{ key: string; value: string }>(),
  ]);
  const setting = (key: string) => Number(meta.results.find((r) => r.key === key)?.value) || 0;
  const products: Product[] = prods.results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    description: r.description,
    image: r.image,
    tags: parseJson<string[]>(r.tags, []),
    variants: parseJson<Variant[]>(r.variants, []),
  }));
  return {
    categories: cats.results.map((c) => ({ slug: c.slug, name: c.name, nameAr: c.name_ar || c.name, description: c.description })),
    products,
    byId: new Map(products.map((p) => [p.id, p])),
    rev: setting('catalog_rev'),
    maxId: setting('catalog_max_id'),
  };
}

/** Does /product/<slug> or /shop/<slug> exist in the catalogue? (decides between the app shell and a 404 for unprerendered URLs) */
export async function catalogHasPath(db: D1Database, kind: 'product' | 'category', slug: string): Promise<boolean> {
  await ensureSeeded(db);
  const sql = kind === 'product' ? 'SELECT 1 AS x FROM catalog_products WHERE slug = ?' : 'SELECT 1 AS x FROM catalog_categories WHERE slug = ?';
  return !!(await db.prepare(sql).bind(slug).first<{ x: number }>());
}

export async function loadOverrides(db: D1Database): Promise<CatalogOverrides> {
  const { results } = await db
    .prepare('SELECT product_id, price, hidden, sold_out, stock FROM product_overrides')
    .all<{ product_id: string; price: number | null; hidden: number; sold_out: number; stock: number | null }>();
  const out: CatalogOverrides = {};
  for (const r of results) out[r.product_id] = { price: r.price, hidden: !!r.hidden, soldOut: !!r.sold_out, stock: r.stock };
  return out;
}

export const overrideFor = (o: CatalogOverrides, id: string): CatalogOverride => o[id] ?? { price: null, hidden: false, soldOut: false, stock: null };

/** Sold out by the switch, or because a tracked stock has run to 0. */
export const isSoldOut = (o: CatalogOverride): boolean => o.soldOut || (typeof o.stock === 'number' && o.stock <= 0);

/** What the public storefront gets: stock folded into soldOut, the exact count kept private. */
export function publicOverrides(all: CatalogOverrides): CatalogOverrides {
  const out: CatalogOverrides = {};
  for (const [id, o] of Object.entries(all)) out[id] = { price: o.price, hidden: o.hidden, soldOut: isSoldOut(o) };
  return out;
}
