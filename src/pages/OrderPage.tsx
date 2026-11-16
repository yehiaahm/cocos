import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { Seo } from '../lib/seo';
import { imageUrl } from '../lib/images';
import { dayTime, formatPrice, timeAgo } from '../lib/format';
import { ORDER_STEPS as STEPS } from '../lib/order-status';
import { useMyOrders } from '../store/myOrders';
import { contactLink, site } from '../config/site';
import type { PaymentSettings, PublicOrder } from '../lib/api-types';
import { launchPayment, paymentLaunchUrl, type PaymentTarget } from '../lib/payment-apps';
import { ArrowRight, Check, Copy, Instagram, Package, Truck, WhatsApp } from '../components/Icons';

/** Shrinks phone screenshots before upload (max 1600px JPEG) — faster on mobile data. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (blob && blob.size < file.size) return blob;
  } catch {
    /* fall back to the original */
  }
  return file;
}

function CopyButton({ text, label, cta = 'Copy' }: { text: string; label: string; cta?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-4 text-sm font-bold text-ink hover:border-ink"
      aria-label={`Copy ${label}`}
    >
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? 'Copied' : cta}
    </button>
  );
}

export function OrderPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const placed = !!(useLocation().state as { placed?: boolean } | null)?.placed;
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'missing'; order?: PublicOrder; payment?: PaymentSettings }>({
    status: 'loading',
  });
  const [upload, setUpload] = useState<{ status: 'idle' | 'uploading' | 'done' | 'error'; message?: string }>({ status: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(number)}?t=${encodeURIComponent(token)}`);
      if (res.status === 404) return setState({ status: 'missing' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { order: PublicOrder; payment: PaymentSettings };
      setState({ status: 'ready', order: data.order, payment: data.payment });
    } catch {
      setState((s) => (s.order ? s : { status: 'error' }));
    }
  }, [number, token]);

  useEffect(() => {
    void load();
    const onFocus = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [load]);

  // A valid link is remembered on this device (so it shows under "My orders" and in the header), and
  // an order that is still going refreshes itself while the page is open.
  const loaded = state.status === 'ready';
  const finished = state.order?.status === 'delivered' || state.order?.status === 'cancelled';
  useEffect(() => {
    if (loaded && token) useMyOrders.getState().save(number, token);
  }, [loaded, number, token]);
  useEffect(() => {
    if (!loaded || finished) return;
    const id = window.setInterval(() => document.visibilityState === 'visible' && void load(), 45_000);
    return () => window.clearInterval(id);
  }, [loaded, finished, load]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return setUpload({ status: 'error', message: 'Please choose an image (screenshot or photo).' });
    setUpload({ status: 'uploading' });
    try {
      const blob = await compress(file);
      const fd = new FormData();
      fd.append('file', blob, 'transfer.jpg');
      const res = await fetch(`/api/orders/${encodeURIComponent(number)}/proof?t=${encodeURIComponent(token)}`, { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed. Please try again.');
      setUpload({ status: 'done' });
      void load();
    } catch (e) {
      setUpload({ status: 'error', message: e instanceof Error ? e.message : 'Upload failed. Please try again.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const seo = <Seo title={`Order ${number}`} path={`/order/${number}`} noindex />;

  if (state.status === 'loading') {
    return (
      <>
        {seo}
        <section className="container-page min-h-[60vh] pb-28 pt-10" aria-busy="true">
          <div className="skel h-12 w-72 rounded-xl" />
          <div className="skel mt-6 h-40 max-w-[760px] rounded-[28px]" />
        </section>
      </>
    );
  }

  if (state.status === 'missing' || state.status === 'error' || !state.order) {
    return (
      <>
        {seo}
        <section className="container-page pb-28 pt-10 text-center">
          <h1 className="m-0 font-serif text-[clamp(38px,5vw,64px)] font-medium leading-none">
            {state.status === 'missing' ? (
              <>
                We can't find <em>this order.</em>
              </>
            ) : (
              <>
                Couldn't load <em>your order.</em>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-[460px] text-muted-2">
            {state.status === 'missing' ? 'Please use the full link from your confirmation, or message Coco with your order number.' : 'Please check your connection and refresh the page.'}
          </p>
          <Link to="/shop" className="btn btn-primary mt-6 inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-teal-btn px-7 font-bold text-white no-underline hover:text-white">
            Back to the shop <ArrowRight />
          </Link>
        </section>
      </>
    );
  }

  const o = state.order;
  const pay = state.payment;
  const payTarget: PaymentTarget & { instapay?: string } = {
    method: o.paymentMethod,
    walletName: pay?.walletName,
    wallet: pay?.wallet,
    instapay: pay?.instapay,
    instapayLink: pay?.instapayLink,
    total: o.total,
  };
  // The order loads client-side, so reading the device here is safe. On desktop there's no app to open.
  const canOpenApp = typeof navigator !== 'undefined' && !!paymentLaunchUrl(payTarget, navigator.userAgent, navigator.maxTouchPoints);
  const stepIndex = STEPS.findIndex((s) => s.id === o.status);
  const transfer = o.paymentMethod !== 'cod';
  const ask = contactLink(`Hi Coco! About my order ${o.number}.`);
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      {seo}
      <section className="container-page pb-8 pt-4">
        {placed && (
          <p className="rise d1 mb-5 inline-flex items-center gap-2 rounded-full bg-teal-mist px-4 py-2 text-sm font-bold text-teal-dark">
            <Check size={16} /> Order placed — thank you!
          </p>
        )}
        <p className="eyebrow mb-3">Order {o.number}</p>
        <h1 className="m-0 font-serif text-[clamp(38px,5.5vw,72px)] font-medium leading-[.95] tracking-[-.02em]">
          {o.status === 'cancelled' ? (
            <>
              This order was <em>cancelled.</em>
            </>
          ) : (
            <>
              Thank you, <em>{o.customerName.split(/\s+/)[0]}.</em>
            </>
          )}
        </h1>
        <p className="mt-4 max-w-[620px] text-[17px] leading-[1.65] text-muted">
          {o.status === 'new'
            ? 'Coco will call or WhatsApp you shortly to confirm your total and delivery.'
            : o.status === 'cancelled'
              ? 'If this is unexpected, please message Coco.'
              : 'Here is where your handmade order stands.'}{' '}
          This order is saved on this device. Open <Link to="/orders">My orders</Link> any time to see where it is.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <CopyButton text={pageUrl} label="order link" cta="Copy order link" />
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`My Coco's Resin Art order ${o.number} — track it here:
${pageUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 text-sm font-bold text-ink no-underline hover:border-ink hover:text-ink"
          >
            <WhatsApp size={16} /> Save link on WhatsApp
          </a>
          <Link to="/orders" className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 text-sm font-bold text-ink no-underline hover:border-ink hover:text-ink">
            <Package size={16} /> All my orders
          </Link>
          <a href={ask.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 text-sm font-bold text-ink no-underline hover:border-ink hover:text-ink">
            {ask.channel === 'whatsapp' ? <WhatsApp size={16} /> : <Instagram size={16} />} Message Coco
          </a>
        </div>
      </section>

      <div className="container-page grid items-start gap-8 pb-28 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {o.status !== 'cancelled' && (
            <section className="rounded-[28px] bg-white p-7 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="track-title">
              <h2 id="track-title" className="m-0 font-serif text-[30px] font-medium">
                Order status
              </h2>
              <ol className="m-0 mt-5 list-none p-0">
                {STEPS.map((s, i) => {
                  const done = i < stepIndex;
                  const current = i === stepIndex;
                  return (
                    <li key={s.id} className="relative flex gap-4 pb-5 last:pb-0" aria-current={current ? 'step' : undefined}>
                      {i < STEPS.length - 1 && (
                        <span aria-hidden="true" className={`absolute left-[15px] top-8 h-[calc(100%-24px)] w-0.5 ${done ? 'bg-teal' : 'bg-line'}`} />
                      )}
                      <span
                        aria-hidden="true"
                        className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold ${
                          done ? 'bg-teal text-white' : current ? 'bg-ink text-cream ring-4 ring-teal-mist' : 'bg-cream text-muted-2'
                        }`}
                      >
                        {done ? <Check size={15} /> : i + 1}
                      </span>
                      <span className="pt-1">
                        <strong className={`block text-[15px] ${!done && !current ? 'text-muted-2' : ''}`}>{s.label}</strong>
                        <span className="text-[13px] text-muted-2">{s.hint}</span>
                        {(done || current) && o.statusDates?.[s.id] && (
                          <span className="mt-0.5 block text-[12px] font-semibold text-teal-dark">{dayTime(o.statusDates[s.id]!)}</span>
                        )}
                        {s.id === 'shipped' && (done || current) && (o.trackingNumber || o.courier) && (
                          <span className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-cream px-3.5 py-2.5 text-[13px]">
                            <Truck size={16} />
                            <span>
                              {o.courier && <strong>{o.courier}</strong>}
                              {o.courier && o.trackingNumber ? ' · ' : ''}
                              {o.trackingNumber && (
                                <span dir="ltr" className="font-semibold">
                                  {o.trackingNumber}
                                </span>
                              )}
                            </span>
                            {o.trackingNumber && <CopyButton text={o.trackingNumber} label="tracking number" />}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mb-0 mt-5 text-[12px] text-muted-2">Last updated {timeAgo(o.updatedAt)}. This page refreshes by itself.</p>
            </section>
          )}

          {o.status !== 'cancelled' && (
            <section className="rounded-[28px] bg-white p-7 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="pay-title">
              <h2 id="pay-title" className="m-0 font-serif text-[30px] font-medium">
                Payment
              </h2>
              {o.paymentStatus === 'paid' ? (
                <p className="mb-0 mt-3 inline-flex items-center gap-2 rounded-full bg-teal-mist px-4 py-2 text-sm font-bold text-teal-dark">
                  <Check size={16} /> Payment received — thank you!
                </p>
              ) : !transfer ? (
                <p className="mb-0 mt-3 text-[15px] leading-relaxed text-muted">
                  Cash on delivery — pay {o.total !== null ? <strong className="text-ink">{formatPrice(o.total)}</strong> : 'your confirmed total'} when your order arrives.
                </p>
              ) : (
                <>
                  <p className="mb-0 mt-3 text-[15px] leading-relaxed text-muted">
                    {o.total !== null ? (
                      <>
                        Transfer <strong className="text-ink">{formatPrice(o.total)}</strong>, then upload a screenshot of the transfer below.
                      </>
                    ) : (
                      <>Please wait until Coco confirms your total, then transfer it and upload a screenshot here.</>
                    )}
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    {o.paymentMethod === 'instapay' && pay?.instapay && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
                        <span>
                          <span className="block text-xs font-bold uppercase tracking-[.14em] text-muted-2">InstaPay</span>
                          <strong className="text-lg" dir="ltr">
                            {pay.instapay}
                          </strong>
                        </span>
                        <CopyButton text={pay.instapay} label="InstaPay address" />
                      </div>
                    )}
                    {o.paymentMethod === 'wallet' && pay?.wallet && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
                        <span>
                          <span className="block text-xs font-bold uppercase tracking-[.14em] text-muted-2">{pay.walletName || 'Wallet'}</span>
                          <strong className="text-lg" dir="ltr">
                            {pay.wallet}
                          </strong>
                        </span>
                        <CopyButton text={pay.wallet} label="wallet number" />
                      </div>
                    )}
                  </div>

                  {o.total !== null && canOpenApp && (
                    <button
                      type="button"
                      onClick={() => launchPayment(payTarget)}
                      className="btn btn-primary mt-4 inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-teal-btn px-7 font-bold text-white"
                    >
                      {o.paymentMethod === 'instapay' ? 'Open InstaPay' : `Pay ${formatPrice(o.total)} with ${pay?.walletName || 'Vodafone Cash'}`} <ArrowRight />
                    </button>
                  )}

                  {o.paymentStatus === 'pending_review' || upload.status === 'done' ? (
                    <p role="status" className="mb-0 mt-5 rounded-2xl bg-teal-mist px-4 py-3 text-sm font-bold text-teal-dark">
                      Screenshot received — Coco will confirm your payment shortly. You can upload a new one if needed.
                    </p>
                  ) : null}
                  <div className="mt-5">
                    <input ref={fileRef} id="proof" type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
                    <label
                      htmlFor="proof"
                      className={`btn btn-primary inline-flex min-h-[54px] cursor-pointer items-center gap-2.5 rounded-full bg-teal-btn px-7 font-bold text-white ${
                        upload.status === 'uploading' ? 'pointer-events-none opacity-60' : ''
                      }`}
                    >
                      {upload.status === 'uploading' ? 'Uploading…' : o.hasProof ? 'Upload a new screenshot' : 'Upload transfer screenshot'}
                    </label>
                    {upload.status === 'error' && (
                      <p role="alert" className="mb-0 mt-2 text-sm font-semibold text-[#B3261E]">
                        {upload.message}
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="rounded-[28px] bg-sand p-7 min-[900px]:sticky min-[900px]:top-6 max-[560px]:rounded-[22px] max-[560px]:p-5" aria-labelledby="items-title">
          <h2 id="items-title" className="m-0 font-serif text-[30px] font-medium">
            Your order
          </h2>
          <ul className="m-0 mt-3 list-none p-0">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3.5 border-b border-line py-3.5 last:border-0">
                <span className="relative flex-none">
                  {i.image && <img src={imageUrl(i.image, 320)} alt="" width={64} height={64} className="h-16 w-16 rounded-xl object-cover" />}
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-bold text-cream">{i.qty}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-[15px] leading-snug">{i.name}</strong>
                  {i.variantName && <span className="text-[13px] text-muted-2">{i.variantName}</span>}
                  {i.personalisation && <span className="text-[13px] text-muted-2">Name: “{i.personalisation}”</span>}
                </span>
                <span className="text-right text-[13px] font-bold text-price">{i.unitPrice !== null ? formatPrice(i.unitPrice * i.qty) : formatPrice(null)}</span>
              </li>
            ))}
          </ul>
          <dl className="m-0 mt-4 grid grid-cols-[1fr_auto] gap-y-2 border-t border-line pt-4 text-sm">
            <dt className="font-bold">Subtotal</dt>
            <dd className="m-0 text-right font-bold text-price">{formatPrice(o.subtotal)}</dd>
            <dt className="text-muted-2">Delivery</dt>
            <dd className="m-0 text-right text-muted-2">{o.deliveryFee !== null ? formatPrice(o.deliveryFee) : 'Confirmed by Coco'}</dd>
            <dt className="mt-2 border-t border-line pt-3 text-base font-bold">Total</dt>
            <dd className="m-0 mt-2 border-t border-line pt-3 text-right text-base font-bold">{o.total !== null ? formatPrice(o.total) : 'Confirmed by Coco'}</dd>
          </dl>
          <p className="mb-0 mt-4 text-[13px] text-muted-2">
            Delivering to {o.city}. Questions? <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">@{site.instagramHandle}</a>
          </p>
        </aside>
      </div>
    </>
  );
}
