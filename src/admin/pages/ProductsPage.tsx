import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api';
import type { AdminProduct } from '../../lib/api-types';
import { Button, Empty, ErrorBox, Icon, PageHeader, Skeleton, Toggle, inputCls } from '../ui';
import { imageUrl } from '../../lib/images';

type Edit = Pick<AdminProduct, 'price' | 'hidden' | 'soldOut'>;

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'unpriced', label: 'بدون سعر' },
  { id: 'soldout', label: 'خلصان' },
  { id: 'hidden', label: 'مخفي' },
];

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? 'all';
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setError('');
    try {
      setItems((await api<{ products: AdminProduct[] }>('/api/admin/products')).products);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  // Warn before leaving with unsaved changes.
  const dirty = Object.keys(edits).length;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const current = (p: AdminProduct): Edit => edits[p.id] ?? { price: p.price, hidden: p.hidden, soldOut: p.soldOut };
  const change = (p: AdminProduct, patch: Partial<Edit>) => {
    const next = { ...current(p), ...patch };
    setSaved(false);
    setEdits((e) => {
      const copy = { ...e };
      if (next.price === p.price && next.hidden === p.hidden && next.soldOut === p.soldOut) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });
  };

  const categories = useMemo(() => [...new Map((items ?? []).map((p) => [p.category, p.categoryName])).entries()], [items]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items ?? []).filter((p) => {
      const c = edits[p.id] ?? p;
      if (cat !== 'all' && p.category !== cat) return false;
      if (filter === 'unpriced' && c.price !== null) return false;
      if (filter === 'soldout' && !c.soldOut) return false;
      if (filter === 'hidden' && !c.hidden) return false;
      return !term || p.name.toLowerCase().includes(term) || p.id.includes(term);
    });
  }, [items, edits, q, cat, filter]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api('/api/admin/products', { method: 'PUT', body: { updates: Object.entries(edits).map(([id, e]) => ({ id, ...e })) } });
      setItems((list) => list?.map((p) => (edits[p.id] ? { ...p, ...edits[p.id] } : p)) ?? null);
      setEdits({});
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const priced = items?.filter((p) => (edits[p.id] ?? p).price !== null).length ?? 0;

  return (
    <>
      <PageHeader title="المنتجات" sub={items ? `${priced} من ${items.length} منتج ليهم سعر · التغييرات بتظهر في الموقع خلال دقيقة` : ' '} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">بحث</span>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-2">{Icon.search(18)}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم المنتج" className={`${inputCls} pr-10`} />
        </label>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} w-auto`} aria-label="القسم">
          <option value="all">كل الأقسام</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 min-[900px]:mx-0 min-[900px]:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setParams(f.id === 'all' ? {} : { filter: f.id }, { replace: true })}
            className={`min-h-10 flex-none rounded-xl border px-3.5 text-[13px] font-bold ${filter === f.id ? 'border-ink bg-ink text-cream' : 'border-[#DDD6C8] bg-white text-ink'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={() => void load()} />
        </div>
      )}

      {!items ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty title="مفيش منتجات بالفلتر ده" />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((p) => {
            const c = current(p);
            const changed = !!edits[p.id];
            return (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-3 rounded-[18px] border bg-white p-3 ${changed ? 'border-[#D4AF5A] ring-1 ring-[#D4AF5A]/40' : 'border-[#E7E1D5]'} ${
                  c.hidden ? 'opacity-70' : ''
                }`}
              >
                <img src={imageUrl(p.image, 320)} alt="" width={56} height={56} className="h-14 w-14 flex-none rounded-xl object-cover" loading="lazy" />
                <div className="min-w-[160px] flex-1">
                  <a href={`/product/${p.slug}`} target="_blank" rel="noopener" className="block font-bold text-ink no-underline hover:underline" dir="ltr" style={{ textAlign: 'right' }}>
                    {p.name}
                  </a>
                  <div className="mt-0.5 text-xs text-muted-2">
                    {p.categoryName}
                    {p.variants > 1 && ` · ${p.variants} ألوان`}
                    {p.sold > 0 && ` · اتباع ${p.sold}`}
                  </div>
                </div>
                <label className="flex items-center gap-1.5">
                  <span className="sr-only">سعر {p.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={c.price ?? ''}
                    placeholder="السعر"
                    onChange={(e) => change(p, { price: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) })}
                    className={`${inputCls} w-[110px] text-center`}
                    dir="ltr"
                  />
                  <span className="text-xs text-muted-2">ج.م</span>
                </label>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Toggle checked={c.soldOut} onChange={(v) => change(p, { soldOut: v })} label={`${p.name} خلصان`} />
                    خلصان
                  </span>
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Toggle checked={c.hidden} onChange={(v) => change(p, { hidden: v })} label={`إخفاء ${p.name}`} />
                    مخفي
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(dirty > 0 || saved) && (
        <div className="fixed inset-x-0 bottom-[70px] z-40 flex justify-center px-4 min-[900px]:bottom-6 min-[900px]:mr-[248px]">
          <div className="flex w-full max-w-[560px] items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-[0_20px_40px_-12px_rgba(11,46,51,.6)]">
            <span className="text-sm font-bold">{dirty ? `${dirty} تغيير مش محفوظ` : 'تم الحفظ ✓ — الموقع هيتحدث خلال دقيقة'}</span>
            {dirty > 0 ? (
              <div className="flex gap-2">
                <Button size="sm" variant="soft" onClick={() => setEdits({})}>
                  تراجع
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void save()}>
                  {saving ? 'جارٍ الحفظ…' : 'حفظ'}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="soft" onClick={() => setSaved(false)}>
                تمام
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
