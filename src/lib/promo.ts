/**
 * Promo codes: the rules and the discount maths, shared by the server (which always decides) and the
 * storefront (which shows the same numbers live while the customer edits the cart).
 */

export type PromoType = 'percent' | 'fixed' | 'free_shipping';
export const PROMO_TYPES: PromoType[] = ['percent', 'fixed', 'free_shipping'];

/** What decides the discount. Orders keep their own copy, so later edits to a code never change them. */
export interface PromoRules {
  type: PromoType;
  /** percent: 1–100 · fixed: EGP · free_shipping: 0 */
  value: number;
  /** EGP; null = no minimum order. */
  minSubtotal: number | null;
  /** EGP cap on percent codes; null = no cap. */
  maxDiscount: number | null;
}

/** Code format: 3–24 characters, letters, digits, dash and underscore. Matching is case-insensitive. */
export const PROMO_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;

/** "  eid-15 " → "EID-15". Spaces inside are dropped (people paste "EID 15"). */
export const normalisePromoCode = (raw: unknown): string =>
  typeof raw === 'string' ? raw.toUpperCase().replace(/\s+/g, '').slice(0, 40) : '';

/**
 * The discount in EGP, or null while it can't be worked out yet (an item is still "Price pending", or a
 * free-delivery code before the delivery fee is known). 0 when the order is below the minimum.
 * The discount never exceeds the subtotal (free delivery: the delivery fee), so a total is never negative.
 */
export function computeDiscount(rules: PromoRules | null | undefined, subtotal: number | null, deliveryFee: number | null): number | null {
  if (!rules) return 0;
  if (subtotal === null) return null;
  if (rules.minSubtotal !== null && subtotal < rules.minSubtotal) return 0;
  switch (rules.type) {
    case 'percent': {
      const pct = Math.min(Math.max(rules.value, 0), 100);
      const d = Math.floor((subtotal * pct) / 100);
      return rules.maxDiscount !== null ? Math.min(d, rules.maxDiscount) : d;
    }
    case 'fixed':
      return Math.min(Math.max(rules.value, 0), subtotal);
    case 'free_shipping':
      return deliveryFee === null ? null : deliveryFee;
    default:
      return 0;
  }
}

/** Subtotal, discount and total of an order. Each is null until everything it depends on is known. */
export function orderTotals(items: { qty: number; unitPrice: number | null }[], deliveryFee: number | null, rules?: PromoRules | null) {
  const priced = items.every((i) => i.unitPrice !== null);
  const subtotal = priced ? items.reduce((t, i) => t + (i.unitPrice ?? 0) * i.qty, 0) : null;
  const discount = computeDiscount(rules, subtotal, deliveryFee);
  const total = subtotal !== null && deliveryFee !== null && discount !== null ? Math.max(subtotal + deliveryFee - discount, 0) : null;
  return { subtotal, discount, total };
}

const egp = (n: number) => `EGP ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`;

/** "15% off" · "EGP 100 off" · "Free delivery" (customer-facing, English). */
export function promoHeadline(r: Pick<PromoRules, 'type' | 'value'>): string {
  if (r.type === 'percent') return `${r.value}% off`;
  if (r.type === 'fixed') return `${egp(r.value)} off`;
  return 'Free delivery';
}

/** "on orders over EGP 500 · up to EGP 200" — the small print, or '' when there is none. */
export function promoConditions(r: PromoRules): string {
  const parts: string[] = [];
  if (r.minSubtotal !== null && r.minSubtotal > 0) parts.push(`on orders over ${egp(r.minSubtotal)}`);
  if (r.type === 'percent' && r.maxDiscount !== null) parts.push(`up to ${egp(r.maxDiscount)}`);
  return parts.join(' · ');
}
