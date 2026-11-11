import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Seo } from '../lib/seo';
import { getProductBySlug, getVariant, isPersonalised, occasions, relatedProducts } from '../data/catalog';
import { formatPrice } from '../lib/format';
import { useLiveProduct } from '../store/live';
import { imageUrl } from '../lib/images';
import { useAddToCart } from '../lib/useAddToCart';
import { useCart } from '../store/cart';
import { useUi } from '../store/ui';
import { absoluteUrl, contactLink, site } from '../config/site';
import { Picture } from '../components/Picture';
import { ProductCard, gridClass } from '../components/ProductCard';
import { QtyStepper } from '../components/CartDrawer';
import { ArrowLeft, Check, WhatsApp, Instagram } from '../components/Icons';
import { NotFoundPage } from './NotFoundPage';

export function ProductPage() {
  const { slug = '' } = useParams();
  const product = getProductBySlug(slug);
  if (!product) return <NotFoundPage />;
  // Keyed so all local state (gallery index, qty, text) resets between products.
  return <ProductView key={product.id} slug={slug} />;
}

function ProductView({ slug }: { slug: string }) {
  const p = getProductBySlug(slug)!;
  const [params, setParams] = useSearchParams();
  const variant = getVariant(p, params.get('variant'));
  const [imgIndex, setImgIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [text, setText] = useState('');
  const [added, setAdded] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const addToCart = useAddToCart();
  const live = useLiveProduct(p);
  const unavailable = live.hidden || live.soldOut;
  const openDrawer = useUi((s) => s.openDrawer);
  const inCartQty = useCart((s) => s.lines.filter((l) => l.productId === p.id).reduce((t, l) => t + l.qty, 0));
  const personalised = isPersonalised(p);
  const textId = useId();

  const images = variant.images.length ? variant.images : [p.image];
  const current = images[Math.min(imgIndex, images.length - 1)];
  useEffect(() => setImgIndex(0), [variant.catalogId]);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2200);
    return () => clearTimeout(t);
  }, [added]);

  const pickVariant = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('variant', id);
    setParams(next, { replace: true, preventScrollReset: true, state: { keepScroll: true } });
  };

  const onAdd = () => {
    addToCart({ productId: p.id, variantId: variant.catalogId, qty, personalisation: personalised ? text : undefined, image: current }, mainRef.current);
    setAdded(true);
  };

  const related = relatedProducts(p);
  const occasionNames = occasions.filter((o) => p.tags.includes(o.slug)).map((o) => o.name);
  const multi = p.variants.length > 1;
  const ask = contactLink(`Hi Coco! I'm interested in the ${p.name}${multi ? ` (${variant.name})` : ''}.`);
  const url = `/product/${p.slug}`;

  return (
    <>
      <Seo
        title={multi && params.get('variant') ? `${p.name} — ${variant.name}` : p.name}
        description={`${p.description} Handmade by ${site.name} in Egypt${multi ? ` — available in ${p.variants.length} options` : ''}.`}
        path={url}
        image={imageUrl(p.image, 1200)}
        type="product"
        jsonLd={[
          {
            // No `offers` until the owner sets prices (HANDOFF §11).
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.name,
            description: p.description,
            sku: p.id,
            category: p.categoryName,
            material: variant.material,
            image: [...new Set(p.variants.flatMap((v) => v.images))].slice(0, 6).map((i) => absoluteUrl(imageUrl(i, 1200))),
            brand: { '@type': 'Brand', name: site.name },
            url: absoluteUrl(url),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: site.url + '/' },
              { '@type': 'ListItem', position: 2, name: p.categoryName, item: `${site.url}/shop/${p.category}` },
              { '@type': 'ListItem', position: 3, name: p.name, item: absoluteUrl(url) },
            ],
          },
        ]}
      />

      <div className="container-page pb-6 pt-2">
        <nav aria-label="Breadcrumb">
          <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-sm font-semibold text-muted-2">
            <li>
              <Link to="/shop" className="inline-flex min-h-11 items-center gap-1.5 text-teal-dark no-underline hover:underline">
                <ArrowLeft size={16} /> Shop
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to={`/shop/${p.category}`} className="text-teal-dark no-underline hover:underline">
                {p.categoryName}
              </Link>
            </li>
            <li aria-hidden="true" className="max-[560px]:hidden">
              /
            </li>
            <li aria-current="page" className="max-[560px]:hidden">
              {p.name}
            </li>
          </ol>
        </nav>
      </div>

      <section className="container-page grid gap-12 pb-24 min-[900px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] max-[560px]:gap-8 max-[560px]:pb-16" aria-labelledby="product-title">
        {/* Gallery */}
        <div className="rise d1 flex flex-col gap-3.5 min-[900px]:sticky min-[900px]:top-6 min-[900px]:self-start">
          <div ref={mainRef} className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-skeleton shadow-soft max-[560px]:rounded-[20px]">
            <Picture key={current} src={current} alt={`${variant.name}${images.length > 1 ? ` — photo ${imgIndex + 1} of ${images.length}` : ''}`} sizes="(min-width: 1280px) 620px, (min-width: 900px) 50vw, calc(100vw - 32px)" priority className="h-full w-full [animation:fadeIn_.4s_ease]" />
            <span className="absolute left-4 top-4 rounded-full bg-cream/95 px-3.5 py-1.5 text-xs font-bold">{p.categoryName}</span>
          </div>
          {images.length > 1 && (
            <ul className="m-0 flex list-none gap-2.5 overflow-x-auto p-0 pb-1" aria-label="Photos">
              {images.map((src, i) => (
                <li key={src} className="flex-none">
                  <button
                    type="button"
                    onClick={() => setImgIndex(i)}
                    aria-label={`Show photo ${i + 1} of ${images.length}`}
                    aria-current={i === imgIndex}
                    className={`block h-[84px] w-[84px] overflow-hidden rounded-2xl border-[3px] bg-white p-0 transition-colors max-[560px]:h-[68px] max-[560px]:w-[68px] ${
                      i === imgIndex ? 'border-teal' : 'border-transparent hover:border-line'
                    }`}
                  >
                    <img src={imageUrl(src, 320)} alt="" width={84} height={84} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details */}
        <div className="rise d2 flex flex-col">
          <p className="eyebrow mb-3">
            <Link to={`/shop/${p.category}`} className="text-teal-dark no-underline hover:underline">
              {p.categoryName}
            </Link>
          </p>
          <h1 id="product-title" className="m-0 font-serif text-[clamp(38px,4.6vw,64px)] font-medium leading-[1] tracking-[-.01em]">
            {p.name}
          </h1>
          <p className="mb-0 mt-5 text-[22px] font-bold text-price">{formatPrice(live.price)}</p>
          {live.price === null && <p className="mb-0 mt-1 text-sm text-muted-2">Coco confirms the price with you before payment.</p>}
          {unavailable && (
            <p role="status" className="mb-0 mt-3 inline-flex self-start rounded-full bg-[#FBEAEA] px-4 py-2 text-sm font-bold text-[#7A1F1F]">
              {live.hidden ? 'This piece is no longer available.' : 'Sold out — message Coco to order it custom.'}
            </p>
          )}
          <p className="mb-0 mt-6 max-w-[540px] text-[17px] leading-[1.7] text-muted">{p.description}</p>

          <dl className="m-0 mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="font-bold">Material</dt>
            <dd className="m-0 text-muted-2">{variant.material}</dd>
            {occasionNames.length > 0 && (
              <>
                <dt className="font-bold">Occasion</dt>
                <dd className="m-0 text-muted-2">{occasionNames.join(', ')}</dd>
              </>
            )}
            <dt className="font-bold">Made</dt>
            <dd className="m-0 text-muted-2">By hand, in small batches — each piece is one of a kind</dd>
          </dl>

          {multi && (
            <fieldset className="m-0 mt-8 border-0 p-0">
              <legend className="mb-3 p-0 text-sm font-bold">
                Option: <span className="font-semibold text-muted-2">{variant.name}</span>
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {p.variants.map((v) => {
                  const on = v.catalogId === variant.catalogId;
                  return (
                    <label
                      key={v.catalogId}
                      className={`flex min-h-[60px] cursor-pointer items-center gap-2.5 rounded-2xl border-[1.5px] bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal ${
                        on ? 'border-ink' : 'border-line-2 hover:border-teal'
                      }`}
                    >
                      <input type="radio" name="variant" value={v.catalogId} checked={on} onChange={() => pickVariant(v.catalogId)} className="sr-only" />
                      <img src={imageUrl(v.images[0] ?? p.image, 320)} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 rounded-xl object-cover" />
                      <span className="max-w-[180px] leading-tight">{v.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {personalised && (
            <div className="mt-8">
              <label htmlFor={textId} className="mb-2 block text-sm font-bold">
                Name / text to add <span className="font-semibold text-muted-2">(optional)</span>
              </label>
              <input
                id={textId}
                type="text"
                value={text}
                maxLength={40}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Nour, or Mariam & Ali"
                aria-describedby={`${textId}-hint`}
                className="min-h-[50px] w-full max-w-[420px] rounded-2xl border-[1.5px] border-line-2 bg-white px-4 text-base text-ink outline-none placeholder:text-muted-2 focus:border-teal"
              />
              <p id={`${textId}-hint`} className="mb-0 mt-1.5 text-[13px] text-muted-2">
                Up to 40 characters, in English or Arabic. Coco will confirm the design with you.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} min={1} label={p.name} onChange={(n) => setQty(Math.max(1, n))} />
            <button
              type="button"
              onClick={onAdd}
              disabled={unavailable}
              className="btn btn-primary inline-flex min-h-[54px] flex-1 items-center justify-center gap-2.5 rounded-full border-0 bg-teal-btn px-8 text-base font-bold text-white disabled:bg-line disabled:text-muted-2 sm:flex-none"
            >
              {unavailable ? (
                'Sold out'
              ) : added ? (
                <>
                  <Check /> Added to cart
                </>
              ) : (
                'Add to cart'
              )}
            </button>
          </div>
          <p className="mb-0 mt-3 min-h-5 text-sm text-muted-2" role="status" aria-live="polite">
            {inCartQty > 0 && (
              <>
                {inCartQty} in your cart ·{' '}
                <button type="button" onClick={(e) => openDrawer(e.currentTarget)} className="border-0 bg-transparent p-0 font-bold text-teal-dark underline">
                  View cart
                </button>
              </>
            )}
          </p>

          <ul className="m-0 mt-8 flex list-none flex-col gap-2.5 rounded-[22px] bg-white p-5 text-sm text-muted">
            <li>✦ Delivery across Egypt</li>
            <li>✦ Card, wallet or cash on delivery — Coco confirms your total first</li>
            <li>✦ Gift wrapping available</li>
          </ul>
          <a href={ask.href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-bold">
            {ask.channel === 'whatsapp' ? <WhatsApp size={18} /> : <Instagram size={18} />}
            Questions or a custom colour? Message Coco
          </a>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-page pb-[120px]" aria-labelledby="related-title">
          <div className="reveal mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="related-title" className="m-0 font-serif text-[clamp(34px,4vw,52px)] font-medium leading-none">
              You may also <em>like.</em>
            </h2>
            <Link to={`/shop/${p.category}`} className="text-[15px] font-bold">
              All {p.categoryName} →
            </Link>
          </div>
          <div className={gridClass}>
            {related.map((r, i) => (
              <ProductCard key={r.id} product={r} heading="h3" index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
