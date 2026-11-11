import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router';
import { api } from './api';
import { Icon } from './ui';
import { ensureWorker } from './push';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';
import { site } from '../config/site';

interface Session {
  vapidPublicKey: string | null;
  badges: { newOrders: number; proofs: number };
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const SessionCtx = createContext<Session | null>(null);
export const useSession = () => useContext(SessionCtx)!;

/** A short two-note chime when a new order arrives while the dashboard is open. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.16);
      o.stop(ctx.currentTime + i * 0.16 + 0.4);
    });
  } catch {
    /* audio blocked until the first tap — fine */
  }
}

/** Dashboard-specific <head>: RTL, noindex, installable as its own app on phones. */
function useAdminHead() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = { dir: html.dir, lang: html.lang, title: document.title };
    html.dir = 'rtl';
    html.lang = 'ar';
    const manifest = document.querySelector<HTMLLinkElement>('link[rel=manifest]');
    const prevManifest = manifest?.href;
    if (manifest) manifest.href = '/admin.webmanifest';
    const add = (attrs: Record<string, string>) => {
      const m = document.createElement('meta');
      for (const [k, v] of Object.entries(attrs)) m.setAttribute(k, v);
      m.dataset.admin = '';
      document.head.appendChild(m);
    };
    add({ name: 'robots', content: 'noindex, nofollow' });
    add({ name: 'apple-mobile-web-app-capable', content: 'yes' });
    add({ name: 'mobile-web-app-capable', content: 'yes' });
    add({ name: 'apple-mobile-web-app-title', content: 'Coco Admin' });
    add({ name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
    return () => {
      html.dir = prev.dir;
      html.lang = prev.lang;
      document.title = prev.title;
      if (manifest && prevManifest) manifest.href = prevManifest;
      document.head.querySelectorAll('[data-admin]').forEach((n) => n.remove());
    };
  }, []);
}

const NAV = [
  { to: '/admin', label: 'الرئيسية', icon: Icon.home, end: true },
  { to: '/admin/orders', label: 'الطلبات', icon: Icon.orders, badge: 'orders' as const },
  { to: '/admin/products', label: 'المنتجات', icon: Icon.products },
  { to: '/admin/customers', label: 'العملاء', icon: Icon.customers },
  { to: '/admin/settings', label: 'الإعدادات', icon: Icon.settings },
];

