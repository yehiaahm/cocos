import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Seo } from '../lib/seo';
import { authRequest, initials, useAuth } from '../store/auth';
import type { AccountOrderSummary, AccountUser, OrderStatus } from '../lib/api-types';
import { formatPrice, plural } from '../lib/format';
import { imageUrl } from '../lib/images';
import { ArrowRight, Check, GoogleLogo } from '../components/Icons';

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  new: { label: 'Received', cls: 'bg-[#E6F4F3] text-teal-dark' },
  confirmed: { label: 'Confirmed', cls: 'bg-[#E6F4F3] text-teal-dark' },
  in_progress: { label: 'Being made', cls: 'bg-[#FBF3DC] text-[#7A5C14]' },
  shipped: { label: 'On its way', cls: 'bg-[#FBF3DC] text-[#7A5C14]' },
  delivered: { label: 'Delivered', cls: 'bg-[#E3F1E5] text-[#24622F]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#F1ECE4] text-muted-2' },
};

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const inputCls =
  'min-h-[52px] w-full rounded-2xl border-[1.5px] border-line-2 bg-white px-4 text-base text-ink outline-none placeholder:text-muted-2 focus:border-teal';

export function AccountPage() {
  const navigate = useNavigate();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    if ((status === 'ready' || status === 'error') && !user) navigate('/login?next=/account', { replace: true });
  }, [status, user, navigate]);

  const seo = <Seo title="Your account" path="/account" noindex />;

  if (!user) {
    return (
      <>
        {seo}
        <section className="container-page min-h-[60vh] pb-28 pt-10" aria-busy="true">
          <p className="eyebrow mb-3">Your account</p>
          <h1 className="m-0 font-serif text-[clamp(40px,6vw,72px)] font-medium leading-none">Loading…</h1>
        </section>
      </>
    );
  }

  return (
    <>
      {seo}
      <section className="container-page flex flex-wrap items-end justify-between gap-6 pb-8 pt-4">
        <div className="flex items-center gap-5">
          <Avatar user={user} size={72} />
          <div>
            <p className="eyebrow mb-2">Your account · حسابك</p>
            <h1 className="m-0 font-serif text-[clamp(36px,5vw,64px)] font-medium leading-[.95] tracking-[-.02em]">
              Hello, <em>{user.name.split(' ')[0]}.</em>
            </h1>
            <p className="mb-0 mt-2 flex items-center gap-2 text-sm text-muted-2">
              {user.google && <GoogleLogo size={14} />}
              {user.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/', { replace: true });
          }}
          className="btn btn-ghost inline-flex min-h-[48px] items-center rounded-full border-[1.5px] border-ink bg-transparent px-6 text-sm font-bold text-ink"
        >
          Sign out
        </button>
      </section>

      <div className="container-page grid items-start gap-8 pb-28 min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Orders />
        <div className="flex flex-col gap-8">
          <Details user={user} />
          <Password user={user} />
        </div>
      </div>
    </>
  );
}

export function Avatar({ user, size = 40 }: { user: AccountUser; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (user.avatarUrl && !broken) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="flex-none rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-full bg-teal font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(user.name)}
    </span>
  );
}

