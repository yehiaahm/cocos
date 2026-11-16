import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import type { AdminPromo, AdminPromoInput, PromoState } from '../../lib/api-types';
import { PROMO_CODE_RE, normalisePromoCode, promoConditions, promoHeadline, type PromoType } from '../../lib/promo';
import { Button, Card, Empty, ErrorBox, Icon, PageHeader, Skeleton, Toggle, inputCls } from '../ui';
import { ago, count, money } from '../format';
import { errorText, getLang, startAlign, t as tt, useT, type Key } from '../i18n';

type Filter = 'all' | 'active' | 'scheduled' | 'ended' | 'paused';
const FILTERS: Filter[] = ['all', 'active', 'scheduled', 'ended', 'paused'];
const inFilter = (s: PromoState, f: Filter) =>
  f === 'all' || (f === 'ended' ? s === 'expired' || s === 'used_up' : f === s);

const STATE_CLS: Record<PromoState, { cls: string; dot: string }> = {
  active: { cls: 'bg-[#E3F3E8] text-[#1E6B3A]', dot: 'bg-[#2E9E5B]' },
  scheduled: { cls: 'bg-[#E8EAF6] text-[#2E3A8C]', dot: 'bg-[#5563C1]' },
  expired: { cls: 'bg-[#F1EEE7] text-[#4A5E61]', dot: 'bg-[#8A9799]' },
  used_up: { cls: 'bg-[#FFF3D6] text-[#6E5210]', dot: 'bg-[#D4AF5A]' },
  paused: { cls: 'bg-[#F6E7E7] text-[#7A1F1F]', dot: 'bg-[#B44444]' },
};

const StatePill = ({ state }: { state: PromoState }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATE_CLS[state].cls}`}>
    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATE_CLS[state].dot}`} />
    {tt(`promo.state.${state}` as Key)}
  </span>
);

const LOCALE = () => (getLang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat(LOCALE(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** ISO → value for <input type="datetime-local"> in the device's time zone (Egypt for the owner). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

/** Easy to read out loud: no 0/O or 1/I. */
function randomCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `COCO${Array.from(bytes, (b) => abc[b % abc.length]).join('')}`;
}

/** One-line description in the dashboard language: "15% off the products · up to EGP 200 · on orders of EGP 500 or more". */
function describe(p: { type: PromoType; value: number | null; maxDiscount: number | null; minSubtotal: number | null }, t: typeof tt): string {
  const parts: string[] = [];
  const v = p.value ?? 0;
  parts.push(p.type === 'percent' ? t('promo.sum.percent', { v }) : p.type === 'fixed' ? t('promo.sum.fixed', { v: count(v) }) : t('promo.sum.free'));
  if (p.type === 'percent' && p.maxDiscount) parts.push(t('promo.sum.max', { v: count(p.maxDiscount) }));
  if (p.minSubtotal) parts.push(t('promo.sum.min', { v: count(p.minSubtotal) }));
  return parts.join(' · ');
}

// ─── Form ───────────────────────────────────────────────────────────────────────────────────────

interface Draft {
  code: string;
  type: PromoType;
  value: string;
  maxDiscount: string;
  minSubtotal: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  active: boolean;
  banner: boolean;
  bannerText: string;
  note: string;
}
const emptyDraft = (): Draft => ({
  code: '',
  type: 'percent',
  value: '',
  maxDiscount: '',
  minSubtotal: '',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  perCustomerLimit: '',
  active: true,
  banner: false,
  bannerText: '',
  note: '',
});
const draftOf = (p: AdminPromo): Draft => ({
  code: p.code,
  type: p.type,
  value: p.type === 'free_shipping' ? '' : String(p.value),
  maxDiscount: p.maxDiscount?.toString() ?? '',
  minSubtotal: p.minSubtotal?.toString() ?? '',
  startsAt: toLocalInput(p.startsAt),
  endsAt: toLocalInput(p.endsAt),
  usageLimit: p.usageLimit?.toString() ?? '',
  perCustomerLimit: p.perCustomerLimit?.toString() ?? '',
  active: p.active,
  banner: p.banner,
  bannerText: p.bannerText,
  note: p.note,
});
const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));
const inputOf = (d: Draft): AdminPromoInput => ({
  code: normalisePromoCode(d.code),
  type: d.type,
  value: d.type === 'free_shipping' ? 0 : num(d.value),
  maxDiscount: d.type === 'percent' ? num(d.maxDiscount) : null,
  minSubtotal: num(d.minSubtotal),
  startsAt: fromLocalInput(d.startsAt),
  endsAt: fromLocalInput(d.endsAt),
  usageLimit: num(d.usageLimit),
  perCustomerLimit: num(d.perCustomerLimit),
  active: d.active,
  banner: d.banner,
  bannerText: d.bannerText.trim(),
  note: d.note.trim(),
});

