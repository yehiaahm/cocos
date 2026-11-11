import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Seo } from '../lib/seo';
import {
  baseFilter,
  categories,
  getCategory,
  isCategorySlug,
  isOccasionSlug,
  occasions,
  type CategorySlug,
  type OccasionSlug,
} from '../data/catalog';
import { useProducts } from '../data/useProducts';
import { ProductCard, ProductCardSkeleton, gridClass } from '../components/ProductCard';
import { Search, Close } from '../components/Icons';
import { plural } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';
import { site } from '../config/site';

const CATEGORY_COPY: Record<CategorySlug, string> = {
  gaming: 'Handmade resin board games — chess, domino, backgammon and XO sets in every colourway.',
  resin: 'Hand-poured resin coasters, trays, wall clocks, notebooks and seasonal decor.',
  'wood-decoupage': 'Ramadan lanterns, trays, crescents and keepsakes in painted wood and decoupage.',
  macrame: 'Hand-knotted cotton macramé mirrors, wall hangings, plant hangers and bags.',
  candles: 'Sculpted candles and rose candles in resin holders for gifting and every season.',
};

const pillCls = (on: boolean, big: boolean) =>
  `pill inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] font-bold ${
    big ? 'min-h-[46px] px-5 text-[15px]' : 'min-h-[42px] px-4 text-[13.5px]'
  } ${on ? 'border-ink bg-ink text-cream' : 'border-line bg-transparent text-ink'}`;