function Orders() {
  const [orders, setOrders] = useState<AccountOrderSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/account/orders', { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { orders: AccountOrderSummary[] }) => live && setOrders(d.orders))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="rounded-[28px] bg-white p-8 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="orders-title" aria-busy={!orders && !failed}>
      <h2 id="orders-title" className="m-0 font-serif text-[34px] font-medium">
        Your orders
      </h2>
      {failed ? (
        <p className="mb-0 mt-3 text-muted-2">We couldn't load your orders. Please refresh the page.</p>
      ) : !orders ? (
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="skel h-[84px] rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-3">
          <p className="mt-0 text-muted-2">No orders yet. Orders you place while signed in will show up here.</p>
          <Link to="/shop" className="btn btn-primary inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-teal-btn px-6 font-bold text-white no-underline hover:text-white">
            Browse the shop <ArrowRight />
          </Link>
        </div>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {orders.map((o) => (
            <li key={o.number} className="border-b border-line last:border-0">
              <Link
                to={`/order/${o.number}?t=${encodeURIComponent(o.token)}`}
                className="flex items-center gap-4 rounded-2xl py-3.5 text-ink no-underline hover:text-ink"
              >
                {o.image ? (
                  <img src={imageUrl(o.image, 320)} alt="" width={60} height={60} className="h-[60px] w-[60px] flex-none rounded-xl object-cover" />
                ) : (
                  <span className="h-[60px] w-[60px] flex-none rounded-xl bg-sand" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-[15px]">{o.number}</strong>
                  <span className="text-[13px] text-muted-2">
                    {dateFmt.format(new Date(o.createdAt))} · {plural(o.itemCount, 'item')}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1.5">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS[o.status]?.cls ?? ''}`}>{STATUS[o.status]?.label ?? o.status}</span>
                  <span className="text-[13px] font-bold text-price">{o.total !== null ? formatPrice(o.total) : 'Total pending'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Details({ user }: { user: AccountUser }) {
  const setUser = useAuth((s) => s.setUser);
  const [form, setForm] = useState({ name: user.name, phone: user.phone ?? '', city: user.city ?? '', address: user.address ?? '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await authRequest<{ user: AccountUser }>('/api/auth/me', form, 'PATCH');
      setUser(data.user);
      setMsg({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-[28px] bg-sand p-7 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="details-title">
      <h2 id="details-title" className="m-0 font-serif text-[30px] font-medium">
        Delivery details
      </h2>
      <p className="mb-5 mt-1 text-sm text-muted-2">Filled in for you at checkout.</p>
      <div className="grid gap-4">
        <label className="block text-sm font-bold">
          <span className="mb-2 block">Full name</span>
          <input autoComplete="name" value={form.name} onChange={set('name')} className={inputCls} />
        </label>
        <label className="block text-sm font-bold">
          <span className="mb-2 block">Mobile number</span>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="010 1234 5678" value={form.phone} onChange={set('phone')} className={inputCls} />
        </label>
        <label className="block text-sm font-bold">
          <span className="mb-2 block">City / governorate</span>
          <input autoComplete="address-level1" value={form.city} onChange={set('city')} className={inputCls} />
        </label>
        <label className="block text-sm font-bold">
          <span className="mb-2 block">Delivery address</span>
          <textarea rows={3} autoComplete="street-address" value={form.address} onChange={set('address')} className={`${inputCls} py-3`} />
        </label>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <button type="submit" disabled={busy} className="btn btn-primary inline-flex min-h-[50px] items-center gap-2 rounded-full border-0 bg-ink px-6 text-sm font-bold text-cream disabled:opacity-60">
          {busy ? 'Saving…' : 'Save details'}
        </button>
        {msg && (
          <p role="status" className={`m-0 flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? 'text-teal-dark' : 'text-[#B3261E]'}`}>
            {msg.ok && <Check size={16} />}
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}

function Password({ user }: { user: AccountUser }) {
  const setUser = useAuth((s) => s.setUser);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setMsg({ ok: false, text: 'Use at least 8 characters for your password.' });
    setBusy(true);
    try {
      const data = await authRequest<{ user: AccountUser }>('/api/auth/me', { currentPassword: current, newPassword: next }, 'PATCH');
      setUser(data.user);
      setCurrent('');
      setNext('');
      setMsg({ ok: true, text: 'Password updated.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-[28px] bg-white p-7 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="pw-title">
      <h2 id="pw-title" className="m-0 font-serif text-[30px] font-medium">
        {user.hasPassword ? 'Change password' : 'Add a password'}
      </h2>
      <p className="mb-5 mt-1 text-sm text-muted-2">
        {user.hasPassword ? 'At least 8 characters.' : 'You sign in with Google. Add a password to also sign in with your email.'}
      </p>
      {/* Lets password managers attach the new password to the right account. */}
      <input type="email" autoComplete="username" value={user.email} readOnly hidden />
      <div className="grid gap-4">
        {user.hasPassword && (
          <label className="block text-sm font-bold">
            <span className="mb-2 block">Current password</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => (setCurrent(e.target.value), setMsg(null))} className={inputCls} />
          </label>
        )}
        <label className="block text-sm font-bold">
          <span className="mb-2 block">New password</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => (setNext(e.target.value), setMsg(null))} className={inputCls} />
        </label>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <button type="submit" disabled={busy} className="btn inline-flex min-h-[50px] items-center rounded-full border-[1.5px] border-ink bg-transparent px-6 text-sm font-bold text-ink disabled:opacity-60">
          {busy ? 'Saving…' : user.hasPassword ? 'Update password' : 'Add password'}
        </button>
        {msg && (
          <p role="status" className={`m-0 text-sm font-semibold ${msg.ok ? 'text-teal-dark' : 'text-[#B3261E]'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
