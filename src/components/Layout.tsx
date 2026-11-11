import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { Header } from './Header';
import { CartDrawer } from './CartDrawer';
import { FloatingCart, FlyToCart } from './FloatingCart';
import { useCart } from '../store/cart';
import { CART_STORAGE_KEY } from '../store/cart';

/** Scroll to top on new pages, to the anchor for hash links, and leave back/forward alone. */
function ScrollManager() {
  const { pathname, hash, state } = useLocation();
  const navType = useNavigationType();
  const latest = useRef({ state, navType });
  latest.current = { state, navType };

  // Only page/anchor changes scroll; search-param updates (filters, search) never do.
  useEffect(() => {
    const { state, navType } = latest.current;
    if (navType === 'POP') return;
    if ((state as { keepScroll?: boolean } | null)?.keepScroll) return;
    if (hash) {
      let tries = 0;
      const go = () => {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (el) el.scrollIntoView({ block: 'start' });
        else if (tries++ < 10) requestAnimationFrame(go);
      };
      go();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

/** IntersectionObserver fallback for `.reveal` where scroll-driven animations are unsupported. */
function RevealObserver() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (CSS.supports?.('animation-timeline: view()') || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}

/** Restore the persisted cart after hydration, and keep it in sync across tabs. */
function CartSync() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) void useCart.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}

export function Layout({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-cream text-ink">
      <CartSync />
      <ScrollManager />
      <RevealObserver />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      {footer}
      {pathname !== '/checkout' && <FloatingCart />}
      <FlyToCart />
      <CartDrawer />
    </div>
  );
}
