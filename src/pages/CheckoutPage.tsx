import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Seo } from '../lib/seo';
import { useCart, selectCount } from '../store/cart';
import { useLive } from '../store/live';
import { resolveLine } from '../components/CartDrawer';
import { imageUrl } from '../lib/images';
import { formatPrice, plural } from '../lib/format';
import { normaliseEgyptPhone } from '../lib/phone';
import type { CreateOrderInput, PaymentMethod } from '../lib/api-types';
import { ArrowRight } from '../components/Icons';

const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Gharbia', 'Monufia', 'Beheira',
  'Kafr El Sheikh', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'North Sinai', 'South Sinai', 'Faiyum',
  'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh',
];

interface Form {
  name: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
}
type Errors = Partial<Record<keyof Form | 'payment' | 'form', string>>;

const SAVED_KEY = 'coco-customer';

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!normaliseEgyptPhone(f.phone)) e.phone = 'Enter an Egyptian mobile number, e.g. 010 1234 5678.';
  if (f.city.trim().length < 2) e.city = 'Please enter your city or governorate.';
  if (f.address.trim().length < 6) e.address = 'Please enter a delivery address.';
  return e;
}

const inputCls = (bad?: string) =>
  `min-h-[52px] w-full rounded-2xl border-[1.5px] bg-white px-4 text-base text-ink outline-none placeholder:text-muted-2 focus:border-teal ${
    bad ? 'border-[#B3261E]' : 'border-line-2'
  }`;

