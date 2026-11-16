import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../store/auth';
import { useMyOrders } from '../store/myOrders';
import { STATUS_LINE, STATUS_STYLE, isOpenOrder } from '../lib/order-status';
import { orderHref } from './OrderBits';
import { Close, Package } from './Icons';

const DISMISS_KEY = 'coco-orderbar';
/** The bar stays out of the way on pages that already are the order, and on checkout. */
const HIDDEN_ON = (p: string) => p === '/checkout' || p === '/orders' || p.startsWith('/order/') || p.startsWith('/admin');

/**
 * Keeps the customer's orders fresh (so the header badge and the bar are right on any page),
 * and refreshes again when they return to the tab.
 */
export function OrdersSync() {
  const { pathname } = useLocation();
  const authStatus = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const hydrate = useMyOrders((s) => s.hydrate);
  const refresh = useMyOrders((s) => s.refresh);

  useEffect(() => hydrate(), [hydrate]);

  // Wait until we know whether somebody is signed in, so the account's orders are fetched together with the saved ones.
  useEffect(() => {
    if (authStatus === 'idle' || authStatus === 'loading') return;
    void refresh(!!user);
  }, [authStatus, user, pathname, refresh]);

  useEffect(() => {
    if (authStatus === 'idle' || authStatus === 'loading') return;
    const onVisible = () => document.visibilityState === 'visible' && void refresh(!!user);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [authStatus, user, refresh]);

  return null;
}

/** A slim bar above the header: "Order CA-1001 · Being made — Track". The customer sees their order the moment they open the site. */
export function OrderBar() {
  const { pathname } = useLocation();
  const orders = useMyOrders((s) => s.orders);
  const [dismissed, setDismissed] = useState('');

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) ?? '');
    } catch {
      /* storage blocked */
    }
  }, []);

  const open = orders.filter((o) => isOpenOrder(o.status));
  // The order that changed most recently is the one worth showing.
  const latest = [...open].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (!latest || HIDDEN_ON(pathname)) return null;
  const mark = `${latest.number}:${latest.status}`;
  if (dismissed === mark) return null;

  const more = open.length - 1;
  const dismiss = () => {
    setDismissed(mark);
    try {
      sessionStorage.setItem(DISMISS_KEY, mark);
    } catch {
      /* storage blocked */
    }
  };

  return (
    <div role="region" aria-label="Your order" className="relative z-30 bg-ink text-cream">
      <div className="container-page flex items-center gap-3 py-2.5 text-sm">
        <Package size={18} className="flex-none text-gold-light" />
        <Link to={more > 0 ? '/orders' : orderHref(latest)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-cream no-underline hover:text-cream">
          <strong className="whitespace-nowrap">Order {latest.number}</strong>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[latest.status].cls}`}>{STATUS_STYLE[latest.status].label}</span>
          <span className="hidden text-mist-2 min-[720px]:inline">{STATUS_LINE[latest.status]}</span>
          <span className="whitespace-nowrap font-bold text-gold-light underline underline-offset-4">{more > 0 ? `Track ${open.length} orders` : 'Track order'}</span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this message"
          className="inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-cream hover:bg-white/10"
        >
          <Close size={16} />
        </button>
      </div>
    </div>
  );
}
