import { useCallback } from 'react';
import { useCart, type AddInput } from '../store/cart';
import { useUi } from '../store/ui';
import { prefersReducedMotion } from './motion';
import { imageUrl } from './images';

let flyTimer: ReturnType<typeof setTimeout> | undefined;
let addedTimer: ReturnType<typeof setTimeout> | undefined;
let flySeq = 0;

/**
 * Adds to the cart exactly as HANDOFF §7 describes: never opens the drawer,
 * flies the photo to the floating cart, bumps the pill and flashes "Added to cart ✓".
 */
export function useAddToCart() {
  const add = useCart((s) => s.add);

  return useCallback(
    (input: AddInput & { image: string }, source?: Element | null) => {
      add(input);
      const reduce = prefersReducedMotion();

      clearTimeout(flyTimer);
      clearTimeout(addedTimer);

      let fly = null;
      if (!reduce && typeof window !== 'undefined') {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const r = source?.getBoundingClientRect();
        fly = {
          id: ++flySeq,
          img: imageUrl(input.image, 320),
          sx: Math.round(r ? r.left + r.width / 2 - 40 : W / 2 - 40),
          sy: Math.round(r ? r.top + Math.min(r.height / 3, 140) - 40 : H / 2 - 40),
          ex: Math.round(W / 2 - 40),
          ey: Math.round(H - 92),
        };
        flyTimer = setTimeout(() => useUi.setState({ fly: null }), 900);
      }

      useUi.setState((s) => ({
        fly,
        justAdded: true,
        bumpCount: reduce ? s.bumpCount : s.bumpCount + 1,
      }));
      addedTimer = setTimeout(() => useUi.setState({ justAdded: false }), 1900);
    },
    [add],
  );
}
