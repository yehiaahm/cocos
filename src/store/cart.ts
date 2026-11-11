import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getProductById } from '../data/catalog';

export const CART_STORAGE_KEY = 'coco-cart';
export const MAX_QTY = 99;

export interface CartLine {
  /** product id + variant id (+ personalisation text, so two names are two lines) */
  key: string;
  productId: string;
  variantId: string;
  qty: number;
  personalisation?: string;
}

export interface AddInput {
  productId: string;
  variantId: string;
  qty?: number;
  personalisation?: string;
}

interface CartState {
  lines: CartLine[];
  hydrated: boolean;
  add: (input: AddInput) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export const lineKey = (productId: string, variantId: string, personalisation?: string) =>
  [productId, variantId, personalisation?.trim() || ''].filter(Boolean).join('|');

const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));

/** Drop anything malformed or no longer in the catalog (e.g. a product the owner hid). */
export function sanitiseLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const out = new Map<string, CartLine>();
  for (const l of input) {
    if (!l || typeof l !== 'object') continue;
    const { productId, variantId, qty, personalisation } = l as Partial<CartLine>;
    if (typeof productId !== 'string' || typeof variantId !== 'string') continue;
    const p = getProductById(productId);
    if (!p || !p.variants.some((v) => v.catalogId === variantId)) continue;
    const text = typeof personalisation === 'string' ? personalisation.trim().slice(0, 80) : '';
    const key = lineKey(productId, variantId, text);
    const prev = out.get(key);
    out.set(key, {
      key,
      productId,
      variantId,
      qty: clampQty((prev?.qty ?? 0) + (typeof qty === 'number' ? qty : 1)),
      ...(text ? { personalisation: text } : {}),
    });
  }
  return [...out.values()];
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hydrated: false,
      add: ({ productId, variantId, qty = 1, personalisation }) =>
        set((s) => {
          const text = personalisation?.trim().slice(0, 80) || undefined;
          const key = lineKey(productId, variantId, text);
          const existing = s.lines.find((l) => l.key === key);
          if (existing) {
            return { lines: s.lines.map((l) => (l.key === key ? { ...l, qty: clampQty(l.qty + qty) } : l)) };
          }
          return {
            lines: [
              ...s.lines,
              { key, productId, variantId, qty: clampQty(qty), ...(text ? { personalisation: text } : {}) },
            ],
          };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, qty: clampQty(qty) } : l)),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
      // Older/prototype shapes in `coco-cart` are discarded safely.
      migrate: () => ({ lines: [] }),
      merge: (persisted, current) => ({
        ...current,
        lines: sanitiseLines((persisted as { lines?: unknown } | undefined)?.lines),
      }),
      // Rehydrated manually after mount so prerendered HTML and the first client render match.
      skipHydration: true,
      onRehydrateStorage: () => () => useCart.setState({ hydrated: true }),
    },
  ),
);

export const selectCount = (s: CartState) => s.lines.reduce((t, l) => t + l.qty, 0);
