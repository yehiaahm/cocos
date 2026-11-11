import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import type { AdminCustomer } from '../../lib/api-types';
import { Empty, ErrorBox, Icon, PageHeader, Skeleton, inputCls } from '../ui';
import { ago, money, waLink } from '../format';

export function CustomersPage() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<AdminCustomer[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      setError('');
      try {
        setList((await api<{ customers: AdminCustomer[] }>(`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`)).customers);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <PageHeader title="العملاء" sub={list ? `${list.length} عميل` : ' '} />
      <label className="relative mb-4 block">
        <span className="sr-only">بحث</span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-2">{Icon.search(18)}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم، التليفون، المدينة" className={`${inputCls} pr-10`} />
      </label>
      {error && <ErrorBox message={error} />}
      {!list ? (
        <div className="grid gap-2 min-[700px]:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty title={q ? 'مفيش عملاء بالبحث ده' : 'لسه مفيش عملاء'}>{!q && 'العملاء بيظهروا هنا تلقائياً من الطلبات.'}</Empty>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0 min-[700px]:grid-cols-2 min-[1200px]:grid-cols-3">
          {list.map((c) => (
            <li key={c.phone} className="rounded-[18px] border border-[#E7E1D5] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold">{c.name}</div>
                  <div className="text-xs text-muted-2">
                    <span dir="ltr">{c.phone}</span> · {c.city}
                  </div>
                </div>
                {c.orders > 1 && <span className="flex-none rounded-full bg-[#FFF3D6] px-2 py-0.5 text-[11px] font-bold text-[#6E5210]">متكرر</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#FBF9F5] p-2.5 text-center text-xs">
                <div>
                  <div className="text-muted-2">طلبات</div>
                  <div className="mt-0.5 text-sm font-bold">{c.orders}</div>
                </div>
                <div>
                  <div className="text-muted-2">إجمالي</div>
                  <div className="mt-0.5 text-sm font-bold">{money(c.spent)}</div>
                </div>
                <div>
                  <div className="text-muted-2">آخر طلب</div>
                  <div className="mt-0.5 text-sm font-bold">{ago(c.lastOrder)}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1FA855] text-[13px] font-bold text-white no-underline hover:text-white">
                  {Icon.whatsapp(16)} واتساب
                </a>
                <a href={`tel:${c.phone}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#DDD6C8] px-3 text-ink no-underline" aria-label={`اتصال بـ ${c.name}`}>
                  {Icon.phone(16)}
                </a>
                <Link to={`/admin/orders?q=${c.phone}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#DDD6C8] px-3 text-[13px] font-bold text-ink no-underline">
                  الطلبات
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
