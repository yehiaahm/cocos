import type { OrderStatus, PaymentMethod, PaymentStatus } from '../lib/api-types';
import { getLang, t, type Lang } from './i18n';

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const money = (n: number | null | undefined) => (typeof n === 'number' ? `${num.format(n)} ${t('common.egp')}` : '—');
export const count = (n: number) => num.format(n);

/** Date/time formatters per language (Latin digits in both, so numbers read the same everywhere). */
const LOCALE: Record<Lang, string> = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' };
const cache = new Map<string, Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function fmt(kind: 'date' | 'day' | 'long', lang: Lang): Intl.DateTimeFormat {
  const key = `${kind}:${lang}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    const opts: Intl.DateTimeFormatOptions =
      kind === 'date'
        ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
        : kind === 'day'
          ? { day: 'numeric', month: 'short' }
          : { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' };
    f = new Intl.DateTimeFormat(LOCALE[lang], opts);
    cache.set(key, f);
  }
  return f;
}
function relFmt(lang: Lang): Intl.RelativeTimeFormat {
  const key = `rel:${lang}`;
  let f = cache.get(key) as Intl.RelativeTimeFormat | undefined;
  if (!f) {
    f = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' });
    cache.set(key, f);
  }
  return f;
}

export const dateTime = (iso: string) => fmt('date', getLang()).format(new Date(iso));
export const dayLabel = (isoDay: string) => fmt('day', getLang()).format(new Date(`${isoDay}T12:00:00Z`));
export const longDate = (iso: string) => fmt('long', getLang()).format(new Date(iso));

export function ago(iso: string): string {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  const rel = relFmt(getLang());
  if (a < 60) return t('time.now');
  if (a < 3600) return rel.format(Math.round(s / 60), 'minute');
  if (a < 86_400) return rel.format(Math.round(s / 3600), 'hour');
  if (a < 7 * 86_400) return rel.format(Math.round(s / 86_400), 'day');
  return dateTime(iso);
}

/** Labels are getters so they follow the current dashboard language at render time. */
export const STATUS: Record<OrderStatus, { label: string; cls: string; dot: string }> = {
  new: { get label() { return t('status.new'); }, cls: 'bg-[#E3F2F1] text-[#0B5E5B]', dot: 'bg-[#14A3A0]' },
  confirmed: { get label() { return t('status.confirmed'); }, cls: 'bg-[#E8EAF6] text-[#2E3A8C]', dot: 'bg-[#5563C1]' },
  in_progress: { get label() { return t('status.in_progress'); }, cls: 'bg-[#FFF3D6] text-[#6E5210]', dot: 'bg-[#D4AF5A]' },
  shipped: { get label() { return t('status.shipped'); }, cls: 'bg-[#E4EEF8] text-[#1F4E79]', dot: 'bg-[#3B82C4]' },
  delivered: { get label() { return t('status.delivered'); }, cls: 'bg-[#E3F3E8] text-[#1E6B3A]', dot: 'bg-[#2E9E5B]' },
  cancelled: { get label() { return t('status.cancelled'); }, cls: 'bg-[#F6E7E7] text-[#7A1F1F]', dot: 'bg-[#B44444]' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  unpaid: { get label() { return t('pay.unpaid'); }, cls: 'bg-[#F1EEE7] text-[#4A5E61]' },
  pending_review: { get label() { return t('pay.pending_review'); }, cls: 'bg-[#FFF3D6] text-[#6E5210]' },
  paid: { get label() { return t('pay.paid'); }, cls: 'bg-[#E3F3E8] text-[#1E6B3A]' },
  refunded: { get label() { return t('pay.refunded'); }, cls: 'bg-[#F6E7E7] text-[#7A1F1F]' },
};

export const METHOD: Record<PaymentMethod, string> = {
  get cod() { return t('method.cod'); },
  get instapay() { return t('method.instapay'); },
  get wallet() { return t('method.wallet'); },
};

/** 01012345678 → 201012345678 */
export const intl = (phone: string) => `20${phone.replace(/^0/, '')}`;
export const waLink = (phone: string, text?: string) => `https://wa.me/${intl(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
