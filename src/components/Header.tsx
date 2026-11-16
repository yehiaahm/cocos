import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from './Logo';
import { Bag, Close, Menu, Package, User } from './Icons';
import { selectCount, useCart } from '../store/cart';
import { useUi } from '../store/ui';
import { useAuth } from '../store/auth';
import { useMyOrders } from '../store/myOrders';
import { isOpenOrder } from '../lib/order-status';
import { Avatar } from '../pages/AccountPage';
import { useWorkshops } from '../data/workshops';

export const NAV_LINKS = [
  { to: '/shop', label: 'Shop' },
  { to: '/#collections', label: 'Categories' },
  { to: '/#games', label: 'Board games' },
  { to: '/#workshops', label: 'Workshops' },
  { to: '/#gifts', label: 'Custom gifts' },
] as const;

export function CartButton({ className = '' }: { className?: string }) {
  const count = useCart(selectCount);
  const openDrawer = useUi((s) => s.openDrawer);
  return (
    <button
      type="button"
      onClick={(e) => openDrawer(e.currentTarget)}
      aria-haspopup="dialog"
      className={`btn btn-primary inline-flex min-h-[46px] items-center gap-2.5 rounded-full border-0 bg-ink px-5 text-sm font-bold text-cream ${className}`}
    >
      <Bag />
      <span className="max-[400px]:sr-only">Cart</span>
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-[7px] text-xs text-ink">
        {count}
      </span>
      <span className="sr-only">{count === 1 ? 'item' : 'items'}</span>
    </button>
  );
}

/** "My orders": shown once this device (or the signed-in account) has an order, with a dot while one is still on its way. */
export function OrdersButton() {
  const user = useAuth((s) => s.user);
  const saved = useMyOrders((s) => s.saved.length);
  const open = useMyOrders((s) => s.orders.filter((o) => isOpenOrder(o.status)).length);
  const { pathname } = useLocation();
  if (!user && saved === 0) return null;
  return (
    <Link
      to="/orders"
      aria-label={open > 0 ? `Track your orders (${open} in progress)` : 'Your orders'}
      aria-current={pathname === '/orders' ? 'page' : undefined}
      className="btn relative inline-flex h-[46px] min-w-[46px] items-center justify-center rounded-full border-[1.5px] border-line bg-transparent px-1 text-ink no-underline hover:border-ink hover:text-ink aria-[current=page]:border-ink"
    >
      <Package size={22} />
      {open > 0 && <span aria-hidden="true" className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-cream bg-gold" />}
    </Link>
  );
}

/** Account icon: "Sign in" for guests, the customer's avatar once signed in. */
export function AccountButton() {
  const user = useAuth((s) => s.user);
  const { pathname } = useLocation();
  const to = user ? '/account' : pathname === '/login' || pathname === '/account' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`;
  return (
    <Link
      to={to}
      aria-label={user ? `Your account (${user.name})` : 'Sign in'}
      aria-current={pathname === '/account' || pathname === '/login' ? 'page' : undefined}
      className="btn inline-flex h-[46px] min-w-[46px] items-center justify-center gap-2 rounded-full border-[1.5px] border-line bg-transparent px-1 text-sm font-bold text-ink no-underline hover:border-ink hover:text-ink aria-[current=page]:border-ink"
    >
      {user ? <Avatar user={user} size={34} /> : <User />}
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  // The Workshops link goes away when the owner has hidden or deleted every workshop.
  const hasWorkshops = useWorkshops().length > 0;
  const links = hasWorkshops ? NAV_LINKS : NAV_LINKS.filter((l) => l.to !== '/#workshops');
  const { pathname, hash } = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname, hash]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !toggleRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const isActive = (to: string) => (to === '/shop' ? pathname.startsWith('/shop') || pathname.startsWith('/product') : false);

  return (
    <header className="relative z-20">
      <a href="#main" className="sr-only-focusable rounded-full bg-ink px-5 py-3 font-bold text-cream">
        Skip to content
      </a>
      <div className="container-page flex items-center justify-between gap-4 py-[22px] max-[560px]:py-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-9 text-[15px] font-semibold min-[981px]:flex">
          {links.map((l) =>
            l.to.includes('#') ? (
              <Link key={l.to} to={l.to} className="nav-link relative text-ink no-underline hover:text-ink">
                {l.label}
              </Link>
            ) : (
              <NavLink
                key={l.to}
                to={l.to}
                aria-current={isActive(l.to) ? 'page' : undefined}
                className="nav-link relative text-ink no-underline hover:text-ink aria-[current=page]:text-teal-dark"
              >
                {l.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2.5">
          <OrdersButton />
          <AccountButton />
          <CartButton />
          <button
            ref={toggleRef}
            type="button"
            className="btn inline-flex h-[46px] w-[46px] items-center justify-center rounded-full border-[1.5px] border-line bg-transparent text-ink min-[981px]:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          className="menu-panel absolute inset-x-4 top-full z-30 rounded-[24px] border border-line-2 bg-cream p-3 shadow-[0_30px_60px_-30px_rgba(11,46,51,.55)] min-[981px]:hidden"
        >
          <nav aria-label="Mobile">
            <ul className="m-0 flex list-none flex-col p-0">
              {links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(l.to) ? 'page' : undefined}
                    className="flex min-h-[52px] items-center justify-between rounded-2xl px-4 font-serif text-[26px] font-medium text-ink no-underline hover:bg-white aria-[current=page]:text-teal-dark"
                  >
                    {l.label}
                    <span aria-hidden="true" className="text-teal">→</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/orders"
                  onClick={() => setOpen(false)}
                  className="flex min-h-[52px] items-center justify-between rounded-2xl px-4 font-serif text-[26px] font-medium text-ink no-underline hover:bg-white"
                >
                  Track your order
                  <span aria-hidden="true" className="text-teal">→</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
