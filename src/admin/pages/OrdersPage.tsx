import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import type { AdminOrderSummary, OrderStatus } from '../../lib/api-types';
import { ORDER_STATUSES } from '../../lib/api-types';
import { Button, Empty, ErrorBox, Icon, PageHeader, PaymentPill, Skeleton, StatusPill, inputCls } from '../ui';
import { METHOD, STATUS, ago, money } from '../format';

interface ListResponse {
  orders: AdminOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<OrderStatus, number>>;
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status') ?? '';
  const payment = params.get('payment') ?? '';
  const page = Number(params.get('page')) || 1;
  const [q, setQ] = useState(params.get('q') ?? '');
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState('');

  const query = params.get('q') ?? '';
  const load = useCallback(async () => {
    setError('');
    try {
      const sp = new URLSearchParams();
      if (status) sp.set('status', status);
      if (payment) sp.set('payment', payment);
      if (query) sp.set('q', query);
      sp.set('page', String(page));
      setData(await api<ListResponse>(`/api/admin/orders?${sp}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status, payment, query, page]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (q === query) return;
      const sp = new URLSearchParams(params);
      if (q) sp.set('q', q);
      else sp.delete('q');
      sp.delete('page');
      setParams(sp, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [q, query, params, setParams]);

  const setFilter = (k: 'status' | 'payment', v: string) => {
    const sp = new URLSearchParams(params);
    if (v) sp.set(k, v);
    else sp.delete(k);
    sp.delete('page');
    setParams(sp);
  };

  const all = data ? Object.values(data.counts).reduce((t, n) => t + (n ?? 0), 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const tab = (value: string, label: string, n?: number) => (
    <button
      key={value || 'all'}
      type="button"
      aria-pressed={status === value}
      onClick={() => setFilter('status', value)}
      className={`flex min-h-10 flex-none items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-[13px] font-bold ${
        status === value ? 'border-ink bg-ink text-cream' : 'border-[#DDD6C8] bg-white text-ink hover:border-ink'
      }`}
    >
      {label}
      {n !== undefined && <span className={`rounded-full px-1.5 text-[11px] ${status === value ? 'bg-white/20' : 'bg-[#F1EEE7]'}`}>{n}</span>}
    </button>
  );

  return (
    <>
      <PageHeader title="الطلبات" sub={data ? `${data.total} طلب` : ' '} />

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 min-[900px]:mx-0 min-[900px]:flex-wrap min-[900px]:px-0">
        {tab('', 'الكل', all)}
        {ORDER_STATUSES.map((s) => tab(s, STATUS[s].label, data?.counts[s] ?? 0))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">بحث</span>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-2">{Icon.search(18)}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم الطلب، الاسم، التليفون، المدينة" className={`${inputCls} pr-10`} />
        </label>
        <button
          type="button"
          aria-pressed={payment === 'pending_review'}
          onClick={() => setFilter('payment', payment === 'pending_review' ? '' : 'pending_review')}
          className={`min-h-11 rounded-xl border px-3.5 text-[13px] font-bold ${
            payment === 'pending_review' ? 'border-[#D4AF5A] bg-[#FFF3D6] text-[#6E5210]' : 'border-[#DDD6C8] bg-white text-ink'
          }`}
        >
          إيصالات للمراجعة
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={() => void load()} />}

      {!data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : data.orders.length === 0 ? (
        <Empty title={query || status || payment ? 'مفيش طلبات بالفلتر ده' : 'لسه مفيش طلبات'}>
          {query || status || payment ? (
            <Button variant="ghost" size="sm" onClick={() => { setQ(''); setParams({}); }}>
              مسح الفلاتر
            </Button>
          ) : (
            'أول ما عميل يطلب من الموقع هيظهر هنا وهيوصلك إشعار.'
          )}
        </Empty>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="m-0 flex list-none flex-col gap-2 p-0 min-[900px]:hidden">
            {data.orders.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="block rounded-[18px] border border-[#E7E1D5] bg-white p-4 text-ink no-underline active:bg-[#FBF9F5]">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[15px]" dir="ltr">
                      {o.number}
                    </strong>
                    <StatusPill status={o.status} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{o.customerName}</span>
                    <span className="flex-none font-bold">{money(o.total)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-2">
                    <span>
                      {o.city} · {o.itemCount} قطعة · {METHOD[o.paymentMethod]}
                    </span>
                    <span>{ago(o.createdAt)}</span>
                  </div>
                  {o.paymentStatus === 'pending_review' && (
                    <div className="mt-2">
                      <PaymentPill status={o.paymentStatus} />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-[20px] border border-[#E7E1D5] bg-white min-[900px]:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#FBF9F5] text-right text-xs text-muted-2">
                  {['الطلب', 'العميل', 'المدينة', 'القطع', 'الدفع', 'الحالة', 'الإجمالي', 'الوقت'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/admin/orders/${o.id}`)}
                    className="cursor-pointer border-t border-[#F1EEE7] hover:bg-[#FBF9F5]"
                  >
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders/${o.id}`} className="font-bold text-ink no-underline hover:underline" dir="ltr">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{o.customerName}</div>
                      <div className="text-xs text-muted-2" dir="ltr">
                        {o.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">{o.city}</td>
                    <td className="px-4 py-3">{o.itemCount}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">{METHOD[o.paymentMethod]}</div>
                      {o.paymentStatus !== 'unpaid' && (
                        <div className="mt-1">
                          <PaymentPill status={o.paymentStatus} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-4 py-3 font-bold">{money(o.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-2">{ago(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav aria-label="الصفحات" className="mt-4 flex items-center justify-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setParams((p) => (p.set('page', String(page - 1)), p))}>
                السابق
              </Button>
              <span className="text-sm font-bold">
                {page} / {pages}
              </span>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setParams((p) => (p.set('page', String(page + 1)), p))}>
                التالي
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