export function ShopPage() {
  const { category: catParam } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const state = useProducts();

  const category: CategorySlug | 'all' = isCategorySlug(catParam) ? catParam : 'all';
  const occParam = params.get('occasion');
  const occasion: OccasionSlug | 'all' = isOccasionSlug(occParam) ? occParam : 'all';
  const urlQuery = params.get('q') ?? '';

  // Local input state so typing stays snappy; the URL follows with `replace`.
  const [query, setQuery] = useState(urlQuery);
  useEffect(() => setQuery(urlQuery), [urlQuery]);
  const searchRef = useRef<HTMLInputElement>(null);

  const base = useMemo(() => baseFilter(state.products, { occasion, query }), [state.products, occasion, query]);
  const shown = useMemo(() => (category === 'all' ? base : base.filter((p) => p.category === category)), [base, category]);

  if (catParam !== undefined && category === 'all') return <NotFoundPage />;

  const updateParams = (next: { occasion?: string; q?: string }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v && v !== 'all') p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true, preventScrollReset: true, state: { keepScroll: true } });
  };

  const pickCategory = (slug: CategorySlug | 'all') => {
    const qs = params.toString();
    navigate(`${slug === 'all' ? '/shop' : `/shop/${slug}`}${qs ? `?${qs}` : ''}`, { state: { keepScroll: true } });
  };

  const reset = () => {
    setQuery('');
    navigate('/shop', { state: { keepScroll: true } });
    searchRef.current?.focus();
  };

  const cat = getCategory(category);
  const title = cat ? `${cat.name} — handmade in Egypt` : 'Shop all handmade pieces';
  const description = cat
    ? `${CATEGORY_COPY[cat.slug]} ${plural(cat.count, 'piece')} by ${site.name}, delivered across Egypt.`
    : `Browse ${state.products.length} handmade pieces — board games, resin, wood & decoupage, macramé and candles — by ${site.name}. Delivery across Egypt.`;

  const resultText =
    state.status === 'loading' ? 'Loading products…' : state.status === 'error' ? 'Products could not be loaded.' : plural(shown.length, 'product');

  return (
    <>
      <Seo
        title={title}
        description={description}
        path={category === 'all' ? '/shop' : `/shop/${category}`}
        // Filtered/search URLs are not separate pages for search engines.
        noindex={!!urlQuery || occasion !== 'all'}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: site.url + '/' },
            { '@type': 'ListItem', position: 2, name: 'Shop', item: site.url + '/shop' },
            ...(cat ? [{ '@type': 'ListItem', position: 3, name: cat.name, item: `${site.url}/shop/${cat.slug}` }] : []),
          ],
        }}
      />

      <section className="container-page relative pb-10 pt-6" aria-labelledby="shop-title">
        <div
          aria-hidden="true"
          className="morph pointer-events-none absolute -right-[200px] -top-[220px] h-[520px] w-[520px] [background:radial-gradient(circle_at_40%_40%,rgba(79,209,197,.3),rgba(79,209,197,0)_65%)]"
        />
        <p className="eyebrow rise d1 relative mb-3">{cat ? `The shop · ${cat.name}` : 'The shop'}</p>
        <h1 id="shop-title" className="rise-lcp d1 relative m-0 font-serif text-[clamp(40px,6vw,84px)] font-medium leading-[.95] tracking-[-.02em]">
          Every piece, <em>made by hand.</em>
        </h1>
        <p className="rise d3 relative mt-[18px] max-w-[560px] text-[17px] leading-[1.65] text-muted max-[560px]:text-base">
          {cat ? CATEGORY_COPY[cat.slug] : 'Board games, resin, wood & decoupage, macramé and candles — most pieces come in several colourways.'}
        </p>
      </section>

      <section className="container-page flex flex-col gap-4 pb-7" aria-label="Filters">
        <div role="group" aria-label="Category" className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 min-[821px]:mx-0 min-[821px]:flex-wrap min-[821px]:px-0">
          {[{ slug: 'all' as const, name: 'All' }, ...categories].map((c) => {
            const on = category === c.slug;
            const n = c.slug === 'all' ? base.length : base.filter((p) => p.category === c.slug).length;
            return (
              <button key={c.slug} type="button" aria-pressed={on} onClick={() => pickCategory(c.slug)} className={pillCls(on, true)}>
                {c.name} <span className="font-semibold opacity-75">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div role="group" aria-labelledby="occ-label" className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 min-[821px]:mx-0 min-[821px]:flex-wrap min-[821px]:px-0">
            <span id="occ-label" className="mr-1 whitespace-nowrap text-[13px] font-bold text-muted-2">
              Occasion
            </span>
            {[{ slug: 'all' as const, name: 'All' }, ...occasions].map((o) => (
              <button key={o.slug} type="button" aria-pressed={occasion === o.slug} onClick={() => updateParams({ occasion: o.slug })} className={pillCls(occasion === o.slug, false)}>
                {o.name}
              </button>
            ))}
          </div>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              searchRef.current?.blur();
            }}
            className="relative flex min-h-[46px] max-w-[360px] flex-[1_1_260px] items-center gap-2.5 rounded-full border-[1.5px] border-line-2 bg-white px-4 focus-within:border-teal max-[560px]:max-w-none"
          >
            <Search className="flex-none text-muted-2" />
            <label htmlFor="shop-search" className="sr-only">
              Search products
            </label>
            <input
              ref={searchRef}
              id="shop-search"
              type="search"
              placeholder="Search products"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                updateParams({ q: e.target.value });
              }}
              className="min-h-10 w-full border-0 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-muted-2 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  updateParams({ q: '' });
                  searchRef.current?.focus();
                }}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-0 bg-transparent text-muted-2 hover:bg-cream hover:text-ink"
              >
                <Close size={16} />
              </button>
            )}
          </form>
        </div>
        <p className="mb-0 mt-1 text-sm text-muted-2" aria-live="polite" role="status">
          {resultText}
        </p>
      </section>

      <section className="container-page pb-[120px]" aria-label="Products">
        {state.status === 'loading' && (
          <div className={gridClass}>
            {Array.from({ length: 8 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <div className="rounded-[28px] bg-white px-5 py-16 text-center">
            <p className="m-0 text-muted-2">Products could not be loaded. Please refresh the page.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn mt-6 min-h-[50px] rounded-full border-0 bg-ink px-[26px] font-bold text-white">
              Refresh
            </button>
          </div>
        )}

        {state.status === 'ready' && shown.length > 0 && (
          <div className={gridClass}>
            {shown.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} priority={i < 2} />
            ))}
          </div>
        )}

        {state.status === 'ready' && shown.length === 0 && (
          <div className="rounded-[28px] bg-white px-5 py-20 text-center">
            <h2 className="m-0 font-serif text-[40px] font-medium">
              Nothing here <em>yet.</em>
            </h2>
            <p className="mb-6 mt-3 text-muted-2">Try another category or occasion — or ask us for a custom piece.</p>
            <button type="button" onClick={reset} className="btn btn-primary min-h-[50px] rounded-full border-0 bg-ink px-[26px] text-[15px] font-bold text-white">
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  );
}
