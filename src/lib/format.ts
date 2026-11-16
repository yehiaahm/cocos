
const egp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "EGP 1,250" when a price is set, "Price pending" otherwise. Prices are never invented. */
export function formatPrice(price: number | null | undefined): string {
  return typeof price === 'number' && Number.isFinite(price) ? `EGP ${egp.format(price)}` : 'Price pending';
}


export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayTimeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const shortDay = (iso: string) => dayFmt.format(new Date(iso));
export const dayTime = (iso: string) => dayTimeFmt.format(new Date(iso));

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return plural(Math.floor(s / 86_400), 'day') + ' ago';
  return shortDay(iso);
}
