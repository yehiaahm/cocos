import { create } from 'zustand';
import type { CatalogOverride, CatalogOverrides, PaymentSettings } from '../lib/api-types';
import type { Product } from '../data/catalog';

/**
 * Live catalog data from the dashboard (prices, hidden, sold out, payment details).
 * The prerendered HTML shows the bundled data; this layer updates it after load.
 */
interface LiveState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  overrides: CatalogOverrides;
  payment: PaymentSettings | null;
  load: (force?: boolean) => Promise<void>;
}

export const useLive = create<LiveState>()((set, get) => ({
  status: 'idle',
  overrides: {},
  payment: null,
  load: async (force) => {
    if (!force && (get().status === 'loading' || get().status === 'ready')) return;
    set({ status: 'loading' });
    try {
      const res = await fetch('/api/catalog', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { overrides: CatalogOverrides; payment: PaymentSettings };
      set({ status: 'ready', overrides: data.overrides ?? {}, payment: data.payment ?? null });
    } catch {
      // Offline or API not deployed: the site keeps working with "Price pending".
      set({ status: 'error' });
    }
  },
}));

const NONE: CatalogOverride = { price: null, hidden: false, soldOut: false };

export function liveFor(overrides: CatalogOverrides, p: Product): CatalogOverride {
  const o = overrides[p.id];
  if (o) return o;
  return p.priceStatus === 'set' && typeof p.price === 'number' ? { ...NONE, price: p.price } : NONE;
}

/** Price, hidden and sold-out state for one product (re-renders when the dashboard data arrives). */
export const useLiveProduct = (p: Product) => useLive((s) => liveFor(s.overrides, p));
