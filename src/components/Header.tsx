import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from './Logo';
import { Bag, Close, Menu } from './Icons';
import { selectCount, useCart } from '../store/cart';
import { useUi } from '../store/ui';

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

export function Header() {
  const [open, setOpen] = useState(false);
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
          {NAV_LINKS.map((l) =>
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
              {NAV_LINKS.map((l) => (
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
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
