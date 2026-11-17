// @vitest-environment node
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { createTestDb } from './testDb';
import type { Env } from './env';
import { HttpError } from './http';
import { loadCatalog, loadOverrides, seedProducts, seedCategories, catalogHasPath } from './catalog';
import {
  IMAGE_RE,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  nextProductId,
  reorderCategories,
  slugify,
  updateCategory,
  updateProduct,
  validateProduct,
} from './catalogAdmin';
import * as publicCatalog from '../functions/api/catalog';
import * as adminProducts from '../functions/api/admin/products';
import * as adminMedia from '../functions/api/admin/media';
import * as media from '../functions/media/[[path]]';
import { FileR2 } from './node/r2';

const fresh = async () => (await createTestDb()) as unknown as D1Database;

const photo = { catalogId: '', name: 'Grey', material: 'Concrete', images: ['/media/catalog/abc123.jpg'] };
const newProduct = (over: Record<string, unknown> = {}) => ({
  name: 'Grey Concrete Planter',
  category: 'concrete',
  description: 'A hand-cast planter.',
  tags: [],
  variants: [photo],
  ...over,
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpError) return e.code;
    throw e;
  }
  return 'ok';
};

describe('catalogue seed', () => {
  it('copies data/products.json exactly once', async () => {
    const db = await fresh();
    const c = await loadCatalog(db);
    expect(c.products).toHaveLength(80);
    expect(c.categories.map((x) => x.slug)).toEqual(seedCategories.map((x) => x.slug));
    expect(c.byId.get('coco-021')).toBeUndefined(); // held-back item
    expect(c.byId.get('coco-052')?.variants).toHaveLength(6);
    expect(c.rev).toBe(0);
    // deleting everything must not bring the seed back
    for (const p of c.products) await deleteProduct(db, p.id);
    expect((await loadCatalog(db)).products).toHaveLength(0);
  });

  it('every shipped product passes the same validation the dashboard applies', async () => {
    const c = await loadCatalog(await fresh());
    for (const p of seedProducts) {
      expect(() => validateProduct({ ...p }, c, c.byId.get(p.id)), p.id).not.toThrow();
      for (const img of p.variants.flatMap((v) => v.images)) expect(IMAGE_RE.test(img), img).toBe(true);
    }
  });
});

