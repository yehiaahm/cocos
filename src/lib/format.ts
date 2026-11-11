import type { Product } from '../data/catalog';

const egp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "EGP 1,250" when a price is set, "Price pending" otherwise. Prices are never invented. */
export function formatPrice(price: number | null | undefined): string {
  return typeof price === 'number' && Number.isFinite(price) ? `EGP ${egp.format(price)}` : 'Price pending';
}

export const productPrice = (p: Product) => formatPrice(p.priceStatus === 'set' ? p.price : null);

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
