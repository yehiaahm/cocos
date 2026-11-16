import { create } from 'zustand';
import type { AccountOrderSummary } from '../lib/api-types';

export const ORDERS_STORAGE_KEY = 'coco-orders';
const MAX_SAVED = 30;

/** An order this browser knows about: its number and the private token from the order link. */
export interface SavedOrder {
  number: string;
  token: string;
  savedAt: number;
}

/** Drops anything malformed, de-duplicates by number (newest wins) and caps the list. */
export function sanitiseSaved(input: unknown): SavedOrder[] {
  if (!Array.isArray(input)) return [];
  const out = new Map<string, SavedOrder>();
  for (const o of input) {
    if (!o || typeof o !== 'object') continue;
    const { number, token, savedAt } = o as Partial<SavedOrder>;
    if (typeof number !== 'string' || typeof token !== 'string') continue;
    if (!/^CA-\d{4,8}$/.test(number) || token.length < 8 || token.length > 80) continue;
    const prev = out.get(number);
    const at = typeof savedAt === 'number' && Number.isFinite(savedAt) ? savedAt : 0;
    if (!prev || at >= prev.savedAt) out.set(number, { number, token, savedAt: at });
  }
  return [...out.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_SAVED);
}

function read(): SavedOrder[] {
  try {
    return sanitiseSaved(JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

function write(saved: SavedOrder[]) {
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* storage blocked — the order link still works */
  }
}

/** Newest first, one row per order number. */
export function mergeOrders(...lists: AccountOrderSummary[][]): AccountOrderSummary[] {
  const byNumber = new Map<string, AccountOrderSummary>();
  for (const o of lists.flat()) byNumber.set(o.number, o);
  return [...byNumber.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

interface MyOrdersState {
  /** Orders remembered on this device (guest checkouts, opened order links, found by number + phone). */
  saved: SavedOrder[];
  /** Their live status, plus the signed-in account's orders. */
  orders: AccountOrderSummary[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  hydrated: boolean;
  hydrate: () => void;
  save: (number: string, token: string) => void;
  forget: (number: string) => void;
  /** Saves an order found by number + phone and shows it right away. */
  addFound: (order: AccountOrderSummary) => void;
  refresh: (signedIn: boolean) => Promise<void>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

export const useMyOrders = create<MyOrdersState>()((set, get) => ({
  saved: [],
  orders: [],
  status: 'idle',
  hydrated: false,
  // Called after mount so the prerendered HTML and the first client render match.
  hydrate: () => set({ saved: read(), hydrated: true }),
  save: (number, token) => {
    const current = get().hydrated ? get().saved : read();
    const saved = sanitiseSaved([{ number, token, savedAt: Date.now() }, ...current]);
    write(saved);
    set({ saved, hydrated: true });
  },
  forget: (number) => {
    const saved = get().saved.filter((o) => o.number !== number);
    write(saved);
    // An order that belongs to the signed-in account comes back on the next refresh; "remove" only clears this device.
    set({ saved, orders: get().orders.filter((o) => o.number !== number) });
  },
  addFound: (order) => {
    get().save(order.number, order.token);
    set({ orders: mergeOrders(get().orders, [order]) });
  },
  refresh: async (signedIn) => {
    if (!get().hydrated) get().hydrate();
    const { saved } = get();
    if (saved.length === 0 && !signedIn) return set({ orders: [], status: 'ready' });
    if (get().orders.length === 0) set({ status: 'loading' });
    try {
      const [fromDevice, fromAccount] = await Promise.all([
        saved.length ? postJson<{ orders: AccountOrderSummary[] }>('/api/orders/status', { orders: saved }).then((d) => d.orders) : [],
        signedIn
          ? fetch('/api/account/orders', { headers: { accept: 'application/json' }, credentials: 'same-origin' })
              .then((r) => (r.ok ? (r.json() as Promise<{ orders: AccountOrderSummary[] }>) : { orders: [] }))
              .then((d) => d.orders)
          : [],
      ]);
      set({ orders: mergeOrders(fromDevice, fromAccount), status: 'ready' });
    } catch {
      set({ status: get().orders.length ? 'ready' : 'error' });
    }
  },
}));
