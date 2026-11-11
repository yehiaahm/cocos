import raw from '../data/products.json';
import type { CatalogOverride, CatalogOverrides } from '../src/lib/api-types';

/** Server copy of the catalog: the same JSON the storefront is built from. */
interface Variant {
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
  categoryName: string;
  image: string;
  tags: string[];
  variants: Variant[];
}

const HIDDEN_IDS = new Set(['coco-014', 'coco-015', 'coco-021', 'coco-027', 'coco-043', 'coco-084']);

export const products: Product[] = (raw as unknown as { products: Product[] }).products.filter(
  (p) => !HIDDEN_IDS.has(p.id) && !p.variants.some((v) => HIDDEN_IDS.has(v.catalogId)),
);
const byId = new Map(products.map((p) => [p.id, p]));
export const getProduct = (id: string) => byId.get(id);

export async function loadOverrides(db: D1Database): Promise<CatalogOverrides> {
  const { results } = await db
    .prepare('SELECT product_id, price, hidden, sold_out FROM product_overrides')
    .all<{ product_id: string; price: number | null; hidden: number; sold_out: number }>();
  const out: CatalogOverrides = {};
  for (const r of results) {
    if (!byId.has(r.product_id)) continue;
    out[r.product_id] = { price: r.price, hidden: !!r.hidden, soldOut: !!r.sold_out };
  }
  return out;
}

export const overrideFor = (o: CatalogOverrides, id: string): CatalogOverride => o[id] ?? { price: null, hidden: false, soldOut: false };
