import type { OrderStatus, PaymentMethod, PaymentStatus } from '../lib/api-types';

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const money = (n: number | null | undefined) => (typeof n === 'number' ? `${num.format(n)} ج.م` : '—');
export const count = (n: number) => num.format(n);

const dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
const rel = new Intl.RelativeTimeFormat('ar-EG-u-nu-latn', { numeric: 'auto' });

export const dateTime = (iso: string) => dateFmt.format(new Date(iso));
export const dayLabel = (isoDay: string) => dayFmt.format(new Date(`${isoDay}T12:00:00Z`));
export const longDate = (iso: string) => longFmt.format(new Date(iso));

export function ago(iso: string): string {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return 'الآن';
  if (a < 3600) return rel.format(Math.round(s / 60), 'minute');
  if (a < 86_400) return rel.format(Math.round(s / 3600), 'hour');
  if (a < 7 * 86_400) return rel.format(Math.round(s / 86_400), 'day');
  return dateTime(iso);
}

export const STATUS: Record<OrderStatus, { label: string; cls: string; dot: string }> = {
  new: { label: 'جديد', cls: 'bg-[#E3F2F1] text-[#0B5E5B]', dot: 'bg-[#14A3A0]' },
  confirmed: { label: 'مؤكد', cls: 'bg-[#E8EAF6] text-[#2E3A8C]', dot: 'bg-[#5563C1]' },
  in_progress: { label: 'قيد التنفيذ', cls: 'bg-[#FFF3D6] text-[#6E5210]', dot: 'bg-[#D4AF5A]' },
  shipped: { label: 'تم الشحن', cls: 'bg-[#E4EEF8] text-[#1F4E79]', dot: 'bg-[#3B82C4]' },
  delivered: { label: 'تم التسليم', cls: 'bg-[#E3F3E8] text-[#1E6B3A]', dot: 'bg-[#2E9E5B]' },
  cancelled: { label: 'ملغي', cls: 'bg-[#F6E7E7] text-[#7A1F1F]', dot: 'bg-[#B44444]' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  unpaid: { label: 'لم يُدفع', cls: 'bg-[#F1EEE7] text-[#4A5E61]' },
  pending_review: { label: 'إيصال للمراجعة', cls: 'bg-[#FFF3D6] text-[#6E5210]' },
  paid: { label: 'مدفوع', cls: 'bg-[#E3F3E8] text-[#1E6B3A]' },
  refunded: { label: 'مسترد', cls: 'bg-[#F6E7E7] text-[#7A1F1F]' },
};

export const METHOD: Record<PaymentMethod, string> = { cod: 'كاش عند الاستلام', instapay: 'إنستاباي', wallet: 'محفظة' };

/** 01012345678 → 201012345678 */
export const intl = (phone: string) => `20${phone.replace(/^0/, '')}`;
export const waLink = (phone: string, text?: string) => `https://wa.me/${intl(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
