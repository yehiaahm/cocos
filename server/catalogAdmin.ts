import type { AdminProduct, CatalogOverride } from '../src/lib/api-types';
import { SLUG_RE, slugify } from '../src/lib/slug';
import { HttpError, intOrNull, str } from './http';
import { HIDDEN_IDS, OCCASION_SLUGS, loadCatalog, overrideFor, loadOverrides, type Catalog, type CatalogCategory, type Product, type Variant } from './catalog';

/** Everything the dashboard can change in the catalogue: validation first, then one transaction per change. */

export { SLUG_RE, slugify };
/** Photos are either shipped with the site or uploaded from the dashboard; nothing else may be referenced. */
export const IMAGE_RE = /^\/(?:images\/products|media\/catalog)\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i;

export const LIMITS = { variants: 30, imagesPerVariant: 12, products: 2000, categories: 60 };

const bad = (message: string, code: string) => new HttpError(400, message, code);

/** Next "coco-NNN": above every id in use, every held-back one and every one ever handed out, so an id is never reused
 *  (orders and sales stats are keyed by product id). */
export function nextProductId(catalog: Catalog): string {
  let max = catalog.maxId;
  for (const id of [...catalog.byId.keys(), ...HIDDEN_IDS]) {
    const m = /^coco-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `coco-${String(max + 1).padStart(3, '0')}`;
}

function freeSlug(base: string, taken: Set<string>, fallback: string): string {
  const root = base || fallback;
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root.slice(0, 55)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/* ------------------------------ products ------------------------------ */

/** A product as the dashboard sees it: catalogue data + price / hidden / sold-out + units sold. */
export function adminProductView(p: Product, categoryName: string, o: CatalogOverride, sold: number): AdminProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    categoryName,
    image: p.image,
    tags: p.tags,
    variants: p.variants,
    price: o.price,
    hidden: o.hidden,
    soldOut: o.soldOut,
    sold,
  };
}


export interface ProductInput {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  image?: unknown;
  variants?: unknown;
  price?: unknown;
  hidden?: unknown;
  soldOut?: unknown;
}

export interface ValidProduct {
  product: Product;
  /** Present only when the request carried them. */
  overrides: { price?: number | null; hidden?: boolean; soldOut?: boolean };
}

/** Validates a create/update payload against the current catalogue and returns the clean product. */
export function validateProduct(input: ProductInput, catalog: Catalog, existing?: Product): ValidProduct {
  const name = str(input.name, 120);
  if (name.length < 2) throw bad('Please enter a product name (at least 2 characters).', 'name_required');

  const category = str(input.category, 60);
  if (!catalog.categories.some((c) => c.slug === category)) throw bad('Choose a category for this product.', 'category_missing');

  const id = existing?.id ?? nextProductId(catalog);
  const otherSlugs = new Set(catalog.products.filter((p) => p.id !== id).map((p) => p.slug));
  const wanted = str(input.slug, 80).toLowerCase();
  let slug: string;
  if (wanted) {
    if (!SLUG_RE.test(wanted)) throw bad('The web address may only contain lowercase letters, numbers and dashes.', 'slug_invalid');
    if (otherSlugs.has(wanted)) throw new HttpError(409, 'Another product already uses this web address.', 'slug_taken');
    slug = wanted;
  } else {
    slug = existing?.slug ?? freeSlug(slugify(name), otherSlugs, `product-${id.slice(5)}`);
  }

  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map((t) => str(t, 30)))] : [];
  if (tags.some((t) => !OCCASION_SLUGS.includes(t))) throw bad('Unknown occasion tag.', 'bad_tag');

  if (!Array.isArray(input.variants) || input.variants.length === 0) throw bad('Add at least one variant (colour / option).', 'variant_required');
  if (input.variants.length > LIMITS.variants) throw bad(`A product can have at most ${LIMITS.variants} variants.`, 'too_many_variants');

  // Variant ids are what carts and orders refer to, so existing ones are kept; new ones get a fresh id.
  const ownIds = new Set(existing?.variants.map((v) => v.catalogId) ?? []);
  const usedElsewhere = new Set<string>();
  for (const p of catalog.products) if (p.id !== id) for (const v of p.variants) usedElsewhere.add(v.catalogId);
  for (const h of HIDDEN_IDS) usedElsewhere.add(h);
  const taken = new Set<string>();
  const variants: Variant[] = [];
  for (const raw of input.variants as Record<string, unknown>[]) {
    const vname = str(raw?.name, 100);
    if (!vname) throw bad('Every variant needs a name.', 'variant_name');
    const images = Array.isArray(raw.images) ? raw.images.map((i) => str(i, 200)) : [];
    if (images.length > LIMITS.imagesPerVariant) throw bad(`At most ${LIMITS.imagesPerVariant} photos per variant.`, 'too_many_images');
    if (images.some((i) => !IMAGE_RE.test(i))) throw bad('One of the photos is not valid. Upload it again.', 'invalid_image');
    let catalogId = str(raw.catalogId, 20);
    if (!catalogId || !ownIds.has(catalogId) || taken.has(catalogId)) {
      catalogId = '';
      for (let n = 1; !catalogId; n++) {
        const candidate = n === 1 ? id : `${id}-${n}`;
        if (!taken.has(candidate) && !usedElsewhere.has(candidate) && !ownIds.has(candidate)) catalogId = candidate;
      }
    }
    taken.add(catalogId);
    variants.push({ catalogId, name: vname, material: str(raw.material, 60), images: [...new Set(images)] });
  }

  const allImages = variants.flatMap((v) => v.images);
  if (allImages.length === 0) throw bad('Add at least one photo.', 'image_required');
  const cover = str(input.image, 200);
  const image = allImages.includes(cover) ? cover : allImages[0];

  const overrides: ValidProduct['overrides'] = {};
  if (input.price !== undefined) overrides.price = intOrNull(input.price, { max: 1_000_000 });
  if (input.hidden !== undefined) overrides.hidden = !!input.hidden;
  if (input.soldOut !== undefined) overrides.soldOut = !!input.soldOut;

  return {
    product: { id, slug, name, category, description: str(input.description, 1000), image, tags, variants },
    overrides,
  };
}

