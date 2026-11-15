import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { CatalogOverride, CatalogOverrides, PaymentSettings } from '../lib/api-types';
import { markCatalogLive, setCatalog, type CatalogData, type Product } from '../data/catalog';
import { sanitiseLines, useCart } from './cart';

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

let appliedRev: number | undefined;

export const useLive = create<LiveState>()((set, get) => ({
  status: 'idle',
  overrides: {},
  payment: null,
  load: async (force) => {
    if (!force && (get().status === 'loading' || get().status === 'ready')) return;
    set({ status: 'loading' });
    try {
      // A forced reload skips the browser's 30-second cache, so a page that was just published is found.
      const res = await fetch('/api/catalog', { headers: { accept: 'application/json' }, cache: force ? 'no-store' : 'default' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { overrides: CatalogOverrides; payment: PaymentSettings; rev?: number; catalog?: CatalogData };
      // Once the dashboard has changed the catalogue the server sends all of it; until then the bundled one is exact.
      if (data.catalog && data.rev !== appliedRev) {
        appliedRev = data.rev;
        setCatalog(data.catalog);
      }
      markCatalogLive();
      // Cart lines for products that were deleted in the meantime are dropped now that we know the real catalogue.
      useCart.setState((s) => ({ lines: sanitiseLines(s.lines) }));
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

let freshTried = false;
/**
 * A product or category that is not in the catalogue we have may simply have been published a moment ago
 * (the first answer can be up to 30 seconds old). Before giving up, ask the server once for a fresh copy.
 * Returns true while that check is running.
 */
export function useFreshCatalogOnMiss(): boolean {
  const [checking, setChecking] = useState(!freshTried);
  useEffect(() => {
    if (freshTried) return;
    freshTried = true;
    void useLive
      .getState()
      .load(true)
      .finally(() => setChecking(false));
  }, []);
  return checking;
}
