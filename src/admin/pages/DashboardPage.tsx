import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import type { AdminStats } from '../../lib/api-types';
import { AreaChart, BarList } from '../charts';
import { Card, ErrorBox, PageHeader, Skeleton, StatusPill, Icon } from '../ui';
import { METHOD, STATUS, count, dayLabel, money } from '../format';
import { imageUrl } from '../../lib/images';
import { PushCard } from './SettingsPage';
import { useT } from '../i18n';

function Delta({ now, prev }: { now: number; prev: number }) {
  const t = useT();
  if (!prev) return now ? <span className="text-xs font-bold text-[#1E6B3A]">{t('dash.new')}</span> : null;
  const pct = Math.round(((now - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`text-xs font-bold ${up ? 'text-[#1E6B3A]' : 'text-[#9B1C1C]'}`} dir="ltr">
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

function Kpi({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[#E7E1D5] bg-white p-4">
      <p className="m-0 text-[13px] font-semibold text-muted-2">{label}</p>
      <p className="mb-0 mt-2 text-[26px] font-bold leading-none tracking-tight text-ink max-[560px]:text-[22px]">{value}</p>
      <p className="mb-0 mt-2 flex min-h-4 items-center gap-2 text-xs text-muted-2">
        {delta}
        {hint}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const t = useT();
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders');
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api<AdminStats>(`/api/admin/stats?range=${range}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [range]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const k = data?.kpis;
  const actions = k
    ? [
        { n: k.newOrders, label: t('dash.act.new'), to: '/admin/orders?status=new', tone: 'bg-[#E3F2F1] text-[#0B5E5B]' },
        { n: k.proofsToReview, label: t('dash.act.proofs'), to: '/admin/orders?payment=pending_review', tone: 'bg-[#FFF3D6] text-[#6E5210]' },
        { n: k.awaitingPrice, label: t('dash.act.noTotal'), to: '/admin/orders?status=new', tone: 'bg-[#E8EAF6] text-[#2E3A8C]' },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t('dash.title')}
        sub={t('dash.sub')}
        actions={
          <div role="group" aria-label={t('dash.period')} className="flex rounded-xl border border-[#DDD6C8] bg-white p-1">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`min-h-9 rounded-lg border-0 px-3 text-[13px] font-bold ${range === r ? 'bg-ink text-cream' : 'bg-transparent text-ink'}`}
              >
                {r === 7 ? t('dash.range7') : r === 30 ? t('dash.range30') : t('dash.range90')}
              </button>
            ))}
          </div>
        }
      />
      {error && <ErrorBox message={error} onRetry={() => void load()} />}

      {!data ? (
        <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[110px]" />
          ))}
          <Skeleton className="col-span-2 h-[300px] min-[900px]:col-span-4" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {actions.some((a) => a.n > 0) && (
            <div className="grid gap-3 min-[700px]:grid-cols-3">
              {actions
                .filter((a) => a.n > 0)
                .map((a) => (
                  <Link key={a.label} to={a.to} className={`flex items-center justify-between gap-3 rounded-[18px] px-4 py-3.5 no-underline ${a.tone} hover:opacity-90`}>
                    <span className="text-sm font-bold">{a.label}</span>
                    <span className="text-[22px] font-bold">{a.n}</span>
                  </Link>
                ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            <Kpi label={t('dash.kpi.orders')} value={count(k!.orders)} delta={<Delta now={k!.orders} prev={k!.ordersPrev} />} hint={t('dash.kpi.vsPrev')} />
            <Kpi label={t('dash.kpi.revenue')} value={money(k!.revenue)} delta={<Delta now={k!.revenue} prev={k!.revenuePrev} />} hint={t('dash.kpi.paid', { amount: money(k!.paidRevenue) })} />
            <Kpi label={t('dash.kpi.avg')} value={money(k!.avgOrder)} hint={t('dash.kpi.avgHint')} />
            <Kpi label={t('dash.kpi.customers')} value={count(k!.customers)} hint={t('dash.kpi.returning', { n: k!.returningCustomers })} />
          </div>

          <Card
            title={metric === 'orders' ? t('dash.chart.orders') : t('dash.chart.revenue')}
            action={
              <div role="group" aria-label={t('dash.metric')} className="flex rounded-lg bg-[#F1EEE7] p-0.5">
                {(['orders', 'revenue'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={metric === m}
                    onClick={() => setMetric(m)}
                    className={`min-h-8 rounded-md border-0 px-3 text-xs font-bold ${metric === m ? 'bg-white text-ink shadow-sm' : 'bg-transparent text-muted-2'}`}
                  >
                    {m === 'orders' ? t('dash.metric.orders') : t('dash.metric.revenue')}
                  </button>
                ))}
              </div>
            }
          >
            <AreaChart
              label={metric === 'orders' ? t('dash.chart.orders') : t('dash.chart.revenue')}
              points={data.daily.map((d) => ({ x: d.date, xLabel: dayLabel(d.date), y: metric === 'orders' ? d.orders : d.revenue }))}
              format={metric === 'orders' ? (n) => count(n) : (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : count(n))}
            />
          </Card>

          <div className="grid gap-4 min-[900px]:grid-cols-[1.3fr_1fr]">
            <Card title={t('dash.top')} action={<Link to="/admin/products" className="text-xs font-bold">{t('dash.allProducts')}</Link>}>
              {data.topProducts.length === 0 ? (
                <p className="m-0 py-6 text-center text-sm text-muted-2">{t('dash.noOrders')}</p>
              ) : (
                <BarList
                  format={(n) => t('dash.pieces', { n })}
                  rows={data.topProducts.map((t) => ({
                    key: t.productId,
                    title: t.name,
                    value: t.qty,
                    label: (
                      <span className="flex items-center gap-2.5">
                        {t.image && <img src={imageUrl(t.image, 320)} alt="" width={32} height={32} className="h-8 w-8 flex-none rounded-lg object-cover" />}
                        <span className="truncate" dir="ltr">
                          {t.name}
                        </span>
                      </span>
                    ),
                  }))}
                />
              )}
            </Card>
            <Card title={t('dash.cities')}>
              {data.cities.length === 0 ? (
                <p className="m-0 py-6 text-center text-sm text-muted-2">—</p>
              ) : (
                <BarList format={(n) => t('dash.ordersN', { n })} rows={data.cities.map((c) => ({ key: c.city, title: c.city, value: c.count, label: c.city }))} />
              )}
            </Card>
          </div>

          <div className="grid gap-4 min-[900px]:grid-cols-3">
            <Card title={t('dash.statuses')}>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => {
                  const n = data.statuses.find((x) => x.status === s)?.count ?? 0;
                  return (
                    <li key={s} className="flex items-center justify-between">
                      <StatusPill status={s} />
                      <Link to={`/admin/orders?status=${s}`} className="text-sm font-bold text-ink no-underline hover:underline">
                        {n}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title={t('dash.methods')}>
              {data.payments.length === 0 ? (
                <p className="m-0 py-6 text-center text-sm text-muted-2">—</p>
              ) : (
                <BarList format={(n) => `${n}`} rows={data.payments.map((p) => ({ key: p.method, title: METHOD[p.method], value: p.count, label: METHOD[p.method] }))} />
              )}
            </Card>
            <Card title={t('dash.pricing')}>
              <p className="m-0 text-[26px] font-bold">
                {data.pricedProducts} <span className="text-base font-semibold text-muted-2">/ {data.totalProducts}</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F1EEE7]">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(data.pricedProducts / Math.max(1, data.totalProducts)) * 100}%` }} />
              </div>
              <p className="mb-3 mt-3 text-sm text-muted-2">{t('dash.pricingHint')}</p>
              <Link to="/admin/products?filter=unpriced" className="inline-flex items-center gap-1.5 text-sm font-bold">
                {t('dash.setPrices')} {Icon.fwd(16)}
              </Link>
            </Card>
          </div>

          <PushCard compact />
        </div>
      )}
    </>
  );
}
