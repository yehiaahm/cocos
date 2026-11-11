import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Seo } from '../lib/seo';
import { useCart, selectCount } from '../store/cart';
import { resolveLine } from '../components/CartDrawer';
import { imageUrl } from '../lib/images';
import { formatPrice, plural } from '../lib/format';
import { contactLink, hasWhatsApp, site } from '../config/site';
import { ArrowRight, Check, Copy, Instagram, WhatsApp } from '../components/Icons';

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
type Errors = Partial<Record<keyof Form, string>>;

/** Egyptian mobile (01x xxxx xxxx), with or without +20 / 0020, spaces or dashes. */
export function normaliseEgyptPhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0020')) d = d.slice(2);
  if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2);
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}

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
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const count = useCart(selectCount);
  const clear = useCart((s) => s.clear);
  const [form, setForm] = useState<Form>({ name: '', phone: '', city: '', address: '', notes: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState<{ ref: string; message: string; href: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const items = lines.map(resolveLine).filter((x): x is NonNullable<ReturnType<typeof resolveLine>> => !!x);
  const allPriced = items.length > 0 && items.every((i) => i.unitPrice !== null);
  const subtotal = allPriced ? items.reduce((t, i) => t + (i.unitPrice ?? 0) * i.line.qty, 0) : null;

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`co-${first}`)?.focus();
      return;
    }
    const ref = `CA-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const message = [
      `New order ${ref} — ${site.name}`,
      '',
      ...items.map(
        (i) =>
          `• ${i.line.qty} × ${i.product.name}${i.variantLabel ? ` (${i.variantLabel})` : ''}${i.line.personalisation ? ` — name: "${i.line.personalisation}"` : ''} [${i.variant.catalogId}]`,
      ),
      '',
      `Subtotal: ${formatPrice(subtotal)}`,
      '',
      `Name: ${form.name.trim()}`,
      `Phone: ${normaliseEgyptPhone(form.phone)}`,
      `City: ${form.city.trim()}`,
      `Address: ${form.address.trim()}`,
      form.notes.trim() ? `Notes: ${form.notes.trim()}` : '',
    ]
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n')
      .trim();
    const link = contactLink(message);
    if (link.channel === 'whatsapp') window.open(link.href, '_blank', 'noopener');
    else await copy(message);
    setSent({ ref, message, href: link.href });
    clear();
    window.scrollTo(0, 0);
  };

  const seo = <Seo title="Checkout" path="/checkout" noindex />;

  if (sent) {
    return (
      <>
        {seo}
        <section className="container-page max-w-[760px] pb-28 pt-10 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-btn text-white">
            <Check size={30} />
          </span>
          <h1 className="mb-0 mt-6 font-serif text-[clamp(40px,6vw,72px)] font-medium leading-none">
            Thank you, <em>{form.name.trim().split(/\s+/)[0]}.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.7] text-muted">
            {hasWhatsApp
              ? 'Your order is ready in WhatsApp — press send, and Coco will reply to confirm your total and delivery.'
              : `Your order details are copied. Send them to Coco on Instagram (@${site.instagramHandle}) — Coco will confirm your total and delivery.`}
          </p>
          <p className="mt-2 text-sm font-bold text-muted-2">Order reference: {sent.ref}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={sent.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-teal-btn px-7 font-bold text-white no-underline hover:text-white">
              {hasWhatsApp ? <WhatsApp /> : <Instagram />}
              {hasWhatsApp ? 'Open WhatsApp again' : 'Open Instagram'}
            </a>
            <button type="button" onClick={() => copy(sent.message)} className="btn btn-ghost inline-flex min-h-[54px] items-center gap-2.5 rounded-full border-[1.5px] border-ink bg-transparent px-7 font-bold text-ink">
              {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy order details'}
            </button>
          </div>
          <pre className="mx-auto mt-8 max-w-[520px] whitespace-pre-wrap rounded-[22px] bg-white p-6 text-left font-sans text-sm leading-relaxed text-muted">{sent.message}</pre>
          <Link to="/shop" className="mt-8 inline-flex min-h-11 items-center font-bold">
            Continue shopping →
          </Link>
        </section>
      </>
    );
  }

  if (!hydrated) {
    return (
      <>
        {seo}
        <section className="container-page min-h-[50vh] pb-28 pt-10" aria-busy="true">
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
          Prices are being finalised, so there's no payment yet. Send us your order and Coco will confirm your total, delivery fee and payment method (card, wallet or cash on delivery).
        </p>
      </section>

      <div className="container-page grid items-start gap-10 pb-28 min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="rounded-[28px] bg-white p-8 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="details-title">
          <h2 id="details-title" className="m-0 font-serif text-[34px] font-medium">
            Your details
          </h2>
          <p className="mb-6 mt-1 text-sm text-muted-2">Coco will confirm your total before payment. Delivery across Egypt.</p>
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
          <button type="submit" className="btn btn-primary mt-7 inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full border-0 bg-teal-btn text-base font-bold text-white">
            {hasWhatsApp ? <WhatsApp /> : <ArrowRight />}
            {hasWhatsApp ? 'Send order on WhatsApp' : 'Send order to Coco'}
          </button>
          <p className="mb-0 mt-3 text-center text-[13px] text-muted-2">
            {hasWhatsApp ? 'Opens WhatsApp with your order filled in. Nothing is charged now.' : `Copies your order so you can send it to @${site.instagramHandle} on Instagram. Nothing is charged now.`}
          </p>
        </form>

        <aside className="rounded-[28px] bg-sand p-7 min-[900px]:sticky min-[900px]:top-6 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="summary-title">
          <h2 id="summary-title" className="m-0 font-serif text-[30px] font-medium">
            Order summary <span className="font-sans text-[15px] font-bold text-muted-2">({plural(count, 'item')})</span>
          </h2>
          <ul className="m-0 mt-3 list-none p-0">
            {items.map(({ line, product, variantLabel, image, unitPrice }) => (
              <li key={line.key} className="flex items-center gap-3.5 border-b border-line py-3.5 last:border-0">
                <span className="relative flex-none">
                  <img src={imageUrl(image, 320)} alt="" width={64} height={64} className="h-16 w-16 rounded-xl object-cover" />
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-bold text-cream">{line.qty}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-[15px] leading-snug">{product.name}</strong>
                  {variantLabel && <span className="text-[13px] text-muted-2">{variantLabel}</span>}
                  {line.personalisation && <span className="text-[13px] text-muted-2">Name: “{line.personalisation}”</span>}
                </span>
                <span className="text-[13px] font-bold text-price">{formatPrice(unitPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-line pt-4 font-bold">
            <span>Subtotal</span>
            <span className="text-price">{formatPrice(subtotal)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm text-muted-2">
            <span>Delivery</span>
            <span>Confirmed by Coco</span>
          </div>
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