const bumpRev = (db: D1Database) =>
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('catalog_rev', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)",
  );

function overrideStatement(db: D1Database, id: string, current: { price: number | null; hidden: boolean; soldOut: boolean }, patch: ValidProduct['overrides']) {
  const next = {
    price: patch.price !== undefined ? patch.price : current.price,
    hidden: patch.hidden !== undefined ? patch.hidden : current.hidden,
    soldOut: patch.soldOut !== undefined ? patch.soldOut : current.soldOut,
  };
  return db
    .prepare(
      `INSERT INTO product_overrides (product_id, price, hidden, sold_out, updated_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(product_id) DO UPDATE SET price = excluded.price, hidden = excluded.hidden,
         sold_out = excluded.sold_out, updated_at = excluded.updated_at`,
    )
    .bind(id, next.price, next.hidden ? 1 : 0, next.soldOut ? 1 : 0);
}

export async function createProduct(db: D1Database, input: ProductInput): Promise<Product> {
  const catalog = await loadCatalog(db);
  if (catalog.products.length >= LIMITS.products) throw bad('The catalogue is full.', 'catalog_full');
  const { product, overrides } = validateProduct(input, catalog);
  // Lower than every existing sort_order, so the newest product is shown first.
  const min = await db.prepare('SELECT MIN(sort_order) AS m FROM catalog_products').first<{ m: number | null }>();
  const stmts = [
    db
      .prepare(
        'INSERT INTO catalog_products (id, slug, name, description, category, tags, image, variants, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(product.id, product.slug, product.name, product.description, product.category, JSON.stringify(product.tags), product.image, JSON.stringify(product.variants), (min?.m ?? 0) - 1),
    ...(Object.keys(overrides).length ? [overrideStatement(db, product.id, { price: null, hidden: false, soldOut: false }, overrides)] : []),
    db
      .prepare("INSERT INTO settings (key, value) VALUES ('catalog_max_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(String(Number(product.id.slice(5)))),
    bumpRev(db),
  ];
  await db.batch(stmts);
  return product;
}

export async function updateProduct(db: D1Database, id: string, input: ProductInput): Promise<Product> {
  const catalog = await loadCatalog(db);
  const existing = catalog.byId.get(id);
  if (!existing) throw new HttpError(404, 'Product not found.', 'not_found');
  const { product, overrides } = validateProduct(input, catalog, existing);
  const stmts = [
    db
      .prepare(
        `UPDATE catalog_products SET slug = ?, name = ?, description = ?, category = ?, tags = ?, image = ?, variants = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
      )
      .bind(product.slug, product.name, product.description, product.category, JSON.stringify(product.tags), product.image, JSON.stringify(product.variants), id),
  ];
  if (Object.keys(overrides).length) {
    stmts.push(overrideStatement(db, id, overrideFor(await loadOverrides(db), id), overrides));
  }
  stmts.push(bumpRev(db));
  await db.batch(stmts);
  return product;
}

/** Removes the product from the shop. Past orders keep their own copy of the name and photo. */
export async function deleteProduct(db: D1Database, id: string): Promise<void> {
  const catalog = await loadCatalog(db);
  if (!catalog.byId.has(id)) throw new HttpError(404, 'Product not found.', 'not_found');
  await db.batch([
    db.prepare('DELETE FROM catalog_products WHERE id = ?').bind(id),
    db.prepare('DELETE FROM product_overrides WHERE product_id = ?').bind(id),
    bumpRev(db),
  ]);
}

/* ------------------------------ categories ------------------------------ */

export interface CategoryInput {
  slug?: unknown;
  name?: unknown;
  nameAr?: unknown;
  description?: unknown;
}

function cleanCategory(input: CategoryInput) {
  const name = str(input.name, 60);
  if (name.length < 2) throw bad('Please enter the category name (at least 2 characters).', 'name_required');
  return { name, nameAr: str(input.nameAr, 60) || name, description: str(input.description, 300) };
}

export async function createCategory(db: D1Database, input: CategoryInput): Promise<CatalogCategory> {
  const catalog = await loadCatalog(db);
  if (catalog.categories.length >= LIMITS.categories) throw bad('Too many categories.', 'catalog_full');
  const clean = cleanCategory(input);
  const taken = new Set(catalog.categories.map((c) => c.slug));
  const wanted = str(input.slug, 60).toLowerCase();
  let slug: string;
  if (wanted) {
    if (!SLUG_RE.test(wanted)) throw bad('The web address may only contain lowercase letters, numbers and dashes.', 'slug_invalid');
    if (taken.has(wanted)) throw new HttpError(409, 'Another category already uses this web address.', 'slug_taken');
    slug = wanted;
  } else {
    slug = freeSlug(slugify(clean.name), taken, `category-${taken.size + 1}`);
  }
  const max = await db.prepare('SELECT MAX(sort_order) AS m FROM catalog_categories').first<{ m: number | null }>();
  await db.batch([
    db
      .prepare('INSERT INTO catalog_categories (slug, name, name_ar, description, sort_order) VALUES (?, ?, ?, ?, ?)')
      .bind(slug, clean.name, clean.nameAr, clean.description, (max?.m ?? -1) + 1),
    bumpRev(db),
  ]);
  return { slug, ...clean };
}

/** The slug never changes (it is part of shop URLs); everything else can. */
export async function updateCategory(db: D1Database, slug: string, input: CategoryInput): Promise<CatalogCategory> {
  const catalog = await loadCatalog(db);
  if (!catalog.categories.some((c) => c.slug === slug)) throw new HttpError(404, 'Category not found.', 'not_found');
  const clean = cleanCategory(input);
  await db.batch([
    db
      .prepare("UPDATE catalog_categories SET name = ?, name_ar = ?, description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug = ?")
      .bind(clean.name, clean.nameAr, clean.description, slug),
    bumpRev(db),
  ]);
  return { slug, ...clean };
}

/** A category that still has products can only be deleted by moving them to another category (`moveTo`). */
export async function deleteCategory(db: D1Database, slug: string, moveTo?: string): Promise<{ moved: number }> {
  const catalog = await loadCatalog(db);
  if (!catalog.categories.some((c) => c.slug === slug)) throw new HttpError(404, 'Category not found.', 'not_found');
  const inside = catalog.products.filter((p) => p.category === slug).length;
  const stmts = [];
  if (inside > 0) {
    if (!moveTo) throw new HttpError(409, `This category still has ${inside} product${inside === 1 ? '' : 's'}. Choose where to move them.`, 'has_products');
    if (moveTo === slug || !catalog.categories.some((c) => c.slug === moveTo)) throw bad('Choose another category to move the products to.', 'category_missing');
    stmts.push(
      db
        .prepare("UPDATE catalog_products SET category = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE category = ?")
        .bind(moveTo, slug),
    );
  }
  stmts.push(db.prepare('DELETE FROM catalog_categories WHERE slug = ?').bind(slug), bumpRev(db));
  await db.batch(stmts);
  return { moved: inside };
}

/** `order` lists every category slug in the wanted order. */
export async function reorderCategories(db: D1Database, order: unknown): Promise<void> {
  const catalog = await loadCatalog(db);
  const slugs = Array.isArray(order) ? order.map((s) => str(s, 60)) : [];
  const known = new Set(catalog.categories.map((c) => c.slug));
  if (slugs.length !== known.size || new Set(slugs).size !== slugs.length || slugs.some((s) => !known.has(s))) {
    throw bad('The category order is not valid.', 'bad_order');
  }
  await db.batch([...slugs.map((s, i) => db.prepare('UPDATE catalog_categories SET sort_order = ? WHERE slug = ?').bind(i, s)), bumpRev(db)]);
}