const label = 'mb-1.5 block text-sm font-bold';
const hint = 'mb-0 mt-1 text-xs leading-relaxed text-muted-2';

function Field({ id, title, help, children, className = '' }: { id: string; title: string; help?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      {children}
      {help && <p className={hint}>{help}</p>}
    </div>
  );
}

/** Number input with a unit (%, EGP) on its end side. */
function Unit({ id, value, onChange, unit, placeholder, min = 0, max }: { id: string; value: string; onChange: (v: string) => void; unit: string; placeholder?: string; min?: number; max?: number }) {
  return (
    <div className="relative" dir="ltr">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} pe-14`}
      />
      <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-xs font-bold text-muted-2">{unit}</span>
    </div>
  );
}

/** A faithful small copy of the shop's top bar, so the owner sees exactly what customers will see. */
function BarPreview({ d }: { d: Draft }) {
  const t = useT();
  const code = normalisePromoCode(d.code) || 'CODE';
  const rules = {
    type: d.type,
    value: d.type === 'free_shipping' ? 0 : Number(d.value) || 0,
    minSubtotal: num(d.minSubtotal),
    maxDiscount: d.type === 'percent' ? num(d.maxDiscount) : null,
  };
  const custom = d.bannerText.trim();
  return (
    <div>
      <p className="mb-1.5 mt-0 text-xs font-bold text-muted-2">{t('promo.form.preview')}</p>
      <div dir="ltr" className="promo-bar overflow-hidden rounded-xl bg-ink px-4 py-2.5 text-cream" style={{ animation: 'none' }}>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-[13px]">
          {custom ? (
            <strong className="text-gold-light">{custom}</strong>
          ) : (
            <>
              <strong className="font-extrabold text-gold-light">{promoHeadline(rules)}</strong>
              {promoConditions(rules) && <span className="text-cream/80">{promoConditions(rules)}</span>}
            </>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-dashed border-gold/80 py-0.5 pe-0.5 ps-2.5 font-bold">
            <span className="font-mono tracking-[.12em] text-gold-light">{code}</span>
            <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] text-ink">Copy</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PromoForm({
  initial,
  editing,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  editing: AdminPromo | null;
  busy: boolean;
  onSubmit: (input: AdminPromoInput) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const code = normalisePromoCode(d.code);
  const codeOk = PROMO_CODE_RE.test(code);
  const valueOk = d.type === 'free_shipping' || (Number(d.value) >= 1 && (d.type !== 'percent' || Number(d.value) <= 100));
  const datesOk = !d.startsAt || !d.endsAt || new Date(d.endsAt) > new Date(d.startsAt);

  const summary = useMemo(() => {
    const parts = [describe({ type: d.type, value: num(d.value), maxDiscount: num(d.maxDiscount), minSubtotal: num(d.minSubtotal) }, t)];
    if (d.startsAt) parts.push(t('promo.sum.from', { date: shortDate(new Date(d.startsAt).toISOString()) }));
    if (d.endsAt) parts.push(t('promo.sum.until', { date: shortDate(new Date(d.endsAt).toISOString()) }));
    if (num(d.usageLimit)) parts.push(t('promo.sum.limit', { v: d.usageLimit }));
    if (num(d.perCustomerLimit)) parts.push(t('promo.sum.perCustomer', { v: d.perCustomerLimit }));
    return parts.join(' · ');
  }, [d, t]);

  const types: PromoType[] = ['percent', 'fixed', 'free_shipping'];
  const p = editing ? `edit-${editing.id}` : 'new-promo';

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(inputOf(d));
      }}
      className="grid gap-5"
    >
      <Field id={`${p}-code`} title={t('promo.form.code')} help={t('promo.form.codeHint')}>
        <div className="flex gap-2">
          <input
            id={`${p}-code`}
            value={d.code}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
            placeholder="EID15"
            dir="ltr"
            aria-invalid={!!d.code && !codeOk}
            className={`${inputCls} font-mono text-[16px] font-bold uppercase tracking-[.12em]`}
            style={{ textAlign: startAlign() }}
          />
          <Button variant="soft" onClick={() => set('code', randomCode())} className="flex-none">
            {Icon.star(16)} {t('promo.form.generate')}
          </Button>
        </div>
      </Field>

      <fieldset className="m-0 border-0 p-0">
        <legend className={`${label} p-0`}>{t('promo.form.type')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {types.map((ty) => (
            <label
              key={ty}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border-[1.5px] p-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal ${
                d.type === ty ? 'border-ink bg-[#FBF9F5]' : 'border-[#DDD6C8] bg-white hover:border-teal'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <input type="radio" name={`${p}-type`} value={ty} checked={d.type === ty} onChange={() => set('type', ty)} className="h-4 w-4 accent-[#0B2E33]" />
                {t(`promo.type.${ty}` as Key)}
              </span>
              <span className="ps-6 text-xs text-muted-2">{t(`promo.type.${ty}Hint` as Key)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {d.type !== 'free_shipping' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${p}-value`} title={d.type === 'percent' ? t('promo.form.percent') : t('promo.form.amount')}>
            <Unit id={`${p}-value`} value={d.value} onChange={(v) => set('value', v)} unit={d.type === 'percent' ? '%' : t('common.egp')} min={1} max={d.type === 'percent' ? 100 : undefined} placeholder={d.type === 'percent' ? '15' : '100'} />
          </Field>
          {d.type === 'percent' && (
            <Field id={`${p}-max`} title={t('promo.form.max')} help={t('promo.form.maxHint')}>
              <Unit id={`${p}-max`} value={d.maxDiscount} onChange={(v) => set('maxDiscount', v)} unit={t('common.egp')} placeholder={t('promo.form.unlimited')} min={1} />
            </Field>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${p}-min`} title={t('promo.form.min')} help={t('promo.form.minHint')}>
          <Unit id={`${p}-min`} value={d.minSubtotal} onChange={(v) => set('minSubtotal', v)} unit={t('common.egp')} placeholder="—" />
        </Field>
        <div className="hidden sm:block" />
        <Field id={`${p}-starts`} title={t('promo.form.starts')} help={t('promo.form.startsHint')}>
          <input id={`${p}-starts`} type="datetime-local" value={d.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={inputCls} dir="ltr" />
        </Field>
        <Field id={`${p}-ends`} title={t('promo.form.ends')} help={t('promo.form.endsHint')}>
          <input id={`${p}-ends`} type="datetime-local" value={d.endsAt} min={d.startsAt || undefined} onChange={(e) => set('endsAt', e.target.value)} aria-invalid={!datesOk} className={inputCls} dir="ltr" />
        </Field>
        <Field id={`${p}-limit`} title={t('promo.form.limit')} help={t('promo.form.limitHint')}>
          <Unit id={`${p}-limit`} value={d.usageLimit} onChange={(v) => set('usageLimit', v)} unit="×" placeholder={t('promo.form.unlimited')} min={1} />
        </Field>
        <Field id={`${p}-per`} title={t('promo.form.perCustomer')} help={t('promo.form.perCustomerHint')}>
          <Unit id={`${p}-per`} value={d.perCustomerLimit} onChange={(v) => set('perCustomerLimit', v)} unit="×" placeholder={t('promo.form.unlimited')} min={1} />
        </Field>
      </div>

      <div className="grid gap-3 rounded-2xl bg-[#FBF9F5] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-sm font-bold">{t('promo.form.active')}</p>
            <p className={hint}>{t('promo.form.activeHint')}</p>
          </div>
          <Toggle checked={d.active} onChange={(v) => set('active', v)} label={t('promo.form.active')} />
        </div>
        <div className="flex items-start justify-between gap-4 border-t border-[#EDE8DE] pt-3">
          <div>
            <p className="m-0 text-sm font-bold">{t('promo.form.bar')}</p>
            <p className={hint}>{t('promo.form.barHint')}</p>
          </div>
          <Toggle checked={d.banner} onChange={(v) => set('banner', v)} label={t('promo.form.bar')} />
        </div>
        {d.banner && (
          <>
            <Field id={`${p}-bartext`} title={t('promo.form.barText')} help={t('promo.form.barTextHint')}>
              <input
                id={`${p}-bartext`}
                value={d.bannerText}
                maxLength={140}
                onChange={(e) => set('bannerText', e.target.value)}
                dir="ltr"
                placeholder={`${promoHeadline({ type: d.type, value: Number(d.value) || 0 })} — Eid sale ✨`}
                className={inputCls}
                style={{ textAlign: startAlign() }}
              />
            </Field>
            <BarPreview d={d} />
          </>
        )}
      </div>

      <Field id={`${p}-note`} title={t('promo.form.note')}>
        <input id={`${p}-note`} value={d.note} maxLength={300} onChange={(e) => set('note', e.target.value)} placeholder={t('promo.form.notePlaceholder')} className={inputCls} />
      </Field>

      <div className="rounded-2xl border border-[#CFE6E4] bg-[#F1F8F7] p-4">
        <p className="m-0 text-xs font-bold text-teal-dark">{t('promo.form.summary')}</p>
        <p className="m-0 mt-1 text-[15px] font-bold">
          <span dir="ltr" className="font-mono tracking-[.1em]">
            {code || '—'}
          </span>{' '}
          → {summary}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="dark" disabled={busy || !codeOk || !valueOk || !datesOk}>
          {busy ? t('common.saving') : editing ? t('promo.form.save') : t('promo.form.create')}
        </Button>
        <Button variant="soft" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────────────────────

function Stat({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#E7E1D5] bg-white px-4 py-3">
      <div className="text-xs font-bold text-muted-2">{l}</div>
      <div className="mt-0.5 text-[22px] font-bold leading-tight">{value}</div>
    </div>
  );
}

function PromoRow({
  p,
  busy,
  onEdit,
  onDelete,
  onPatch,
}: {
  p: AdminPromo;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (body: Partial<AdminPromoInput>, done: string) => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* blocked */
    }
  };
  const pct = p.usageLimit ? Math.min(100, Math.round((p.usedCount / p.usageLimit) * 100)) : null;
  const now = Date.now();
  const when =
    p.state === 'scheduled' && p.startsAt
      ? t('promo.starts', { when: ago(p.startsAt) })
      : p.endsAt
        ? new Date(p.endsAt).getTime() > now
          ? t('promo.ends', { when: ago(p.endsAt) })
          : t('promo.ended', { when: ago(p.endsAt) })
        : t('promo.noEnd');

  return (
    <li className={`rounded-[20px] border bg-white p-4 shadow-[0_1px_2px_rgba(11,46,51,.04)] ${p.banner ? 'border-gold' : 'border-[#E7E1D5]'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              title={t('promo.copy')}
              aria-label={`${t('promo.copy')} ${p.code}`}
              dir="ltr"
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#C9BFAE] bg-[#FBF9F5] px-3 font-mono text-[17px] font-bold tracking-[.12em] text-ink hover:border-ink"
            >
              {p.code}
              <span className="text-muted-2">{copied ? Icon.check(15) : Icon.copy(15)}</span>
            </button>
            <StatePill state={p.state} />
            {p.banner && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF3D6] px-2.5 py-1 text-xs font-bold text-[#6E5210]">
                {Icon.bell(13)} {t('promo.inBar')}
              </span>
            )}
          </div>
          <p className="mb-0 mt-2 text-[15px] font-bold">{describe(p, t)}</p>
          <p className="mb-0 mt-0.5 text-xs text-muted-2">
            {p.startsAt && p.state !== 'scheduled' ? `${t('promo.from', { date: shortDate(p.startsAt) })} · ` : ''}
            {when}
            {p.perCustomerLimit ? ` · ${t('promo.sum.perCustomer', { v: p.perCustomerLimit })}` : ''}
          </p>
          {p.note && <p className="mb-0 mt-1.5 inline-block rounded-md bg-[#F1EEE7] px-2 py-0.5 text-xs text-muted-2">{p.note}</p>}

          <div className="mt-3 max-w-[340px]">
            <div className="flex justify-between text-xs font-bold text-muted-2">
              <span>{p.usageLimit ? t('promo.uses', { used: p.usedCount, limit: p.usageLimit }) : t('promo.usesUnlimited', { used: p.usedCount })}</span>
              {pct !== null && <span dir="ltr">{pct}%</span>}
            </div>
            {pct !== null && (
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F1EEE7]" aria-hidden="true">
                <div className={`h-full rounded-full ${pct >= 100 ? 'bg-gold' : 'bg-teal'}`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        </div>

        <dl className="m-0 grid grid-cols-3 gap-3 rounded-2xl bg-[#FBF9F5] px-4 py-3 text-center max-[560px]:w-full">
          <div>
            <dt className="text-[11px] font-bold text-muted-2">{t('promo.stat.orders')}</dt>
            <dd className="m-0 text-base font-bold">
              {p.stats.orders > 0 ? <Link to={`/admin/orders?q=${encodeURIComponent(p.code)}`}>{count(p.stats.orders)}</Link> : count(p.stats.orders)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold text-muted-2">{t('promo.stat.discount')}</dt>
            <dd className="m-0 whitespace-nowrap text-base font-bold">{money(p.stats.discount)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold text-muted-2">{t('promo.stat.revenue')}</dt>
            <dd className="m-0 whitespace-nowrap text-base font-bold">{money(p.stats.revenue)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#F1EEE7] pt-3">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Toggle checked={p.active} onChange={(v) => onPatch({ active: v }, tt('promo.saved'))} label={t('promo.activeOf', { code: p.code })} />
          {t('promo.toggleActive')}
        </span>
        <span className="flex items-center gap-2 text-sm font-bold">
          <Toggle checked={p.banner} onChange={(v) => onPatch({ banner: v }, v ? tt('promo.barOn') : tt('promo.barOff'))} label={t('promo.barOf', { code: p.code })} />
          {t('promo.toggleBar')}
        </span>
        <span className="ms-auto flex gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={onEdit}>
            {Icon.edit(16)} {t('promo.edit')}
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={onDelete}>
            {Icon.trash(16)} {t('promo.delete')}
          </Button>
        </span>
      </div>
    </li>
  );
}

export function PromosPage() {
  const t = useT();
  const [list, setList] = useState<AdminPromo[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [form, setForm] = useState<{ editing: AdminPromo | null; draft: Draft } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setList((await api<{ promos: AdminPromo[] }>('/api/admin/promos')).promos);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (form) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [form]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(done);
      await load();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (input: AdminPromoInput) => {
    const editing = form?.editing;
    const ok = await run(
      () => (editing ? api(`/api/admin/promos/${editing.id}`, { method: 'PATCH', body: input }) : api('/api/admin/promos', { method: 'POST', body: input })),
      editing ? t('promo.saved') : t('promo.created'),
    );
    if (ok) setForm(null);
  };

  const totals = useMemo(() => {
    const l = list ?? [];
    return {
      active: l.filter((p) => p.state === 'active').length,
      orders: l.reduce((s, p) => s + p.stats.orders, 0),
      discount: l.reduce((s, p) => s + p.stats.discount, 0),
      revenue: l.reduce((s, p) => s + p.stats.revenue, 0),
    };
  }, [list]);
  const shown = (list ?? []).filter((p) => inFilter(p.state, filter));
  const countOf = (f: Filter) => (list ?? []).filter((p) => inFilter(p.state, f)).length;

  return (
    <>
      <PageHeader
        title={t('promo.title')}
        sub={list ? t('promo.sub', { n: list.length }) : ' '}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setNotice('');
              setForm({ editing: null, draft: emptyDraft() });
            }}
          >
            {Icon.plus(18)} {t('promo.new')}
          </Button>
        }
      />

      {list && list.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          <Stat label={t('promo.kpi.active')} value={count(totals.active)} />
          <Stat label={t('promo.kpi.orders')} value={count(totals.orders)} />
          <Stat label={t('promo.kpi.discount')} value={money(totals.discount)} />
          <Stat label={t('promo.kpi.revenue')} value={money(totals.revenue)} />
        </div>
      )}

      {notice && (
        <p role="status" className="mb-3 mt-0 text-sm font-bold text-[#1E6B3A]">
          {notice}
        </p>
      )}
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={list ? undefined : () => void load()} />
        </div>
      )}

      {form && (
        <div ref={formRef} className="mb-4 scroll-mt-20">
          <Card title={form.editing ? t('promo.form.titleEdit', { code: form.editing.code }) : t('promo.form.titleNew')}>
            <PromoForm key={form.editing?.id ?? 'new'} initial={form.draft} editing={form.editing} busy={busy} onSubmit={(i) => void submit(i)} onCancel={() => setForm(null)} />
          </Card>
        </div>
      )}

      {list && list.length > 0 && (
        <div role="group" aria-label={t('promo.title')} className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`inline-flex min-h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold ${
                filter === f ? 'border-ink bg-ink text-cream' : 'border-[#DDD6C8] bg-white text-ink hover:border-ink'
              }`}
            >
              {t(`promo.filter.${f}` as Key)}
              <span className={`text-[11px] ${filter === f ? 'text-cream/70' : 'text-muted-2'}`}>{countOf(f)}</span>
            </button>
          ))}
        </div>
      )}

      {!list ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[150px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        !form && (
          <Empty title={t('promo.empty')}>
            <p className="m-0">{t('promo.emptyHint')}</p>
            <Button className="mt-4" onClick={() => setForm({ editing: null, draft: emptyDraft() })}>
              {Icon.plus(18)} {t('promo.new')}
            </Button>
          </Empty>
        )
      ) : shown.length === 0 ? (
        <Empty title={t('promo.noMatch')} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map((p) => (
            <PromoRow
              key={p.id}
              p={p}
              busy={busy}
              onEdit={() => {
                setNotice('');
                setForm({ editing: p, draft: draftOf(p) });
              }}
              onDelete={() => {
                if (window.confirm(t('promo.deleteConfirm', { code: p.code }))) {
                  void run(() => api(`/api/admin/promos/${p.id}`, { method: 'DELETE' }), t('promo.deleted')).then((ok) => {
                    if (ok && form?.editing?.id === p.id) setForm(null);
                  });
                }
              }}
              onPatch={(body, done) => void run(() => api(`/api/admin/promos/${p.id}`, { method: 'PATCH', body }), done)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
