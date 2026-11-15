import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CatalogTabs } from '../CatalogTabs';
import { api } from '../api';
import type { AdminCategory, AdminProduct } from '../../lib/api-types';
import { Button, Empty, ErrorBox, Icon, PageHeader, Skeleton, Toggle, inputCls } from '../ui';
import { imageUrl } from '../../lib/images';
import { categoryLabel, startAlign, useT, type Key } from '../i18n';

type Edit = Pick<AdminProduct, 'price' | 'hidden' | 'soldOut' | 'stock'>;

const FILTERS: { id: string; label: Key }[] = [
  { id: 'all', label: 'common.all' },
  { id: 'unpriced', label: 'prod.filter.unpriced' },
  { id: 'soldout', label: 'prod.filter.soldout' },
  { id: 'hidden', label: 'prod.filter.hidden' },
];

export function ProductsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? 'all';
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [categoryList, setCategoryList] = useState<AdminCategory[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setError('');
    try {
      const res = await api<{ products: AdminProduct[]; categories?: AdminCategory[] }>('/api/admin/products');
      setItems(res.products);
      setCategoryList(res.categories ?? []);
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

  const current = (p: AdminProduct): Edit => edits[p.id] ?? { price: p.price, hidden: p.hidden, soldOut: p.soldOut, stock: p.stock };
  const change = (p: AdminProduct, patch: Partial<Edit>) => {
    const next = { ...current(p), ...patch };
    setSaved(false);
    setEdits((e) => {
      const copy = { ...e };
      if (next.price === p.price && next.hidden === p.hidden && next.soldOut === p.soldOut && next.stock === p.stock) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });
  };

  // Every category from the catalogue (empty ones too, e.g. Concrete Works) — plus any a product uses that the list lacks.
  const categories = useMemo<AdminCategory[]>(() => {
    const known = new Map(categoryList.map((c) => [c.slug, c]));
    for (const p of items ?? []) if (!known.has(p.category)) known.set(p.category, { slug: p.category, name: p.categoryName, nameAr: p.categoryName });
    return [...known.values()];
  }, [categoryList, items]);
  const categoryOf = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);
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
      <CatalogTabs />
      <PageHeader
        title={t('prod.title')}
        sub={items ? t('prod.sub', { priced, total: items.length }) : ' '}
        actions={
          <Link
            to="/admin/products/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-btn px-4 text-sm font-bold text-white no-underline hover:bg-teal-dark hover:text-white"
          >
            {Icon.plus(18)} {t('prod.add')}
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">{t('common.search')}</span>
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-2">{Icon.search(18)}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('prod.name')} className={`${inputCls} ps-10`} />
        </label>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} w-auto`} aria-label={t('prod.category')}>
          <option value="all">{t('prod.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {categoryLabel(c)}
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
            {t(f.label)}
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
        <Empty title={t('prod.empty')} />
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
                  <a href={`/product/${p.slug}`} target="_blank" rel="noopener" className="block font-bold text-ink no-underline hover:underline" dir="ltr" style={{ textAlign: startAlign() }}>
                    {p.name}
                  </a>
                  <div className="mt-0.5 text-xs text-muted-2">
                    {categoryOf.get(p.category) ? categoryLabel(categoryOf.get(p.category)!) : p.categoryName}
                    {p.variants.length > 1 && ` · ${t('prod.colors', { n: p.variants.length })}`}
                    {p.sold > 0 && ` · ${t('prod.sold', { n: p.sold })}`}
                  </div>
                </div>
                <Link
                  to={`/admin/products/${p.id}`}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#DDD6C8] bg-white px-3 text-[13px] font-bold text-ink no-underline hover:border-ink hover:text-ink"
                >
                  {Icon.edit(16)} {t('prod.edit')}
                  <span className="sr-only"> {p.name}</span>
                </Link>
                <label className="flex items-center gap-1.5">
                  <span className="sr-only">{t('prod.priceOf', { name: p.name })}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={c.price ?? ''}
                    placeholder={t('common.price')}
                    onChange={(e) => change(p, { price: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) })}
                    className={`${inputCls} w-[110px] text-center`}
                    dir="ltr"
                  />
                  <span className="text-xs text-muted-2">{t('common.egp')}</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="sr-only">{t('prod.stockOf', { name: p.name })}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={c.stock ?? ''}
                    placeholder={t('prod.stock')}
                    onChange={(e) => change(p, { stock: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) })}
                    className={`${inputCls} w-[90px] text-center ${c.stock === 0 ? 'border-red-400' : ''}`}
                    dir="ltr"
                  />
                </label>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Toggle checked={c.soldOut} onChange={(v) => change(p, { soldOut: v })} label={t('prod.soldOutOf', { name: p.name })} />
                    {t('prod.filter.soldout')}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Toggle checked={c.hidden} onChange={(v) => change(p, { hidden: v })} label={t('prod.hide', { name: p.name })} />
                    {t('prod.filter.hidden')}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(dirty > 0 || saved) && (
        <div className="fixed inset-x-0 bottom-[70px] z-40 flex justify-center px-4 min-[900px]:bottom-6 min-[900px]:ms-[248px]">
          <div className="flex w-full max-w-[560px] items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-[0_20px_40px_-12px_rgba(11,46,51,.6)]">
            <span className="text-sm font-bold">{dirty ? t('prod.unsaved', { n: dirty }) : t('prod.savedMsg')}</span>
            {dirty > 0 ? (
              <div className="flex gap-2">
                <Button size="sm" variant="soft" onClick={() => setEdits({})}>
                  {t('prod.undo')}
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void save()}>
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="soft" onClick={() => setSaved(false)}>
                {t('prod.ok')}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
