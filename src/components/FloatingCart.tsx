import type { CSSProperties } from 'react';
import { selectCount, useCart } from '../store/cart';
import { useUi } from '../store/ui';
import { Bag, ChevronUp } from './Icons';

/** Bottom-centre cart pill (HANDOFF §7.3) plus the flying photo clone (§7.2). */
export function FloatingCart() {
  const count = useCart(selectCount);
  const hydrated = useCart((s) => s.hydrated);
  const bumpCount = useUi((s) => s.bumpCount);
  const justAdded = useUi((s) => s.justAdded);
  const openDrawer = useUi((s) => s.openDrawer);

  if (!hydrated || count === 0) return null;
  const bump = bumpCount ? (bumpCount % 2 ? 'bumpA' : 'bumpB') : '';
  const text = justAdded ? 'Added to cart ✓' : `${count} ${count === 1 ? 'item' : 'items'} in your cart`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        onClick={(e) => openDrawer(e.currentTarget)}
        aria-haspopup="dialog"
        className={`float-cart ${bump} pointer-events-auto flex min-h-[60px] max-w-full items-center gap-3.5 rounded-full border-0 bg-ink p-2 text-[15px] font-bold text-cream shadow-[0_20px_44px_-16px_rgba(11,46,51,.65)] max-[360px]:gap-2.5`}
      >
        <span className="relative flex h-11 w-11 flex-none items-center justify-center rounded-full bg-teal">
          <Bag size={20} stroke="#fff" />
          <span aria-hidden="true" className="absolute -right-[5px] -top-[5px] flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-ink bg-gold px-1.5 text-xs text-ink">
            {count}
          </span>
        </span>
        <span className="truncate whitespace-nowrap" aria-live="polite">
          {text}
        </span>
        <span className="flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-cream px-4 text-sm text-ink">
          View <ChevronUp />
        </span>
      </button>
    </div>
  );
}

export function FlyToCart() {
  const fly = useUi((s) => s.fly);
  if (!fly) return null;
  const vars = { '--sx': `${fly.sx}px`, '--sy': `${fly.sy}px`, '--ex': `${fly.ex}px`, '--ey': `${fly.ey}px` } as CSSProperties;
  return (
    <div key={fly.id} aria-hidden="true" className="fly-x pointer-events-none fixed left-0 top-0 z-[70]" style={vars}>
      <img
        className="fly-y block h-20 w-20 rounded-full border-[3px] border-white object-cover shadow-[0_16px_30px_-10px_rgba(11,46,51,.55)]"
        src={fly.img}
        alt=""
        width={80}
        height={80}
      />
    </div>
  );
}
