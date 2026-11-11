import { useMemo } from 'react';
import { products, type Product } from './catalog';
import { useLive } from '../store/live';

export type ProductsState =
  | { status: 'loading'; products: readonly Product[] }
  | { status: 'error'; products: readonly Product[]; error: string }
  | { status: 'ready'; products: readonly Product[] };

/**
 * Single access point for the product list. The catalog is bundled (and prerendered for SEO);
 * products the owner hides in the dashboard drop out as soon as the live data arrives.
 */
export function useProducts(): ProductsState {
  const overrides = useLive((s) => s.overrides);
  const visible = useMemo(() => products.filter((p) => !overrides[p.id]?.hidden), [overrides]);
  return { status: 'ready', products: visible };
}
