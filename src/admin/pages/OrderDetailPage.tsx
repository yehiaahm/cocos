import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { useSession } from '../AdminApp';
import type { AdminOrder, AdminOrderUpdate, OrderStatus, PaymentSettings, PaymentStatus } from '../../lib/api-types';
import { PAYMENT_STATUSES } from '../../lib/api-types';
import { Button, Card, ErrorBox, Icon, PaymentPill, Skeleton, StatusPill, inputCls } from '../ui';
import { METHOD, PAYMENT_STATUS, STATUS, ago, longDate, money, waLink } from '../format';
import { imageUrl } from '../../lib/images';
import { site } from '../../config/site';

let settingsCache: Promise<PaymentSettings> | null = null;
const loadSettings = () => (settingsCache ??= api<{ settings: PaymentSettings }>('/api/admin/settings').then((r) => r.settings));

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: 'confirmed', label: 'تأكيد الطلب' },
  confirmed: { to: 'in_progress', label: 'بدء التنفيذ' },
  in_progress: { to: 'shipped', label: 'تم الشحن' },
  shipped: { to: 'delivered', label: 'تم التسليم' },
};

function customerLink(o: AdminOrder) {
  return `${window.location.origin}/order/${o.number}?t=${o.token}`;
}

function messages(o: AdminOrder, s: PaymentSettings | null) {
  const first = o.customerName.split(/\s+/)[0];
  const link = customerLink(o);
  const payLine =
    o.paymentMethod === 'cod'
      ? 'الدفع كاش عند الاستلام.'
      : o.paymentMethod === 'instapay'
        ? `الدفع إنستاباي على: ${s?.instapay || '—'}\nبعد التحويل ارفع صورة التحويل من لينك الطلب.`
        : `الدفع ${s?.walletName || 'محفظة'} على رقم: ${s?.wallet || '—'}\nبعد التحويل ارفع صورة التحويل من لينك الطلب.`;
  const lines = o.items.map((i) => `• ${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''}${i.unitPrice !== null ? ` — ${i.unitPrice * i.qty} ج.م` : ''}`).join('\n');
  return [
    {
      id: 'confirm',
      label: 'تأكيد الطلب والإجمالي',
      text: `أهلاً ${first} 👋\nمعاك ${site.name} بخصوص طلبك ${o.number}:\n${lines}\n\n${
        o.total !== null ? `الإجمالي: ${o.total} ج.م${o.deliveryFee ? ` (شامل التوصيل ${o.deliveryFee} ج.م)` : ''}` : 'هنأكد معاك الإجمالي حالاً.'
      }\n${payLine}\n\nتتابع طلبك من هنا:\n${link}`,
    },
    { id: 'making', label: 'الطلب قيد التنفيذ', text: `أهلاً ${first} 🌿\nطلبك ${o.number} بدأنا نشتغل عليه بإيدينا، وهنبلغك أول ما يجهز.\n${link}` },
    { id: 'shipped', label: 'تم الشحن', text: `أهلاً ${first} 🚚\nطلبك ${o.number} اتشحن وفي الطريق ليك!\n${o.paymentMethod === 'cod' && o.total !== null ? `المطلوب عند الاستلام: ${o.total} ج.م\n` : ''}${link}` },
    { id: 'thanks', label: 'شكر بعد التسليم', text: `شكراً يا ${first} 💛\nنتمنى القطعة تعجبك! لو حابب تشاركنا صورة هنكون مبسوطين جداً.\n${site.instagramUrl}` },
  ];
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { refresh: refreshBadges } = useSession();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [proofOpen, setProofOpen] = useState(false);
  const [copied, setCopied] = useState('');

  const hydrateForm = (o: AdminOrder) => {
    setPrices(Object.fromEntries(o.items.map((i) => [i.id, i.unitPrice?.toString() ?? ''])));
    setFee(o.deliveryFee?.toString() ?? '');
    setNotes(o.adminNotes ?? '');
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const { order } = await api<{ order: AdminOrder }>(`/api/admin/orders/${id}`);
      setOrder(order);
      hydrateForm(order);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
    loadSettings().then(setSettings, () => undefined);
  }, [load]);

  const update = async (body: AdminOrderUpdate, key: string) => {
    setSaving(key);
    setError('');
    try {
      const { order } = await api<{ order: AdminOrder }>(`/api/admin/orders/${id}`, { method: 'PATCH', body });
      setOrder(order);
      hydrateForm(order);
      void refreshBadges();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const toNum = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s))));
  const draft = useMemo(() => {
    if (!order) return null;
    const items = order.items.map((i) => ({ ...i, unitPrice: toNum(prices[i.id] ?? '') }));
    const priced = items.every((i) => i.unitPrice !== null && Number.isFinite(i.unitPrice));
    const subtotal = priced ? items.reduce((t, i) => t + (i.unitPrice ?? 0) * i.qty, 0) : null;
    const f = toNum(fee);
    return { items, subtotal, fee: f, total: subtotal !== null && f !== null ? subtotal + f : null };
  }, [order, prices, fee]);
  const pricingDirty =
    !!order && !!draft && (draft.fee !== order.deliveryFee || draft.items.some((i, k) => i.unitPrice !== order.items[k].unitPrice));

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      /* blocked */
    }
  };

  if (!order) {
    return error ? (
      <ErrorBox message={error} onRetry={() => void load()} />
    ) : (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const next = NEXT[order.status];
  const msgs = messages(order, settings);

  return (
    <div className="print:text-black">
      <div className="mb-4 flex items-center gap-2 text-sm print:hidden">
        <Link to="/admin/orders" className="inline-flex min-h-10 items-center gap-1.5 font-bold no-underline">
          {Icon.back(16)} الطلبات
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[26px] font-bold" dir="ltr">
              {order.number}
            </h1>
            <StatusPill status={order.status} />
            <PaymentPill status={order.paymentStatus} />
          </div>
          <p className="mb-0 mt-1 text-sm text-muted-2">
            {longDate(order.createdAt)} · {ago(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {next && order.status !== 'cancelled' && (
            <Button variant="dark" disabled={!!saving} onClick={() => void update({ status: next.to }, 'status')}>
              {Icon.check(18)} {next.label}
            </Button>
          )}
          <Button variant="ghost" onClick={() => window.print()}>
            {Icon.print(18)} طباعة
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="grid items-start gap-4 min-[1000px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card title={`المنتجات (${order.items.reduce((t, i) => t + i.qty, 0)} قطعة)`}>
            <ul className="m-0 flex list-none flex-col p-0">
              {order.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 border-b border-[#F1EEE7] py-3 first:pt-0 last:border-0">
                  {i.image && <img src={imageUrl(i.image, 320)} alt="" width={56} height={56} className="h-14 w-14 flex-none rounded-xl object-cover" />}
                  <div className="min-w-[150px] flex-1" dir="ltr" style={{ textAlign: 'right' }}>
                    <div className="font-bold">{i.name}</div>
                    {i.variantName && <div className="text-xs text-muted-2">{i.variantName}</div>}
                    {i.personalisation && (
                      <div className="mt-1 inline-block rounded-md bg-[#FFF3D6] px-2 py-0.5 text-xs font-bold text-[#6E5210]">
                        الاسم: “{i.personalisation}”
                      </div>
                    )}
                  </div>
                  <div className="ms-auto flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-2">×{i.qty}</span>
                    <label className="flex items-center gap-1.5">
                      <span className="sr-only">سعر القطعة لـ {i.name}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={prices[i.id] ?? ''}
                        onChange={(e) => setPrices((p) => ({ ...p, [i.id]: e.target.value }))}
                        placeholder="السعر"
                        className={`${inputCls} w-[104px] text-center`}
                        dir="ltr"
                      />
                      <span className="text-xs text-muted-2">ج.م</span>
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-2 border-t border-[#F1EEE7] pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-2">المجموع</span>
                <strong>{money(draft?.subtotal)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="fee" className="text-muted-2">
                  التوصيل
                </label>
                <span className="flex items-center gap-1.5">
                  <input id="fee" type="number" inputMode="numeric" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="—" className={`${inputCls} w-[104px] text-center`} dir="ltr" />
                  <span className="text-xs text-muted-2">ج.م</span>
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#F1EEE7] pt-3 text-base">
                <strong>الإجمالي</strong>
                <strong className="text-[20px]">{money(draft?.total)}</strong>
              </div>
            </div>
            {pricingDirty && (
              <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                <Button
                  disabled={saving === 'pricing'}
                  onClick={() =>
                    void update({ items: draft!.items.map((i) => ({ id: i.id, unitPrice: i.unitPrice })), deliveryFee: draft!.fee }, 'pricing')
                  }
                >
                  {saving === 'pricing' ? 'جارٍ الحفظ…' : 'حفظ الأسعار'}
                </Button>
                <Button variant="soft" onClick={() => hydrateForm(order)}>
                  إلغاء
                </Button>
              </div>
            )}
          </Card>

          <Card title="الدفع">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-lg bg-[#F1EEE7] px-2.5 py-1 font-bold">{METHOD[order.paymentMethod]}</span>
              <PaymentPill status={order.paymentStatus} />
            </div>
            {order.hasProof && (
              <div className="mt-4">
                <button type="button" onClick={() => setProofOpen(true)} className="block overflow-hidden rounded-xl border border-[#E7E1D5] bg-[#FBF9F5] p-0">
                  <img src={`/api/admin/orders/${order.id}/proof`} alt="صورة التحويل" className="block max-h-[260px] w-auto max-w-full object-contain" />
                </button>
                <p className="mb-0 mt-1.5 text-xs text-muted-2">اضغط على الصورة لتكبيرها</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              {order.paymentStatus !== 'paid' && (
                <Button disabled={!!saving} onClick={() => void update({ paymentStatus: 'paid' }, 'pay')}>
                  {Icon.check(18)} تأكيد استلام الدفع
                </Button>
              )}
              {order.paymentStatus === 'pending_review' && (
                <Button variant="danger" disabled={!!saving} onClick={() => void update({ paymentStatus: 'unpaid' }, 'pay')}>
                  رفض الإيصال
                </Button>
              )}
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-2">تغيير:</span>
                <select
                  value={order.paymentStatus}
                  onChange={(e) => void update({ paymentStatus: e.target.value as PaymentStatus }, 'pay')}
                  className={`${inputCls} w-auto py-0`}
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PAYMENT_STATUS[s].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="سجل الطلب">
            <ol className="m-0 list-none p-0">
              {order.events.map((e) => (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-teal" />
                  <div>
                    <div className="text-sm font-semibold">{e.message}</div>
                    <div className="text-xs text-muted-2">{ago(e.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="العميل">
            <div className="text-[17px] font-bold">{order.customerName}</div>
            <div className="mt-0.5 text-sm text-muted-2" dir="ltr" style={{ textAlign: 'right' }}>
              {order.phone}
            </div>
            {order.customerOrderCount > 1 && (
              <Link to={`/admin/orders?q=${order.phone}`} className="mt-1 inline-block text-xs font-bold">
                عميل متكرر · {order.customerOrderCount} طلبات
              </Link>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
              <a href={`tel:${order.phone}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DDD6C8] bg-white text-sm font-bold text-ink no-underline hover:border-ink">
                {Icon.phone(18)} اتصال
              </a>
              <a href={waLink(order.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1FA855] text-sm font-bold text-white no-underline hover:bg-[#178A45] hover:text-white">
                {Icon.whatsapp(18)} واتساب
              </a>
            </div>
            <dl className="m-0 mt-4 grid gap-2 border-t border-[#F1EEE7] pt-4 text-sm">
              <dt className="text-xs font-bold text-muted-2">العنوان</dt>
              {/* Customers type in English or Arabic: each line picks its own direction. */}
              <dd className="m-0 whitespace-pre-line">
                <bdi dir="auto">{order.city}</bdi>
                {'\n'}
                <bdi dir="auto">{order.address}</bdi>
              </dd>
              {order.notes && (
                <>
                  <dt className="mt-2 text-xs font-bold text-muted-2">ملاحظات العميل</dt>
                  <dd className="m-0 whitespace-pre-line rounded-lg bg-[#FFF8E6] p-2.5" dir="auto">{order.notes}</dd>
                </>
              )}
            </dl>
            <Button variant="soft" size="sm" className="mt-3 w-full print:hidden" onClick={() => void copy(`${order.customerName}\n${order.phone}\n${order.city}\n${order.address}`, 'addr')}>
              {copied === 'addr' ? Icon.check(16) : Icon.copy(16)} نسخ بيانات الشحن
            </Button>
          </Card>

          <Card title="رسائل جاهزة للعميل" className="print:hidden">
            <p className="mb-3 mt-0 text-xs text-muted-2">بتفتح واتساب برسالة مكتوبة فيها تفاصيل الطلب ولينك المتابعة.</p>
            <div className="flex flex-col gap-2">
              {msgs.map((m) => (
                <a
                  key={m.id}
                  href={waLink(order.phone, m.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#DDD6C8] bg-white px-3.5 text-sm font-bold text-ink no-underline hover:border-[#1FA855] hover:text-ink"
                >
                  {m.label}
                  <span className="text-[#1FA855]">{Icon.whatsapp(18)}</span>
                </a>
              ))}
            </div>
            <Button variant="soft" size="sm" className="mt-3 w-full" onClick={() => void copy(customerLink(order), 'link')}>
              {copied === 'link' ? Icon.check(16) : Icon.copy(16)} نسخ لينك متابعة الطلب
            </Button>
          </Card>

          <Card title="ملاحظات داخلية" className="print:hidden">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="مثلاً: العميل عايز اللون أغمق شوية" className={`${inputCls} py-2.5`} />
            {notes !== (order.adminNotes ?? '') && (
              <Button size="sm" className="mt-2" disabled={saving === 'notes'} onClick={() => void update({ adminNotes: notes }, 'notes')}>
                حفظ الملاحظة
              </Button>
            )}
          </Card>

          <Card title="الحالة" className="print:hidden">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STATUS) as OrderStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!!saving || s === order.status}
                  onClick={() => {
                    if (s === 'cancelled' && !window.confirm('إلغاء الطلب؟')) return;
                    void update({ status: s }, 'status');
                  }}
                  className={`min-h-10 rounded-xl border text-[13px] font-bold disabled:cursor-default ${
                    s === order.status ? 'border-ink bg-ink text-cream' : 'border-[#DDD6C8] bg-white text-ink hover:border-ink'
                  }`}
                >
                  {STATUS[s].label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {proofOpen && (
        <div role="dialog" aria-modal="true" aria-label="صورة التحويل" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setProofOpen(false)}>
          <img src={`/api/admin/orders/${order.id}/proof`} alt="صورة التحويل" className="max-h-full max-w-full rounded-xl" />
          <button type="button" autoFocus onClick={() => setProofOpen(false)} className="absolute left-4 top-4 h-11 w-11 rounded-full border-0 bg-white text-lg font-bold text-ink" aria-label="إغلاق">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
