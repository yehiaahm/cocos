import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Seo } from '../lib/seo';
import { useAuth } from '../store/auth';
import { useMyOrders } from '../store/myOrders';
import { isOpenOrder } from '../lib/order-status';
import type { AccountOrderSummary } from '../lib/api-types';
import { OrderCard, orderHref } from '../components/OrderBits';
import { ArrowRight } from '../components/Icons';

const inputCls =
  'min-h-[52px] w-full rounded-2xl border-[1.5px] border-line-2 bg-white px-4 text-base text-ink outline-none placeholder:text-muted-2 focus:border-teal';

/** Find an order again with its number + the mobile used at checkout (for guests who lost the link). */
function FindOrder() {
  const navigate = useNavigate();
  const addFound = useMyOrders((s) => s.addFound);
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ number, phone }),
      });
      const data = (await res.json().catch(() => ({}))) as { order?: AccountOrderSummary; error?: string };
      if (!res.ok || !data.order) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      addFound(data.order);
      navigate(orderHref(data.order));
    } catch {
      setError('We could not reach the shop. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-[28px] bg-sand p-7 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="find-title">
      <h2 id="find-title" className="m-0 font-serif text-[30px] font-medium">
        Find an order
      </h2>
      <p className="mb-5 mt-1 text-sm text-muted-2">
        Ordered on another phone, or lost the link? Enter your order number (it starts with CA-) and the mobile number you ordered with.
      </p>
      <div className="grid gap-4">
        <label className="block text-sm font-bold">
          <span className="mb-2 block">Order number</span>
          <input
            value={number}
            onChange={(e) => (setNumber(e.target.value), setError(''))}
            placeholder="CA-1001"
            autoComplete="off"
            autoCapitalize="characters"
            dir="ltr"
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-bold">
          <span className="mb-2 block">Mobile number</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010 1234 5678"
            value={phone}
            onChange={(e) => (setPhone(e.target.value), setError(''))}
            dir="ltr"
            className={inputCls}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mb-0 mt-3 text-sm font-semibold text-[#B3261E]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !number.trim() || !phone.trim()}
        className="btn btn-primary mt-5 inline-flex min-h-[52px] items-center gap-2.5 rounded-full border-0 bg-ink px-7 text-sm font-bold text-cream disabled:opacity-60"
      >
        {busy ? 'Searching…' : 'Find my order'} <ArrowRight />
      </button>
    </form>
  );
}

/** "My orders": every order from this device (and the signed-in account) with its live status. */
export function MyOrdersPage() {
  const orders = useMyOrders((s) => s.orders);
  const saved = useMyOrders((s) => s.saved);
  const status = useMyOrders((s) => s.status);
  const hydrated = useMyOrders((s) => s.hydrated);
  const forget = useMyOrders((s) => s.forget);
  const refresh = useMyOrders((s) => s.refresh);
  const user = useAuth((s) => s.user);
  const authStatus = useAuth((s) => s.status);

  // Fresh numbers when the page opens, when the customer comes back to the tab, and every minute while it is open.
  useEffect(() => {
    if (authStatus === 'idle' || authStatus === 'loading') return;
    const go = () => document.visibilityState === 'visible' && void refresh(!!user);
    go();
    const id = window.setInterval(go, 60_000);
    document.addEventListener('visibilitychange', go);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', go);
    };
  }, [authStatus, user, refresh]);

  const open = orders.filter((o) => isOpenOrder(o.status));
  const past = orders.filter((o) => !isOpenOrder(o.status));
  const onDevice = new Set(saved.map((s) => s.number));
  const loading = !hydrated || ((status === 'idle' || status === 'loading') && orders.length === 0 && (saved.length > 0 || !!user));

  const list = (items: AccountOrderSummary[]) => (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
      {items.map((o) => (
        <OrderCard key={o.number} order={o} onRemove={onDevice.has(o.number) && !user ? () => forget(o.number) : undefined} />
      ))}
    </ul>
  );

  return (
    <>
      <Seo title="My orders" path="/orders" noindex />
      <section className="container-page pb-6 pt-4">
        <p className="eyebrow mb-3">Track your orders</p>
        <h1 className="m-0 font-serif text-[clamp(38px,5.5vw,72px)] font-medium leading-[.95] tracking-[-.02em]">
          Your <em>orders.</em>
        </h1>
        <p className="mt-4 max-w-[620px] text-[17px] leading-[1.65] text-muted">
          {user ? 'Orders from your account and this device, always up to date.' : 'Every order you place or open on this device shows up here with its latest status.'}
          {!user && (
            <>
              {' '}
              <Link to="/login?next=/orders">Sign in</Link> to see them on every device.
            </>
          )}
        </p>
      </section>

      <div className="container-page grid items-start gap-8 pb-28 min-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8" aria-busy={loading}>
          {loading ? (
            <div className="flex flex-col gap-3.5">
              {[0, 1].map((i) => (
                <div key={i} className="skel h-[170px] rounded-[24px]" />
              ))}
            </div>
          ) : status === 'error' && orders.length === 0 ? (
            <p className="m-0 rounded-[24px] bg-white p-6 text-muted-2">We could not load your orders. Please check your connection and refresh the page.</p>
          ) : orders.length === 0 ? (
            <div className="rounded-[28px] bg-white p-7 max-[560px]:rounded-[22px] max-[560px]:p-5">
              <h2 className="m-0 font-serif text-[30px] font-medium">No orders on this device yet</h2>
              <p className="mb-5 mt-2 text-muted-2">When you place an order it will appear here automatically. If you ordered on another device, find it with the form.</p>
              <Link to="/shop" className="btn btn-primary inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-teal-btn px-6 font-bold text-white no-underline hover:text-white">
                Browse the shop <ArrowRight />
              </Link>
            </div>
          ) : (
            <>
              {open.length > 0 && (
                <section aria-labelledby="open-title">
                  <h2 id="open-title" className="mb-3 mt-0 font-serif text-[30px] font-medium">
                    In progress
                  </h2>
                  {list(open)}
                </section>
              )}
              {past.length > 0 && (
                <section aria-labelledby="past-title">
                  <h2 id="past-title" className="mb-3 mt-0 font-serif text-[30px] font-medium">
                    Past orders
                  </h2>
                  {list(past)}
                </section>
              )}
            </>
          )}
        </div>
        <div className="min-[900px]:sticky min-[900px]:top-6">
          <FindOrder />
        </div>
      </div>
    </>
  );
}
