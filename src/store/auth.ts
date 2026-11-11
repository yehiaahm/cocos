import { create } from 'zustand';
import type { AccountUser, AuthMe } from '../lib/api-types';

/** The signed-in customer (session is an HttpOnly cookie; this mirrors GET /api/auth/me). */
interface AuthState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  user: AccountUser | null;
  /** "Continue with Google" is configured on the server. */
  google: boolean;
  load: (force?: boolean) => Promise<void>;
  setUser: (user: AccountUser | null) => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>()((set, get) => ({
  status: 'idle',
  user: null,
  google: false,
  load: async (force) => {
    if (!force && (get().status === 'loading' || get().status === 'ready')) return;
    set({ status: 'loading' });
    try {
      const res = await fetch('/api/auth/me', { headers: { accept: 'application/json' }, credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as AuthMe;
      set({ status: 'ready', user: data.user, google: data.google });
    } catch {
      set({ status: 'error', user: null });
    }
  },
  setUser: (user) => set({ user, status: 'ready' }),
  signOut: async () => {
    await fetch('/api/auth/login', { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined);
    set({ user: null, status: 'ready' });
  },
}));

/** POST helper for the auth endpoints: returns the JSON body or throws { message, code }. */
export async function authRequest<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw { message: 'We could not reach the shop. Please check your connection and try again.', code: 'network' };
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) throw { message: data.error ?? 'Something went wrong. Please try again.', code: data.code ?? 'error' };
  return data;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '•';
