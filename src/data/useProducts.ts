import { products, type Product } from './catalog';

export type ProductsState =
  | { status: 'loading'; products: readonly Product[] }
  | { status: 'error'; products: readonly Product[]; error: string }
  | { status: 'ready'; products: readonly Product[] };

/**
 * Single access point for the product list. Today the catalog is bundled, so it is
 * ready immediately (and prerendered for SEO). When products move to an API or CMS,
 * swap this hook for a fetch — the Shop page already renders loading and error states.
 */
export function useProducts(): ProductsState {
  return { status: 'ready', products };
}
