import raw from '../../data/products.json';

export type CategorySlug = 'gaming' | 'resin' | 'wood-decoupage' | 'macrame' | 'candles' | 'concrete';
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
  count: number;
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

export const products: readonly Product[] = data.products.filter(
  (p) => !HIDDEN_IDS.has(p.id) && !p.variants.some((v) => HIDDEN_IDS.has(v.catalogId)),
);

export const categories: readonly Category[] = data.categories.map((c) => ({
  ...c,
  count: products.filter((p) => p.category === c.slug).length,
}));

export const occasions: readonly Occasion[] = data.occasions;

const bySlug = new Map(products.map((p) => [p.slug, p]));
const byId = new Map(products.map((p) => [p.id, p]));

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

const searchIndex = new Map(
  products.map((p) => [p.id, normalise([p.name, p.description, ...p.variants.map((v) => v.name)].join(' '))]),
);

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
