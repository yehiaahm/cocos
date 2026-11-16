import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useLive } from '../store/live';
import { promoConditions, promoHeadline } from '../lib/promo';
import { dismissPromo, isPromoDismissed, rememberPromoCode, timeLeft } from '../lib/promo-pick';
import { Check, Close, Copy, Tag } from './Icons';

/** A countdown is shown only for the last week of an offer; it ticks every second in the last day. */
const COUNTDOWN_FROM = 7 * 86_400_000;

function useCountdown(endsAt: string | null): string | null | undefined {
  const [now, setNow] = useState(() => Date.now());
  const left = endsAt ? timeLeft(endsAt, now) : undefined;
  const fast = !!left && left.ms < 86_400_000;
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [endsAt, fast]);
  // undefined = no end date · null = ended · string = time left
  if (!endsAt) return undefined;
  if (!left) return null;
  return left.ms <= COUNTDOWN_FROM ? left.label : undefined;
}

/**
 * The offer bar at the very top of every page: the promo code the owner chose in the dashboard
 * (Offers → "Show in the top bar"), with one-tap copy. The copied code is also applied at checkout.
 */
export function PromoBar() {
  const promo = useLive((s) => s.promo);
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(true);
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown(promo?.endsAt ?? null);

  // Read after mount: prerendered HTML has no bar, and storage is per device.
  useEffect(() => setDismissed(promo ? isPromoDismissed(promo.code) : true), [promo]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  if (!promo || dismissed || countdown === null) return null;

  const headline = promoHeadline(promo);
  const conditions = promoConditions(promo);
  const custom = promo.bannerText.trim();

  const copy = async () => {
    rememberPromoCode(promo.code);
    try {
      await navigator.clipboard.writeText(promo.code);
    } catch {
      /* clipboard blocked — the code is still applied at checkout */
    }
    setCopied(true);
  };

  return (
    <aside aria-label="Current offer" className="promo-bar on-dark relative z-30 overflow-hidden bg-ink text-cream">
      <span aria-hidden="true" className="promo-bar-sheen pointer-events-none absolute inset-0" />
      <div className="container-page relative flex min-h-[48px] items-center justify-center gap-x-4 gap-y-1.5 py-2 pe-12 text-[14px] max-[640px]:flex-wrap max-[640px]:gap-x-2.5 max-[640px]:text-[13px] max-[640px]:pe-10">
        <p className="m-0 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center leading-snug">
          <Tag size={16} className="flex-none text-gold max-[640px]:hidden" />
          {custom ? (
            <strong className="font-bold text-gold-light">{custom}</strong>
          ) : (
            <>
              <strong className="font-extrabold tracking-[.01em] text-gold-light">{headline}</strong>
              {conditions && <span className="text-cream/80">{conditions}</span>}
            </>
          )}
        </p>

        <button
          type="button"
          onClick={() => void copy()}
          className="group inline-flex min-h-[34px] flex-none items-center gap-2 rounded-full border-[1.5px] border-dashed border-gold/80 bg-white/5 py-1 pe-1 ps-3 font-bold text-cream transition-colors hover:border-gold hover:bg-white/10"
          aria-label={copied ? `Code ${promo.code} copied — it will be applied at checkout` : `Copy code ${promo.code}`}
        >
          <span className="font-mono text-[14px] tracking-[.12em] text-gold-light">{promo.code}</span>
          <span className="inline-flex min-h-[26px] items-center gap-1 rounded-full bg-gold px-2.5 text-[12px] text-ink">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>

        {countdown && (
          <span className="inline-flex flex-none items-center gap-1.5 text-[13px] text-cream/80 max-[640px]:text-[12px]">
            Ends in <span className="font-mono font-bold tabular-nums text-cream">{countdown}</span>
          </span>
        )}

        {pathname !== '/checkout' && !pathname.startsWith('/shop') && (
          <Link to="/shop" className="flex-none font-bold text-teal-pale underline-offset-4 hover:text-white hover:underline max-[900px]:hidden">
            Shop now →
          </Link>
        )}

        <span role="status" className="sr-only">
          {copied ? `Code ${promo.code} copied. It will be applied at checkout.` : ''}
        </span>

        <button
          type="button"
          onClick={() => {
            dismissPromo(promo.code);
            setDismissed(true);
          }}
          aria-label="Hide this offer"
          className="absolute end-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent text-cream/70 hover:bg-white/10 hover:text-cream max-[560px]:end-1.5"
        >
          <Close size={16} />
        </button>
      </div>
    </aside>
  );
}
