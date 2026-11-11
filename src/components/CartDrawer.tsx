import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useCart, selectCount, MAX_QTY, type CartLine } from '../store/cart';
import { useUi } from '../store/ui';
import { getProductById, getVariant } from '../data/catalog';
import { imageUrl } from '../lib/images';
import { formatPrice } from '../lib/format';
import { liveFor, useLive } from '../store/live';
import type { CatalogOverrides } from '../lib/api-types';
import { ArrowRight, Close } from './Icons';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/** Resolve a cart line against the catalog and live dashboard data (names, photos, prices, stock). */
export function resolveLine(l: CartLine, overrides: CatalogOverrides = {}) {
  const p = getProductById(l.productId);
  if (!p) return null;
  const v = getVariant(p, l.variantId);
  const live = liveFor(overrides, p);
  return {
    line: l,
    product: p,
    variant: v,
    image: v.images[0] ?? p.image,
    variantLabel: p.variants.length > 1 ? v.name : null,
    unitPrice: live.price,
    unavailable: live.hidden || live.soldOut,
  };
}

export function QtyStepper({
  value,
  onChange,
  label,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-full border-[1.5px] border-line bg-white" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        className="qty h-10 w-11 rounded-full border-0 bg-transparent text-lg font-bold text-ink disabled:opacity-40"
        aria-label={`Decrease quantity of ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="min-w-[22px] text-center font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="qty h-10 w-11 rounded-full border-0 bg-transparent text-lg font-bold text-ink disabled:opacity-40"
        aria-label={`Increase quantity of ${label}`}
        disabled={value >= MAX_QTY}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function CartDrawer() {
  const open = useUi((s) => s.drawerOpen);
  const close = useUi((s) => s.closeDrawer);
  const returnFocus = useUi((s) => s.drawerReturnFocus);
  const lines = useCart((s) => s.lines);
  const count = useCart(selectCount);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const panelRef = useRef<HTMLElement>(null);
  const overrides = useLive((s) => s.overrides);

  // Focus trap, Esc to close, body scroll lock, focus returned to the trigger.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    };
  }, [open, close, returnFocus]);

  if (!open) return null;
  const items = lines.map((l) => resolveLine(l, overrides)).filter((x): x is NonNullable<ReturnType<typeof resolveLine>> => !!x);
  const allPriced = items.length > 0 && items.every((i) => i.unitPrice !== null);
  const subtotal = allPriced ? items.reduce((t, i) => t + (i.unitPrice ?? 0) * i.line.qty, 0) : null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close cart"
        onClick={close}
        className="cart-scrim absolute inset-0 m-0 h-full w-full border-0 bg-[rgba(7,43,51,.5)] p-0"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="cart-panel absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-cream text-ink shadow-[-30px_0_60px_-30px_rgba(0,0,0,.45)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line-2 px-6 py-5">
          <h2 id="cart-title" className="m-0 font-serif text-[34px] font-medium">
            Your cart <span className="font-sans text-[15px] font-bold text-muted-2">({count})</span>
          </h2>
          <button
            type="button"
            data-autofocus
            aria-label="Close cart"
            onClick={close}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-[1.5px] border-line bg-transparent text-ink hover:bg-ink hover:text-cream"
          >
            <Close />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-1">
          {items.length === 0 ? (
            <div className="px-2.5 py-[70px] text-center">
              <p className="m-0 font-serif text-[30px]">
                Your cart is <em>empty.</em>
              </p>
              <p className="mt-2.5 text-sm text-muted-2">Find something handmade you'll love.</p>
              <Link
                to="/shop"
                onClick={close}
                className="btn btn-primary mt-6 inline-flex min-h-[50px] items-center gap-2 rounded-full bg-teal-btn px-6 font-bold text-white no-underline hover:text-white"
              >
                Browse the shop <ArrowRight />
              </Link>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {items.map(({ line, product, variantLabel, image, unitPrice, unavailable }) => (
                <li key={line.key} className="flex items-center gap-3.5 border-b border-line-2 py-4">
                  <Link to={`/product/${product.slug}?variant=${line.variantId}`} onClick={close} className="flex-none" tabIndex={-1} aria-hidden="true">
                    <img src={imageUrl(image, 320)} alt="" width={76} height={76} className="h-[76px] w-[76px] rounded-[14px] object-cover" loading="lazy" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link to={`/product/${product.slug}?variant=${line.variantId}`} onClick={close} className="text-[15px] font-bold leading-snug text-ink no-underline hover:underline">
                      {product.name}
                    </Link>
                    {variantLabel && <span className="text-[13px] text-muted-2">{variantLabel}</span>}
                    {line.personalisation && (
                      <span className="text-[13px] text-muted-2">
                        Personalised: <q className="font-semibold text-ink">{line.personalisation}</q>
                      </span>
                    )}
                    {unavailable ? (
                      <span className="text-[12.5px] font-bold text-[#9B1C1C]">No longer available — please remove</span>
                    ) : (
                      <span className="text-[12.5px] font-bold text-price">{formatPrice(unitPrice)}</span>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <QtyStepper value={line.qty} min={1} label={product.name} onChange={(n) => setQty(line.key, n)} />
                      <button
                        type="button"
                        onClick={() => remove(line.key)}
                        className="min-h-11 border-0 bg-transparent px-1.5 text-[13.5px] font-bold text-teal-dark underline hover:text-ink"
                        aria-label={`Remove ${product.name} from cart`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-line-2 bg-white px-6 pb-6 pt-[18px]">
          {items.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-bold">Subtotal</span>
                <span className="font-bold text-price">{formatPrice(subtotal)}</span>
              </div>
              <p className="m-0 text-[13px] leading-normal text-muted-2">Coco will confirm your total before payment. Delivery across Egypt.</p>
              <Link
                to="/checkout"
                onClick={close}
                className="btn btn-primary flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-teal-btn text-base font-bold text-white no-underline hover:text-white"
              >
                Checkout <ArrowRight />
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={close}
            className="btn btn-ghost min-h-[50px] rounded-full border-[1.5px] border-ink bg-transparent text-[15px] font-bold text-ink"
          >
            Continue shopping
          </button>
        </div>
      </aside>
    </div>
  );
}