describe('products', () => {
  it('adds a product, shows it first, and gives it a fresh id and variant id', async () => {
    const db = await fresh();
    const p = await createProduct(db, newProduct({ price: 450 }));
    expect(p.id).toBe('coco-111'); // above the held-back ids up to coco-110
    expect(p.slug).toBe('grey-concrete-planter');
    expect(p.variants[0].catalogId).toBe('coco-111');
    expect(p.image).toBe('/media/catalog/abc123.jpg');
    const c = await loadCatalog(db);
    expect(c.products[0].id).toBe('coco-111');
    expect(c.rev).toBe(1);
    expect((await loadOverrides(db))['coco-111']).toEqual({ price: 450, hidden: false, soldOut: false, stock: null });
  });

  it('never reuses an id, even after the newest product is deleted', async () => {
    const db = await fresh();
    const a = await createProduct(db, newProduct());
    await deleteProduct(db, a.id);
    expect(nextProductId(await loadCatalog(db))).toBe('coco-112');
    const b = await createProduct(db, newProduct());
    expect(b.id).toBe('coco-112');
  });

  it('makes slugs unique and refuses a taken one', async () => {
    const db = await fresh();
    await createProduct(db, newProduct());
    const second = await createProduct(db, newProduct());
    expect(second.slug).toBe('grey-concrete-planter-2');
    expect(await code(createProduct(db, newProduct({ slug: 'grey-concrete-planter' })))).toBe('slug_taken');
    expect(await code(createProduct(db, newProduct({ slug: 'Bad Slug!' })))).toBe('slug_invalid');
  });

  it('validates required fields', async () => {
    const db = await fresh();
    expect(await code(createProduct(db, newProduct({ name: ' ' })))).toBe('name_required');
    expect(await code(createProduct(db, newProduct({ category: 'nope' })))).toBe('category_missing');
    expect(await code(createProduct(db, newProduct({ variants: [] })))).toBe('variant_required');
    expect(await code(createProduct(db, newProduct({ variants: [{ ...photo, images: [] }] })))).toBe('image_required');
    expect(await code(createProduct(db, newProduct({ variants: [{ ...photo, name: '' }] })))).toBe('variant_name');
    expect(await code(createProduct(db, newProduct({ tags: ['sale'] })))).toBe('bad_tag');
    // photos must be ours: no external URLs, no traversal, no other folders
    for (const img of ['https://evil.example/x.jpg', '/media/catalog/../../etc/passwd.jpg', '/media/proofs/1/x.jpg', '/images/products/x.svg']) {
      expect(await code(createProduct(db, newProduct({ variants: [{ ...photo, images: [img] }] }))), img).toBe('invalid_image');
    }
  });

  it('updates a product: keeps variant ids, adds new ones, changes category and cover', async () => {
    const db = await fresh();
    const p = await createProduct(db, newProduct());
    const updated = await updateProduct(db, p.id, {
      ...newProduct({ name: 'Renamed', category: 'resin', slug: 'renamed', image: '/media/catalog/second.jpg' }),
      variants: [
        { ...photo, catalogId: p.variants[0].catalogId, images: ['/media/catalog/abc123.jpg', '/media/catalog/second.jpg'] },
        { catalogId: 'coco-052', name: 'Black', material: 'Concrete', images: ['/media/catalog/black.jpg'] }, // someone else's id → replaced
      ],
      soldOut: true,
    });
    expect(updated.variants[0].catalogId).toBe(p.variants[0].catalogId);
    expect(updated.variants[1].catalogId).toBe(`${p.id}-2`);
    expect(updated.image).toBe('/media/catalog/second.jpg');
    const c = await loadCatalog(db);
    expect(c.byId.get(p.id)?.category).toBe('resin');
    expect((await loadOverrides(db))[p.id].soldOut).toBe(true);
    // slug of another product is refused
    expect(await code(updateProduct(db, p.id, newProduct({ slug: 'green-gold-domino-set' })))).toBe('slug_taken');
    expect(await code(updateProduct(db, 'coco-999', newProduct()))).toBe('not_found');
  });

  it('keeps unrelated override fields when only some are sent', async () => {
    const db = await fresh();
    const p = await createProduct(db, newProduct({ price: 300, hidden: true }));
    await updateProduct(db, p.id, newProduct({ soldOut: true }));
    expect((await loadOverrides(db))[p.id]).toEqual({ price: 300, hidden: true, soldOut: true, stock: null });
  });

  it('deletes a product and its price override; orders keep their own copy', async () => {
    const db = await fresh();
    const p = await createProduct(db, newProduct({ price: 100 }));
    await deleteProduct(db, p.id);
    const c = await loadCatalog(db);
    expect(c.byId.has(p.id)).toBe(false);
    expect((await loadOverrides(db))[p.id]).toBeUndefined();
    expect(await code(deleteProduct(db, p.id))).toBe('not_found');
  });
});

describe('categories', () => {
  it('adds, renames (slug stays) and orders categories', async () => {
    const db = await fresh();
    const c = await createCategory(db, { name: 'Gift Boxes', nameAr: 'علب هدايا', description: 'Boxed sets.' });
    expect(c.slug).toBe('gift-boxes');
    await updateCategory(db, 'gift-boxes', { name: 'Gift Sets', nameAr: '', description: '' });
    let cat = (await loadCatalog(db)).categories.find((x) => x.slug === 'gift-boxes')!;
    expect(cat).toMatchObject({ name: 'Gift Sets', nameAr: 'Gift Sets' }); // Arabic falls back to the English name
    await reorderCategories(db, ['gift-boxes', ...seedCategories.map((x) => x.slug)]);
    expect((await loadCatalog(db)).categories[0].slug).toBe('gift-boxes');
    expect(await code(reorderCategories(db, ['gift-boxes']))).toBe('bad_order');
    cat = (await loadCatalog(db)).categories[0];
    expect(cat.slug).toBe('gift-boxes');
    expect(await code(createCategory(db, { name: 'Gift Boxes', slug: 'gift-boxes' }))).toBe('slug_taken');
    expect(await code(createCategory(db, { name: 'x' }))).toBe('name_required');
  });

  it('gives an Arabic-only name a safe slug', async () => {
    const c = await createCategory(await fresh(), { name: 'أعمال خشب' });
    expect(c.slug).toBe('category-7');
  });

  it('only deletes a non-empty category by moving its products', async () => {
    const db = await fresh();
    expect(await code(deleteCategory(db, 'macrame'))).toBe('has_products');
    expect(await code(deleteCategory(db, 'macrame', 'macrame'))).toBe('category_missing');
    expect(await code(deleteCategory(db, 'macrame', 'nope'))).toBe('category_missing');
    const { moved } = await deleteCategory(db, 'macrame', 'resin');
    expect(moved).toBe(6);
    const c = await loadCatalog(db);
    expect(c.categories.some((x) => x.slug === 'macrame')).toBe(false);
    expect(c.products.filter((p) => p.category === 'resin')).toHaveLength(28 + 6);
    // an empty category can simply be deleted
    expect((await deleteCategory(db, 'concrete')).moved).toBe(0);
    expect(await code(deleteCategory(db, 'concrete'))).toBe('not_found');
  });

  it('knows which pages exist', async () => {
    const db = await fresh();
    const p = await createProduct(db, newProduct());
    expect(await catalogHasPath(db, 'product', p.slug)).toBe(true);
    expect(await catalogHasPath(db, 'product', 'nothing-here')).toBe(false);
    expect(await catalogHasPath(db, 'category', 'concrete')).toBe(true);
  });
});

