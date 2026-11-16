import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { PublicPromo } from '../lib/api-types';
import { normalisePromoCode, promoConditions, promoHeadline } from '../lib/promo';
import { forgetPromoCode, pickedPromoCode } from '../lib/promo-pick';
import { formatPrice } from '../lib/format';
import { Check, Close, Tag } from './Icons';

/** Asks the server whether a code can be used now and returns its rules. */
export async function checkPromo(code: string): Promise<{ promo?: PublicPromo; error?: string }> {
  try {
    const res = await fetch('/api/promo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => ({}))) as { promo?: PublicPromo; error?: string };
    if (res.ok && data.promo) return { promo: data.promo };
    return { error: data.error ?? 'We couldn’t check this code. Please try again.' };
  } catch {
    return { error: 'We couldn’t reach the shop to check this code. Please check your connection.' };
  }
}

interface Props {
  applied: PublicPromo | null;
  onApply: (p: PublicPromo | null) => void;
  /** Error from placing the order (e.g. "already used"), shown under the field. */
  serverError?: string;
  onClearServerError: () => void;
  subtotal: number | null;
  discount: number | null;
  /** The offer from the top bar, suggested with a one-tap "Apply". */
  suggestion: PublicPromo | null;
}

/** Promo code entry in the checkout summary: apply, see what it does, remove. */
export function PromoField({ applied, onApply, serverError, onClearServerError, subtotal, discount, suggestion }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const shownError = error || serverError || '';

  const apply = async (raw: string, quiet = false) => {
    const c = normalisePromoCode(raw);
    if (!c) {
      setError('Enter a promo code.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    onClearServerError();
    const r = await checkPromo(c);
    setBusy(false);
    if (r.promo) {
      onApply(r.promo);
      setCode('');
      setOpen(false);
    } else if (!quiet) {
      setOpen(true);
      setCode(c);
      setError(r.error ?? '');
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // A remembered code from the top bar that no longer works: forget it silently.
      forgetPromoCode();
    }
  };

  // The code picked from the top bar ("Copy") is applied automatically.
  useEffect(() => {
    const picked = pickedPromoCode();
    if (picked && !applied) void apply(picked, true);
  }, []);

  // A server refusal reopens the field so the customer can fix or remove the code.
  useEffect(() => {
    if (serverError) setOpen(true);
  }, [serverError]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void apply(code);
  };

  if (applied) {
    const refused = !!serverError;
    const short = applied.minSubtotal !== null && subtotal !== null && subtotal < applied.minSubtotal ? applied.minSubtotal - subtotal : 0;
    return (
      <div className={`mt-4 rounded-2xl border-[1.5px] border-dashed p-4 ${refused ? 'border-[#B3261E] bg-[#FDF3F2]' : 'border-teal bg-white/70'}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full ${refused ? 'bg-[#FBE0DD] text-[#B3261E]' : 'bg-teal-mist text-teal-dark'}`}>
            <Tag size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 flex flex-wrap items-center gap-x-2 text-[15px] font-bold">
              <span className={`font-mono tracking-[.1em] ${refused ? 'line-through decoration-[#B3261E]/60' : ''}`}>{applied.code}</span>
              {refused ? (
                <span className="inline-flex items-center rounded-full bg-[#FBE0DD] px-2 py-0.5 text-[12px] font-bold text-[#8C1D18]">Not applied</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-mist px-2 py-0.5 text-[12px] font-bold text-teal-dark">
                  <Check size={12} /> Applied
                </span>
              )}
            </p>
            <p className="m-0 mt-0.5 text-[13px] text-muted-2">
              {promoHeadline(applied)}
              {promoConditions(applied) && ` · ${promoConditions(applied)}`}
            </p>
            {refused ? (
              <p role="alert" className="mb-0 mt-2 text-[13px] font-semibold text-[#B3261E]">
                {serverError} Remove it to place your order without the discount.
              </p>
            ) : short > 0 ? (
              <p role="status" className="mb-0 mt-2 rounded-xl bg-[#FFF3D6] px-3 py-2 text-[13px] font-semibold text-[#6E5210]">
                Add {formatPrice(short)} more to your order to unlock this discount.
              </p>
            ) : discount === null ? (
              <p className="mb-0 mt-2 text-[13px] text-muted-2">Your discount is taken off when Coco confirms your total.</p>
            ) : discount > 0 ? (
              <p role="status" className="mb-0 mt-1 text-[13px] font-bold text-teal-dark">
                You save {formatPrice(discount)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              onApply(null);
              onClearServerError();
              forgetPromoCode();
            }}
            aria-label={`Remove code ${applied.code}`}
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border-0 bg-transparent text-muted-2 hover:bg-sand hover:text-ink"
          >
            <Close size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      {suggestion && !open && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink px-4 py-3 text-cream">
          <span className="flex items-center gap-2 text-[13px]">
            <Tag size={16} className="text-gold" />
            <span>
              <strong className="text-gold-light">{promoHeadline(suggestion)}</strong> with code{' '}
              <span className="font-mono font-bold tracking-[.1em]">{suggestion.code}</span>
            </span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply(suggestion.code)}
            className="inline-flex min-h-[36px] items-center rounded-full border-0 bg-gold px-4 text-[13px] font-bold text-ink hover:bg-gold-light disabled:opacity-60"
          >
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-expanded={false}
          className="inline-flex min-h-[44px] items-center gap-2 border-0 bg-transparent p-0 text-sm font-bold text-teal-dark underline-offset-4 hover:text-ink hover:underline"
        >
          <Tag size={16} /> Have a promo code?
        </button>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor={id} className="mb-2 block text-sm font-bold">
            Promo code
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={id}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError('');
                if (serverError) onClearServerError();
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={30}
              placeholder="e.g. EID15"
              aria-invalid={!!shownError}
              aria-describedby={shownError ? `${id}-err` : undefined}
              className={`min-h-[48px] w-full min-w-0 flex-1 rounded-2xl border-[1.5px] bg-white px-4 font-mono text-base uppercase tracking-[.08em] text-ink outline-none placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-2 focus:border-teal ${
                shownError ? 'border-[#B3261E]' : 'border-line-2'
              }`}
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[48px] flex-none items-center rounded-2xl border-0 bg-ink px-5 text-sm font-bold text-cream hover:bg-[#123F45] disabled:opacity-60"
            >
              {busy ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {shownError && (
            <p id={`${id}-err`} role="alert" className="mb-0 mt-1.5 text-[13px] font-semibold text-[#B3261E]">
              {shownError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