function Shell({ children }: { children: ReactNode }) {
  const { badges, signOut } = useSession();
  const total = badges.newOrders + badges.proofs;
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  useEffect(() => {
    document.title = `${total ? `(${total}) ` : ''}لوحة التحكم · ${site.name}`;
  }, [total]);

  const navItem = (n: (typeof NAV)[number], mobile: boolean) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        mobile
          ? `relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold no-underline ${isActive ? 'text-ink' : 'text-[#7C8A8C]'}`
          : `relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] font-bold no-underline transition-colors ${
              isActive ? 'bg-ink text-cream hover:text-cream' : 'text-ink hover:bg-[#EDE8DE] hover:text-ink'
            }`
      }
    >
      {n.icon()}
      <span>{n.label}</span>
      {n.badge && total > 0 && (
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D9534F] px-1.5 text-[11px] font-bold text-white ${
            mobile ? 'absolute right-[calc(50%-22px)] top-1.5' : 'ms-auto'
          }`}
        >
          {total}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-[#F4F1EA] font-ar text-ink" dir="rtl">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-[248px] flex-col border-l border-[#E7E1D5] bg-[#FBF9F5] p-4 min-[900px]:flex">
        <Link to="/admin" className="mb-6 flex items-center gap-2.5 px-2 pt-2 no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-script text-[26px] text-gold-light">C</span>
          <span className="leading-tight">
            <strong className="block text-[15px] text-ink">{site.name}</strong>
            <span className="text-xs text-muted-2">لوحة التحكم</span>
          </span>
        </Link>
        <nav aria-label="القائمة" className="flex flex-col gap-1">
          {NAV.map((n) => navItem(n, false))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-[#E7E1D5] pt-3">
          <a href="/" target="_blank" rel="noopener" className="flex min-h-10 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-muted-2 no-underline hover:bg-[#EDE8DE] hover:text-ink">
            {Icon.ext(18)} عرض المتجر
          </a>
          <button type="button" onClick={() => void signOut()} className="flex min-h-10 items-center gap-3 rounded-xl border-0 bg-transparent px-3.5 text-sm font-semibold text-muted-2 hover:bg-[#EDE8DE] hover:text-ink">
            {Icon.out(18)} تسجيل الخروج
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E7E1D5] bg-[#F4F1EA]/90 px-4 py-3 backdrop-blur min-[900px]:hidden">
        <Link to="/admin" className="flex items-center gap-2 no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink font-script text-[22px] text-gold-light">C</span>
          <strong className="text-[15px] text-ink">لوحة التحكم</strong>
        </Link>
        <a href="/" target="_blank" rel="noopener" className="text-sm font-bold text-teal-dark no-underline">
          المتجر ↗
        </a>
      </header>

      <main className="px-4 pb-28 pt-5 min-[900px]:mr-[248px] min-[900px]:px-8 min-[900px]:pb-12 min-[900px]:pt-8">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      <nav
        aria-label="القائمة"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#E7E1D5] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur min-[900px]:hidden"
      >
        {NAV.map((n) => navItem(n, true))}
      </nav>
    </div>
  );
}

function SignInRedirect() {
  useEffect(() => {
    const here = window.location.pathname + window.location.search;
    window.location.replace(`/login?next=${encodeURIComponent(here)}`);
  }, []);
  return <div className="min-h-screen bg-[#F4F1EA]" aria-busy="true" />;
}

export default function AdminApp() {
  useAdminHead();
  const [state, setState] = useState<'checking' | 'anon' | 'authed'>('checking');
  const [info, setInfo] = useState<Omit<Session, 'refresh' | 'signOut'>>({ vapidPublicKey: null, badges: { newOrders: 0, proofs: 0 } });
  const lastNew = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ vapidPublicKey: string | null; badges: Session['badges'] }>('/api/admin/me');
      if (lastNew.current !== null && me.badges.newOrders > lastNew.current) chime();
      lastNew.current = me.badges.newOrders;
      setInfo({ vapidPublicKey: me.vapidPublicKey, badges: me.badges });
      setState('authed');
    } catch (e) {
      if ((e as { status?: number }).status === 401) setState('anon');
      else setState((s) => (s === 'checking' ? 'anon' : s));
    }
  }, []);

  const signOut = useCallback(async () => {
    await api('/api/admin/login', { method: 'DELETE' }).catch(() => undefined);
    lastNew.current = null;
    window.location.assign('/login');
  }, []);

  useEffect(() => {
    void refresh();
    const onUnauth = () => setState('anon');
    window.addEventListener('admin:unauthorized', onUnauth);
    return () => window.removeEventListener('admin:unauthorized', onUnauth);
  }, [refresh]);

  // Badges and the new-order chime: poll every 30s, and right away when the app comes back to the front.
  useEffect(() => {
    if (state !== 'authed') return;
    ensureWorker();
    const t = setInterval(() => void refresh(), 30_000);
    const onVis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [state, refresh]);

  if (state === 'checking') return <div className="min-h-screen bg-[#F4F1EA]" aria-busy="true" />;
  // Not signed in: the owner uses the shop's normal login page (email + password), then comes back here.
  if (state === 'anon') return <SignInRedirect />;

  return (
    <SessionCtx.Provider value={{ ...info, refresh, signOut }}>
      <Shell>
        <Routes>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/orders" element={<OrdersPage />} />
          <Route path="/admin/orders/:id" element={<OrderDetailPage />} />
          <Route path="/admin/products" element={<ProductsPage />} />
          <Route path="/admin/customers" element={<CustomersPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </Shell>
    </SessionCtx.Provider>
  );
}
