import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { defaultVariant, type Product } from '../data/catalog';
import { formatPrice } from '../lib/format';
import { useLiveProduct } from '../store/live';
import { useAddToCart } from '../lib/useAddToCart';
import { useCart } from '../store/cart';
import { Picture } from './Picture';

export const GRID_SIZES =
  '(min-width: 1280px) 280px, (min-width: 1100px) calc(25vw - 44px), (min-width: 820px) calc(33vw - 44px), calc(50vw - 30px)';

interface Props {
  product: Product;
  /** Short line under the name; defaults to the description (2-line clamp, hidden on phones). */
  meta?: string;
  heading?: 'h2' | 'h3';
  index?: number;
  /** Above-the-fold card: load its photo eagerly (it is often the LCP image). */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ProductCard({ product: p, meta, heading: H = 'h2', index = 0, priority = false, className = '', style }: Props) {
  const inCart = useCart((s) => s.lines.some((l) => l.productId === p.id));
  const addToCart = useAddToCart();
  const live = useLiveProduct(p);
  const options = p.variants.length;
  // Hidden from the dashboard: drop out of every list once live data arrives.
  if (live.hidden) return null;

  return (
    <article className={`card group relative h-full ${className}`} style={{ animationDelay: `${Math.min(index, 12) * 0.04}s`, ...style }}>
      <div className="flex h-full flex-col rounded-[24px] bg-white p-3 max-[560px]:rounded-[18px] max-[560px]:p-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-skeleton max-[560px]:rounded-xl">
          <Picture src={p.image} alt={p.name} sizes={GRID_SIZES} priority={priority} className="h-full w-full" />
          <span className="absolute left-2 top-2 rounded-full bg-cream/95 px-2.5 py-[5px] text-[11px] font-bold text-ink">{p.categoryName}</span>
          {live.soldOut && (
            <span className="absolute right-2 top-2 rounded-full bg-[#7A1F1F] px-2.5 py-[5px] text-[11px] font-bold text-white">Sold out</span>
          )}
          {options > 1 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-ink px-2.5 py-[5px] text-[11px] font-bold text-gold-light">{options} options</span>
          )}
        </div>
        <div className="flex flex-grow flex-col gap-1.5 px-1.5 pb-1 pt-3.5">
          <H className="m-0 font-serif text-[23px] font-semibold leading-[1.12] max-[560px]:text-[18px]">
            <Link
              to={`/product/${p.slug}`}
              className="text-ink no-underline after:absolute after:inset-0 after:rounded-[24px] after:content-[''] hover:text-ink focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-teal"
            >
              {p.name}
            </Link>
          </H>
          <p className="clamp-2 m-0 text-[13.5px] leading-[1.55] text-muted-2 max-[560px]:hidden">{meta ?? p.description}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
            <span className="text-[13px] font-bold text-price">{formatPrice(live.price)}</span>
            <button
              type="button"
              disabled={live.soldOut}
              onClick={(e) => {
                const v = defaultVariant(p);
                addToCart({ productId: p.id, variantId: v.catalogId, image: p.image }, e.currentTarget.closest('article'));
              }}
              className={`btn relative z-10 min-h-11 rounded-full border-0 px-4 text-[13.5px] font-bold text-white max-[560px]:w-full disabled:bg-line disabled:text-muted-2 disabled:hover:bg-line ${
                inCart ? 'bg-teal-btn hover:bg-teal-dark' : 'bg-ink hover:bg-teal-dark'
              }`}
            >
              {/* Visible text first so the accessible name contains it (WCAG 2.5.3). */}
              {live.soldOut ? 'Sold out' : inCart ? 'In cart ✓' : 'Add to cart'}
              <span className="sr-only">{live.soldOut ? `: ${p.name}` : inCart ? ` — add another ${p.name}` : `: ${p.name}`}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[24px] bg-white p-3 max-[560px]:rounded-[18px] max-[560px]:p-2" aria-hidden="true">
      <div className="skel aspect-[4/5] rounded-2xl max-[560px]:rounded-xl" />
      <div className="skel mx-1.5 mb-2 mt-4 h-[22px] rounded-lg" />
      <div className="skel mx-1.5 mb-2.5 h-3.5 w-3/5 rounded-lg" />
    </div>
  );
}

export const gridClass =
  'grid grid-cols-2 gap-2.5 min-[561px]:gap-3.5 min-[820px]:grid-cols-3 min-[820px]:gap-[22px] min-[1100px]:grid-cols-4';
