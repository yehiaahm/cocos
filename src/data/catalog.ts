import { create } from 'zustand';
import raw from '../../data/products.json';

/** Categories are managed in the dashboard, so a slug is just a string (the built-in ones: gaming, resin, wood-decoupage, macrame, candles, concrete). */
export type CategorySlug = string;
export type OccasionSlug = 'ramadan' | 'halloween' | 'christmas' | 'personalised';

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
  category: CategorySlug;
  categoryName: string;
  description: string;
  image: string;
  tags: OccasionSlug[];
  price: number | null;
  currency: 'EGP';
  priceStatus: 'pending' | 'set';
  variants: Variant[];
}

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Arabic name (homepage accent label). */
  nameAr?: string;
  /** One or two sentences shown under the shop heading. */
  description?: string;
  count: number;
}

/** The shape of the catalogue as stored (and as GET /api/catalog sends it once the dashboard changed something). */
export interface CatalogData {
  categories: { slug: string; name: string; nameAr?: string; description?: string }[];
  products: {
    id: string;
    slug: string;
    name: string;
    category: string;
    description: string;
    image: string;
    tags: string[];
    variants: Variant[];
  }[];
}

export interface Occasion {
  slug: OccasionSlug;
  name: string;
}

/**
 * Items held back by the owner (HANDOFF §9). products.json already excludes them;
 * this guard makes sure they can never appear even if the data file is swapped
 * for the full 110-item catalog by mistake.
 */
export const HIDDEN_IDS = new Set(['coco-014', 'coco-015', 'coco-021', 'coco-027', 'coco-043', 'coco-084']);

const data = raw as unknown as { categories: Category[]; occasions: Occasion[]; products: Product[] };

export const occasions: readonly Occasion[] = data.occasions;

/** Normalises a catalogue (the built-in one, or the live one from the dashboard) into what the pages use. */
function build(input: CatalogData) {
  const names = new Map(input.categories.map((c) => [c.slug, c.name]));
  const list: Product[] = input.products.map((p) => ({
    ...p,
    category: p.category,
    categoryName: names.get(p.category) ?? p.category,
    tags: p.tags.filter((t): t is OccasionSlug => occasions.some((o) => o.slug === t)),
    // Prices come from the dashboard (GET /api/catalog overrides), never from the catalogue itself.
    price: null,
    currency: 'EGP',
    priceStatus: 'pending',
  }));
  return {
    products: list,
    categories: input.categories.map((c) => ({ ...c, count: list.filter((p) => p.category === c.slug).length })) as readonly Category[],
    bySlug: new Map(list.map((p) => [p.slug, p])),
    byId: new Map(list.map((p) => [p.id, p])),
    searchIndex: new Map(list.map((p) => [p.id, normalise([p.name, p.description, ...p.variants.map((v) => v.name)].join(' '))])),
  };
}

// The catalogue built into the site (prerendered pages use it). The live one replaces it after load.
const builtIn: CatalogData = {
  categories: data.categories,
  products: data.products.filter((p) => !HIDDEN_IDS.has(p.id) && !p.variants.some((v) => HIDDEN_IDS.has(v.catalogId))),
};

// Live bindings: importers always see the current catalogue. Components re-render through useCatalog().
export let products: readonly Product[] = [];
export let categories: readonly Category[] = [];
let bySlug = new Map<string, Product>();
let byId = new Map<string, Product>();
let searchIndex = new Map<string, string>();

const useCatalogVersion = create<{ version: number }>()(() => ({ version: 0 }));

/** Swap in the catalogue the dashboard manages (called when /api/catalog sends one). */
export function setCatalog(input: CatalogData) {
  const next = build(input);
  products = next.products;
  categories = next.categories;
  bySlug = next.bySlug;
  byId = next.byId;
  searchIndex = next.searchIndex;
  useCatalogVersion.setState((s) => ({ version: s.version + 1 }));
}

/** True once /api/catalog has answered, i.e. the catalogue above is the live one and "not found" really means not found. */
export let catalogIsLive = false;
export function markCatalogLive() {
  if (catalogIsLive) return;
  catalogIsLive = true;
  useCatalogVersion.setState((s) => ({ version: s.version + 1 }));
}

/** Subscribes the component to catalogue changes and returns the current catalogue. */
export function useCatalog() {
  useCatalogVersion((s) => s.version);
  return { products, categories };
}

export const getProductBySlug = (slug: string) => bySlug.get(slug);
export const getProductById = (id: string) => byId.get(id);
export const getCategory = (slug: string | undefined) => categories.find((c) => c.slug === slug);
export const isCategorySlug = (s: string | undefined): s is CategorySlug => !!getCategory(s);
export const isOccasionSlug = (s: string | null | undefined): s is OccasionSlug =>
  !!s && occasions.some((o) => o.slug === s);

export const isPersonalised = (p: Product) => p.tags.includes('personalised');

/** The variant whose photos include the card image, so "Add to cart" from a card adds what the shopper saw. */
export function defaultVariant(p: Product): Variant {
  return p.variants.find((v) => v.images.includes(p.image)) ?? p.variants[0];
}

export function getVariant(p: Product, catalogId: string | null | undefined): Variant {
  return (catalogId && p.variants.find((v) => v.catalogId === catalogId)) || defaultVariant(p);
}

/** Lower-case and strip accents, so "macrame" finds "Macramé". */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export interface Filters {
  category: CategorySlug | 'all';
  occasion: OccasionSlug | 'all';
  query: string;
}

export function matchesQuery(p: Product, query: string): boolean {
  const terms = normalise(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = searchIndex.get(p.id) ?? '';
  return terms.every((t) => hay.includes(t));
}

/** Products matching occasion + search (ignores category, so pills can show live counts). */
export function baseFilter(list: readonly Product[], f: Omit<Filters, 'category'>): Product[] {
  return list.filter((p) => (f.occasion === 'all' || p.tags.includes(f.occasion)) && matchesQuery(p, f.query));
}

export function filterProducts(list: readonly Product[], f: Filters): Product[] {
  return baseFilter(list, f).filter((p) => f.category === 'all' || p.category === f.category);
}

export function relatedProducts(p: Product, n = 4): Product[] {
  const same = products.filter((x) => x.category === p.category && x.id !== p.id);
  // Rotate from the product's position so neighbouring pages show different picks.
  const start = Math.max(0, same.findIndex((x) => x.id > p.id));
  return [...same.slice(start), ...same.slice(0, start)].slice(0, n);
}

setCatalog(builtIn);
