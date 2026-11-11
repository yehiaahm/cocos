import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { OrderStatus, PaymentStatus } from '../lib/api-types';
import { PAYMENT_STATUS, STATUS } from './format';

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-[20px] border border-[#E7E1D5] bg-white p-5 shadow-[0_1px_2px_rgba(11,46,51,.04)] max-[560px]:p-4 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export const StatusPill = ({ status }: { status: OrderStatus }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[status].cls}`}>
    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS[status].dot}`} />
    {STATUS[status].label}
  </span>
);

export const PaymentPill = ({ status }: { status: PaymentStatus }) => (
  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${PAYMENT_STATUS[status].cls}`}>{PAYMENT_STATUS[status].label}</span>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'dark' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md' };
export function Button({ variant = 'primary', size = 'md', className = '', ...p }: BtnProps) {
  const v = {
    primary: 'bg-teal-btn text-white hover:bg-teal-dark',
    dark: 'bg-ink text-white hover:bg-[#123F45]',
    ghost: 'border border-[#DDD6C8] bg-white text-ink hover:border-ink',
    danger: 'border border-[#E9CACA] bg-white text-[#9B1C1C] hover:bg-[#FBEAEA]',
    soft: 'bg-[#F1EEE7] text-ink hover:bg-[#E7E1D5]',
  }[variant];
  const s = size === 'sm' ? 'min-h-9 px-3 text-[13px]' : 'min-h-11 px-4 text-sm';
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}
    />
  );
}

export const inputCls =
  'min-h-11 w-full rounded-xl border border-[#DDD6C8] bg-white px-3.5 text-[15px] text-ink outline-none placeholder:text-[#8A9799] focus:border-teal focus:ring-2 focus:ring-[#14A3A0]/20';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-none rounded-full transition-colors ${checked ? 'bg-teal-btn' : 'bg-[#D9D0C1]'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'right-6' : 'right-1'}`} />
    </button>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#DDD6C8] bg-white/60 px-6 py-14 text-center">
      <p className="m-0 text-base font-bold text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-2">{children}</div>}
    </div>
  );
}

export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`skel rounded-xl ${className}`} aria-hidden="true" />;

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FBEAEA] px-4 py-3 text-sm font-semibold text-[#7A1F1F]">
      {message}
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 text-[26px] font-bold leading-tight text-ink max-[560px]:text-[22px]">{title}</h1>
        {sub && <p className="mb-0 mt-1 text-sm text-muted-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Small inline icons for the dashboard. */
const I = (d: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
export const Icon = {
  home: () => I(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>),
  orders: () => I(<><path d="M6 7h12l-1 13H7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
  products: () => I(<><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>),
  customers: () => I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>),
  settings: () => I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  phone: (s?: number) => I(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />, s),
  whatsapp: (s?: number) => I(<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />, s),
  bell: (s?: number) => I(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>, s),
  search: (s?: number) => I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, s),
  /** In RTL "back" points right and "forward" points left. */
  back: (s?: number) => I(<path d="M5 12h14M13 6l6 6-6 6" />, s),
  fwd: (s?: number) => I(<path d="M19 12H5M11 6l-6 6 6 6" />, s),
  out: (s?: number) => I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>, s),
  ext: (s?: number) => I(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>, s),
  print: (s?: number) => I(<><path d="M6 9V3h12v6" /><rect x="6" y="14" width="12" height="7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /></>, s),
  copy: (s?: number) => I(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, s),
  check: (s?: number) => I(<path d="M5 12l5 5L20 7" />, s),
};