describe('public /api/catalog', () => {
  const get = async (db: D1Database) => {
    const res = await (publicCatalog.onRequestGet as unknown as (c: unknown) => Promise<Response>)({ env: { DB: db } as unknown as Env, request: new Request('https://x/api/catalog') });
    return (await res.json()) as { rev: number; catalog?: { products: { id: string }[]; categories: { slug: string }[] } };
  };

  it('does not resend the built-in catalogue until the dashboard changes something', async () => {
    const db = await fresh();
    expect((await get(db)).catalog).toBeUndefined();
    await createProduct(db, newProduct());
    const body = await get(db);
    expect(body.rev).toBe(1);
    expect(body.catalog?.products).toHaveLength(81);
    expect(body.catalog?.categories).toHaveLength(6);
  });
});

describe('admin products API', () => {
  it('lists products with their variants and every category', async () => {
    const db = await fresh();
    const res = await (adminProducts.onRequestGet as unknown as (c: unknown) => Promise<Response>)({ env: { DB: db } as unknown as Env });
    const body = (await res.json()) as { products: { id: string; variants: unknown[]; categoryName: string }[]; categories: { slug: string }[] };
    expect(body.products).toHaveLength(80);
    expect(body.products[0].variants.length).toBeGreaterThan(0);
    expect(body.categories.map((c) => c.slug)).toContain('concrete');
  });
});

describe('photo upload and serving', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);
  const form = (parts: Record<string, Uint8Array | string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(parts)) f.set(k, typeof v === 'string' ? v : new Blob([v as BlobPart], { type: 'image/jpeg' }), 'x.jpg');
    return f;
  };
  const upload = async (env: Env, parts: Record<string, Uint8Array | string>) =>
    (adminMedia.onRequestPost as unknown as (c: unknown) => Promise<Response>)({
      env,
      request: new Request('https://x/api/admin/media', { method: 'POST', body: form(parts) }),
    });

  it('stores a full photo and its small copy, serves them publicly, and refuses non-images', async () => {
    const root = path.join(process.env.TEMP ?? '.', `cocos-media-test-${Date.now()}`);
    const env = { UPLOADS: new FileR2(root) } as unknown as Env;

    const ok = await upload(env, { full: jpeg, thumb: jpeg });
    expect(ok.status).toBe(201);
    const { url } = (await ok.json()) as { url: string };
    expect(url).toMatch(/^\/media\/catalog\/[A-Za-z0-9_-]+\.jpg$/);
    expect(IMAGE_RE.test(url)).toBe(true);

    const serve = async (u: string) => {
      const rel = u.replace('/media/', '');
      return (media.onRequestGet as unknown as (c: unknown) => Promise<Response>)({ env, params: { path: rel } });
    };
    const full = await serve(url);
    expect(full.status).toBe(200);
    expect(full.headers.get('content-type')).toBe('image/jpeg');
    expect(full.headers.get('cache-control')).toContain('immutable');
    expect((await serve(url.replace('.jpg', '-480.jpg'))).status).toBe(200);

    // not an image (HTML pretending to be a photo)
    const notImage = await upload(env, { full: new TextEncoder().encode('<script>alert(1)</script>') });
    expect(notImage.status).toBe(415);
    // proofs are private, traversal is refused
    await env.UPLOADS.put('proofs/1/secret.jpg', jpeg, { httpMetadata: { contentType: 'image/jpeg' } });
    expect((await serve('catalog/../proofs/1/secret.jpg')).status).toBe(404);
    expect((await (media.onRequestGet as unknown as (c: unknown) => Promise<Response>)({ env, params: { path: 'proofs/1/secret.jpg' } })).status).toBe(404);
  });
});

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Grey Concrete Planter')).toBe('grey-concrete-planter');
    expect(slugify('Macramé & Co.')).toBe('macrame-co');
    expect(slugify('أعمال')).toBe('');
  });
});