export function CheckoutPage() {
  const navigate = useNavigate();
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const count = useCart(selectCount);
  const clear = useCart((s) => s.clear);
  const overrides = useLive((s) => s.overrides);
  const payment = useLive((s) => s.payment);
  const [form, setForm] = useState<Form>({ name: '', phone: '', city: '', address: '', notes: '' });
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  // Prefill details from this browser's last order (stays on this device only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null') as Partial<Form> | null;
      if (saved) setForm((f) => ({ ...f, ...saved, notes: '' }));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const items = lines.map((l) => resolveLine(l, overrides)).filter((x): x is NonNullable<ReturnType<typeof resolveLine>> => !!x);
  const allPriced = items.length > 0 && items.every((i) => i.unitPrice !== null);
  const subtotal = allPriced ? items.reduce((t, i) => t + (i.unitPrice ?? 0) * i.line.qty, 0) : null;
  const deliveryFee = payment?.deliveryFee ?? null;
  const total = subtotal !== null && deliveryFee !== null ? subtotal + deliveryFee : null;
  const blocked = items.some((i) => i.unavailable);

  const methods: { id: PaymentMethod; title: string; desc: string }[] = [
    { id: 'cod', title: 'Cash on delivery', desc: 'Pay in cash when your order arrives.' },
    ...(payment?.instapay
      ? [{ id: 'instapay' as const, title: 'InstaPay', desc: 'Transfer once Coco confirms your total, then upload the screenshot.' }]
      : []),
    ...(payment?.wallet
      ? [{ id: 'wallet' as const, title: payment.walletName || 'Mobile wallet', desc: 'Transfer once Coco confirms your total, then upload the screenshot.' }]
      : []),
  ];
  useEffect(() => {
    if (!methods.some((m) => m.id === method)) setMethod('cod');
  }, [methods, method]);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const errs = validate(form);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`co-${first}`)?.focus();
      return;
    }
    const honeypot = (e.currentTarget.elements.namedItem('website') as HTMLInputElement | null)?.value ?? '';
    const body: CreateOrderInput = {
      items: items.map((i) => ({
        productId: i.product.id,
        variantId: i.line.variantId,
        qty: i.line.qty,
        ...(i.line.personalisation ? { personalisation: i.line.personalisation } : {}),
      })),
      customer: { name: form.name, phone: form.phone, city: form.city, address: form.address, notes: form.notes },
      paymentMethod: method,
      website: honeypot,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { number?: string; token?: string; error?: string; code?: string };
      if (!res.ok || !data.number || !data.token) {
        const code = data.code as keyof Form | undefined;
        if (code && ['name', 'phone', 'city', 'address'].includes(code)) {
          setErrors({ [code]: data.error });
          document.getElementById(`co-${code}`)?.focus();
        } else {
          setErrors({ form: data.error ?? 'We could not place your order. Please check your connection and try again.' });
        }
        if (res.status === 409) void useLive.getState().load(true);
        return;
      }
      try {
        const { notes: _omit, ...keep } = form;
        void _omit;
        localStorage.setItem(SAVED_KEY, JSON.stringify(keep));
      } catch {
        /* storage unavailable */
      }
      clear();
      navigate(`/order/${data.number}?t=${encodeURIComponent(data.token)}`, { replace: true, state: { placed: true } });
    } catch {
      setErrors({ form: 'We could not reach the shop. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const seo = <Seo title="Checkout" path="/checkout" noindex />;

  if (!hydrated) {
    return (
      <>
        {seo}
        <section className="container-page min-h-[60vh] pb-28 pt-10" aria-busy="true">
          <h1 className="m-0 font-serif text-[clamp(40px,6vw,72px)] font-medium leading-none">Checkout</h1>
        </section>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {seo}
        <section className="container-page pb-28 pt-10 text-center">
          <h1 className="m-0 font-serif text-[clamp(40px,6vw,72px)] font-medium leading-none">
            Your cart is <em>empty.</em>
          </h1>
          <p className="mt-4 text-muted-2">Find something handmade you'll love.</p>
          <Link to="/shop" className="btn btn-primary mt-6 inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-teal-btn px-7 font-bold text-white no-underline hover:text-white">
            Browse the shop <ArrowRight />
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      {seo}
      <section className="container-page pb-6 pt-4">
        <p className="eyebrow mb-3">Checkout</p>
        <h1 className="m-0 font-serif text-[clamp(40px,6vw,76px)] font-medium leading-[.95] tracking-[-.02em]">
          Almost <em>yours.</em>
        </h1>
        <p className="mt-4 max-w-[600px] text-[17px] leading-[1.65] text-muted">
          Place your order here — Coco reviews every handmade piece and confirms your total and delivery before anything is charged.
        </p>
      </section>

      <div className="container-page grid items-start gap-10 pb-28 min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6" aria-labelledby="details-title">
          <div className="rounded-[28px] bg-white p-8 max-[560px]:rounded-[22px] max-[560px]:p-5">
            <h2 id="details-title" className="m-0 font-serif text-[34px] font-medium">
              Delivery details
            </h2>
            <p className="mb-6 mt-1 text-sm text-muted-2">Delivery across Egypt. Coco will call or WhatsApp you on this number.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="name" label="Full name" error={errors.name}>
                <input id="co-name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'co-name-err' : undefined} className={inputCls(errors.name)} />
              </Field>
              <Field id="phone" label="Mobile number" error={errors.phone}>
                <input id="co-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010 1234 5678" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'co-phone-err' : undefined} className={inputCls(errors.phone)} />
              </Field>
              <Field id="city" label="City / governorate" error={errors.city} className="sm:col-span-2">
                <input id="co-city" list="governorates" autoComplete="address-level1" value={form.city} onChange={set('city')} aria-invalid={!!errors.city} aria-describedby={errors.city ? 'co-city-err' : undefined} className={inputCls(errors.city)} />
                <datalist id="governorates">
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Field>
              <Field id="address" label="Delivery address" error={errors.address} className="sm:col-span-2">
                <textarea id="co-address" rows={3} autoComplete="street-address" placeholder="Street, building, floor, apartment, landmark" value={form.address} onChange={set('address')} aria-invalid={!!errors.address} aria-describedby={errors.address ? 'co-address-err' : undefined} className={`${inputCls(errors.address)} py-3`} />
              </Field>
              <Field id="notes" label="Notes (optional)" className="sm:col-span-2">
                <textarea id="co-notes" rows={3} placeholder="Gift wrapping, delivery date, colours…" value={form.notes} onChange={set('notes')} className={`${inputCls()} py-3`} />
              </Field>
            </div>
            {/* Honeypot: hidden from people, filled in by bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="co-website">Website</label>
              <input id="co-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
          </div>

          <fieldset className="m-0 rounded-[28px] border-0 bg-white p-8 max-[560px]:rounded-[22px] max-[560px]:p-5">
            <legend className="float-left mb-4 w-full p-0 font-serif text-[34px] font-medium">Payment</legend>
            <div className="clear-both grid gap-3">
              {methods.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal ${
                    method === m.id ? 'border-ink bg-cream' : 'border-line-2 hover:border-teal'
                  }`}
                >
                  <input type="radio" name="payment" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 h-5 w-5 flex-none accent-[#0B2E33]" />
                  <span>
                    <strong className="block text-base">{m.title}</strong>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-2">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mb-0 mt-4 text-[13px] text-muted-2">Nothing is charged now. You'll get an order page to track your order{method !== 'cod' ? ' and upload your transfer screenshot' : ''}.</p>
          </fieldset>

          {errors.form && (
            <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-5 py-4 text-sm font-semibold text-[#7A1F1F]">
              {errors.form}
            </p>
          )}
          {blocked && (
            <p role="alert" className="m-0 rounded-2xl bg-[#FBEAEA] px-5 py-4 text-sm font-semibold text-[#7A1F1F]">
              Something in your cart is sold out or no longer available. Please remove it to continue.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || blocked}
            className="btn btn-primary inline-flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-full border-0 bg-teal-btn text-base font-bold text-white disabled:opacity-60"
          >
            {submitting ? 'Placing your order…' : 'Place order'} {!submitting && <ArrowRight />}
          </button>
        </form>

        <aside className="rounded-[28px] bg-sand p-7 min-[900px]:sticky min-[900px]:top-6 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="summary-title">
          <h2 id="summary-title" className="m-0 font-serif text-[30px] font-medium">
            Order summary <span className="font-sans text-[15px] font-bold text-muted-2">({plural(count, 'item')})</span>
          </h2>
          <ul className="m-0 mt-3 list-none p-0">
            {items.map(({ line, product, variantLabel, image, unitPrice, unavailable }) => (
              <li key={line.key} className="flex items-center gap-3.5 border-b border-line py-3.5 last:border-0">
                <span className="relative flex-none">
                  <img src={imageUrl(image, 320)} alt="" width={64} height={64} className="h-16 w-16 rounded-xl object-cover" />
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-bold text-cream">{line.qty}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-[15px] leading-snug">{product.name}</strong>
                  {variantLabel && <span className="text-[13px] text-muted-2">{variantLabel}</span>}
                  {line.personalisation && <span className="text-[13px] text-muted-2">Name: “{line.personalisation}”</span>}
                  {unavailable && <span className="text-[13px] font-bold text-[#9B1C1C]">No longer available</span>}
                </span>
                <span className="text-right text-[13px] font-bold text-price">{unitPrice !== null ? formatPrice(unitPrice * line.qty) : formatPrice(null)}</span>
              </li>
            ))}
          </ul>
          <dl className="m-0 mt-4 grid grid-cols-[1fr_auto] gap-y-2 border-t border-line pt-4 text-sm">
            <dt className="font-bold">Subtotal</dt>
            <dd className="m-0 text-right font-bold text-price">{formatPrice(subtotal)}</dd>
            <dt className="text-muted-2">Delivery</dt>
            <dd className="m-0 text-right text-muted-2">{deliveryFee !== null ? formatPrice(deliveryFee) : 'Confirmed by Coco'}</dd>
            <dt className="mt-2 border-t border-line pt-3 text-base font-bold">Total</dt>
            <dd className="m-0 mt-2 border-t border-line pt-3 text-right text-base font-bold">{total !== null ? formatPrice(total) : 'Confirmed by Coco'}</dd>
          </dl>
          {payment?.deliveryNote && <p className="mb-0 mt-3 text-[13px] text-muted-2">{payment.deliveryNote}</p>}
        </aside>
      </div>
    </>
  );
}

function Field({ id, label, error, className = '', children }: { id: string; label: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={`co-${id}`} className="mb-2 block text-sm font-bold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`co-${id}-err`} className="mb-0 mt-1.5 text-[13px] font-semibold text-[#B3261E]">
          {error}
        </p>
      )}
    </div>
  );
}
