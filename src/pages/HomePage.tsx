import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Seo } from '../lib/seo';
import { absoluteUrl, contactLink, site } from '../config/site';
import { categories, getProductById, products, type Product } from '../data/catalog';
import { bestSellers, categoryPanels, instagramTiles, workshops } from '../data/home';
import { Picture } from '../components/Picture';
import { ProductCard } from '../components/ProductCard';
import { ArrowRight } from '../components/Icons';
import { useTabs } from '../lib/useTabs';
import { plural } from '../lib/format';

const btnBase = 'btn inline-flex items-center gap-2.5 rounded-full font-bold no-underline';

export function HomePage() {
  const sameAs = [site.instagramUrl, site.facebookUrl].filter(Boolean);
  return (
    <>
      <Seo
        title={`${site.name} — Handmade resin art, board games & home decor in Egypt`}
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: site.name,
            description: site.description,
            url: site.url,
            logo: absoluteUrl('/apple-touch-icon.png'),
            image: absoluteUrl(site.ogImage),
            address: { '@type': 'PostalAddress', addressCountry: 'EG' },
            currenciesAccepted: site.currency,
            sameAs,
          },
          { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: site.url },
        ]}
      />
      <Hero />
      <Marquee />
      <Collections />
      <BestSellers />
      <BoardGames />
      <Workshops />
      <CustomGifts />
      <InstagramStrip />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="container-page relative pb-24 pt-10 max-[560px]:pb-16 max-[560px]:pt-4" aria-labelledby="hero-title">
      <div
        aria-hidden="true"
        className="morph pointer-events-none absolute -right-[220px] -top-[160px] h-[620px] w-[620px] blur-[10px] [background:radial-gradient(circle_at_40%_40%,rgba(79,209,197,.28),rgba(79,209,197,0)_65%)]"
      />
      <div className="relative grid items-center gap-10 min-[981px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow rise d1 mb-[22px] inline-flex items-center gap-2.5">
            <span className="h-0.5 w-[34px] bg-teal" />
            Handmade home decor
          </p>
          <h1 id="hero-title" className="rise-lcp d1 m-0 font-serif text-[clamp(48px,6.2vw,96px)] font-medium leading-[.95] tracking-[-.02em]">
            Art you can <em className="goldline-light italic">hold,</em>
            <br />
            poured by hand.
          </h1>
          <p className="rise-lcp d2 mt-7 max-w-[500px] text-lg leading-[1.65] text-muted max-[560px]:text-base">
            Resin, wood, macramé and candle pieces, plus heirloom board games — every one made in small batches, and every one ready to carry your name.
          </p>
          <div className="rise d4 mt-[38px] flex flex-wrap gap-3.5">
            <Link to="/shop" className={`${btnBase} btn-primary min-h-14 bg-teal-btn px-[30px] text-base text-white hover:text-white`}>
              Shop now <ArrowRight />
            </Link>
            <Link to="/#workshops" className={`${btnBase} btn-ghost min-h-14 border-[1.5px] border-ink bg-transparent px-[30px] text-base text-ink`}>
              Book a workshop
            </Link>
          </div>
          <div className="rise d5 m-0 mt-14 flex flex-wrap gap-11 max-[560px]:mt-10 max-[560px]:grid max-[560px]:grid-cols-3 max-[560px]:gap-3">
            {[
              ['600+', 'pieces shared'],
              ['5', 'crafts, one studio'],
              ['4', 'hands-on workshops'],
            ].map(([n, l], i) => (
              <div key={l} className="flex gap-11 max-[560px]:min-w-0 max-[560px]:gap-3">
                {i > 0 && <span aria-hidden="true" className="w-px flex-none bg-line" />}
                <div className="flex min-w-0 flex-col-reverse">
                  <span className="mt-1.5 text-[13px] text-muted-2 max-[560px]:text-xs">{l}</span>
                  <span className="font-serif text-[44px] font-semibold leading-none max-[560px]:text-[34px]">{n}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <ResinPour />
      </div>
    </section>
  );
}

const flecks: [size: number, left: string, top: string, delay: string][] = [
  [14, '26%', '34%', '0s'],
  [9, '62%', '22%', '-1.2s'],
  [18, '70%', '58%', '-2.1s'],
  [7, '40%', '72%', '-.6s'],
  [11, '18%', '60%', '-2.8s'],
  [6, '50%', '45%', '-1.7s'],
  [12, '80%', '40%', '-3.1s'],
];

/** The animated resin disc composition. Sized in container units so it scales down on phones. */
function ResinPour() {
  return (
    <div className="rise d3 mx-auto w-full max-w-[560px] [container-type:inline-size]">
      <div className="relative aspect-[560/600] w-full">
        <div className="absolute left-1/2 top-1/2 h-[82cqw] w-[82cqw] -translate-x-1/2 -translate-y-1/2">
          <div aria-hidden="true" className="absolute inset-[30px_-10px_-30px_10px] rounded-full bg-[rgba(11,46,51,.28)] blur-[40px]" />
          <div
            aria-hidden="true"
            className="morph absolute inset-0 overflow-hidden shadow-[inset_0_0_0_10px_rgba(255,255,255,.55),inset_0_0_50px_rgba(255,255,255,.35)] [background:radial-gradient(circle_at_32%_30%,#A6F0E6_0%,#3CC7BA_22%,#128E91_45%,#0B5560_68%,#072B33_100%)]"
          >
            <div className="swirl absolute -inset-[30%] mix-blend-soft-light [background:conic-gradient(from_20deg,rgba(255,255,255,0)_0deg,rgba(255,255,255,.55)_18deg,rgba(255,255,255,0)_40deg,rgba(7,43,51,.45)_110deg,rgba(255,255,255,0)_150deg,rgba(212,175,90,.55)_200deg,rgba(255,255,255,0)_230deg,rgba(255,255,255,.4)_300deg,rgba(255,255,255,0)_330deg)]" />
            <div className="swirl-rev absolute -inset-[20%] [background:radial-gradient(ellipse_30%_12%_at_30%_60%,rgba(255,255,255,.8),rgba(255,255,255,0)_70%),radial-gradient(ellipse_22%_9%_at_70%_35%,rgba(255,255,255,.7),rgba(255,255,255,0)_70%),radial-gradient(ellipse_18%_6%_at_55%_80%,rgba(243,222,158,.9),rgba(243,222,158,0)_70%)]" />
            {flecks.map(([s, l, t, d], i) => (
              <div key={i} className="fleck" style={{ width: s, height: s, left: l, top: t, animationDelay: d }} />
            ))}
            <div className="absolute left-[14%] top-[9%] h-[22%] w-[42%] -rotate-[24deg] rounded-full [background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,0))]" />
          </div>
        </div>

        <div className="float absolute left-0 top-[6.7%] h-[30cqw] w-[30cqw] overflow-hidden rounded-full border-[6px] border-white shadow-float [--r:-6deg]">
          <Picture src="/images/legacy-crops/coaster2.jpg" alt="Teal resin coasters with gold leaf" sizes="170px" priority className="h-full w-full" />
        </div>
        <div className="float b absolute bottom-[6%] right-0 h-[42cqw] w-[35cqw] overflow-hidden rounded-[26px] border-[6px] border-white shadow-float [--r:5deg] max-[560px]:rounded-[18px]">
          <Picture src="/images/products/4c968890.jpg" alt="Pearl and gold resin chess set" sizes="(min-width: 981px) 200px, 36vw" priority className="h-full w-full" />
        </div>
        <div className="float c absolute bottom-[1.6%] left-[5%] flex items-center gap-3 rounded-[18px] bg-white px-[18px] py-3.5 shadow-[0_20px_40px_-18px_rgba(11,46,51,.4)] [--r:-3deg] max-[560px]:px-3 max-[560px]:py-2.5">
          <span aria-hidden="true" className="block h-[38px] w-[38px] flex-none rounded-full [background:conic-gradient(#14A3A0,#4FD1C5,#D4AF5A,#14A3A0)] max-[560px]:h-7 max-[560px]:w-7" />
          <span className="text-[13px] leading-[1.35] max-[560px]:text-xs">
            <strong className="block text-sm max-[560px]:text-[13px]">Personalised</strong>
            <span className="text-muted-2">names, colours, dates</span>
          </span>
        </div>

        <div aria-hidden="true" className="absolute right-[6.4%] top-[1.7%] flex h-[23.5cqw] w-[23.5cqw] items-center justify-center rounded-full bg-ink">
          <svg className="spin-badge absolute inset-0 h-full w-full" viewBox="0 0 132 132">
            <defs>
              <path id="badge-path" d="M66 66 m-48 0 a48 48 0 1 1 96 0 a48 48 0 1 1 -96 0" />
            </defs>
            <text fill="#F3DE9E" fontFamily="Manrope, sans-serif" fontSize="11.5" fontWeight="700" letterSpacing="3.4">
              <textPath href="#badge-path">HANDMADE • ONE OF A KIND • </textPath>
            </text>
          </svg>
          <span className="font-script text-[6cqw] text-gold-light">C</span>
        </div>
      </div>
    </div>
  );
}

function Marquee() {
  const words = ['Resin', 'Candles', 'Decoupage', 'Board games', 'Macramé', 'Ramadan & Eid', 'Custom gifts'];
  const row = words.flatMap((w) => [
    <span key={w}>{w}</span>,
    <span key={`${w}-s`} className="text-gold">
      ✦
    </span>,
  ]);
  return (
    <div aria-hidden="true" className="-mx-5 -rotate-[1.2deg] overflow-hidden bg-ink py-[22px] text-cream max-[560px]:py-4">
      <div className="marquee-track flex w-max gap-12 whitespace-nowrap font-serif text-[34px] italic max-[560px]:gap-8 max-[560px]:text-[26px]">
        {row}
        {words.flatMap((w) => [
          <span key={`b-${w}`}>{w}</span>,
          <span key={`b-${w}-s`} className="text-gold">
            ✦
          </span>,
        ])}
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, aside, id }: { eyebrow: string; title: ReactNode; aside?: ReactNode; id: string }) {
  return (
    <div className="reveal mb-[52px] flex flex-wrap items-end justify-between gap-8 max-[560px]:mb-8">
      <div>
        <p className="eyebrow mb-3.5">{eyebrow}</p>
        <h2 id={id} className="m-0 font-serif text-[clamp(38px,5vw,68px)] font-medium leading-none tracking-[-.01em]">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

function Collections() {
  const [sel, setSel] = useState(0);
  const { listProps, tabProps } = useTabs(categoryPanels.length, sel, setSel);
  const c = categoryPanels[sel];
  const count = categories.find((x) => x.slug === c.slug)?.count ?? 0;

  return (
    <section id="collections" className="container-page scroll-mt-4 pb-[110px] pt-[130px] max-[560px]:pb-20 max-[560px]:pt-24" aria-labelledby="collections-title">
      <SectionHead
        id="collections-title"
        eyebrow="Shop by category"
        title={
          <>
            Five materials.
            <br />
            <em>One steady hand.</em>
          </>
        }
        aside={
          <p className="m-0 max-w-[380px] text-base leading-[1.7] text-muted">
            From glossy ocean coasters to hand-poured candles — pieces for your table, your shelf and the people you love.
          </p>
        }
      />
      <div className="reveal grid items-stretch gap-7 min-[981px]:grid-cols-[320px_minmax(0,1fr)]">
        <div {...listProps} aria-label="Shop by category" className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 min-[981px]:mx-0 min-[981px]:flex-col min-[981px]:overflow-visible min-[981px]:px-0">
          {categoryPanels.map((p, i) => {
            const on = i === sel;
            const n = categories.find((x) => x.slug === p.slug)?.count ?? 0;
            return (
              <button
                key={p.slug}
                type="button"
                id={`cat-tab-${p.slug}`}
                aria-controls="cat-panel"
                {...tabProps(i)}
                className={`cattab flex min-h-[88px] min-w-[200px] flex-none items-center justify-between gap-4 rounded-[22px] border-[1.5px] px-6 text-left min-[981px]:min-w-0 ${
                  on ? 'border-ink bg-ink text-cream' : 'border-line-2 bg-white text-ink'
                }`}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="font-serif text-[30px] font-medium leading-none">{p.name}</span>
                  <span className="text-[13px] opacity-80">{plural(n, 'product')}</span>
                </span>
                <ArrowRight size={20} />
              </button>
            );
          })}
        </div>

        <div
          id="cat-panel"
          role="tabpanel"
          aria-labelledby={`cat-tab-${c.slug}`}
          className="on-dark relative grid min-h-[540px] overflow-hidden rounded-[32px] bg-ink text-cream min-[981px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] max-[560px]:rounded-[24px]"
        >
          <div className="zoom relative min-h-[300px] overflow-hidden bg-sand-2">
            <Picture key={c.img} src={c.img} alt={c.alt} sizes="(min-width: 981px) 420px, 100vw" className="absolute inset-0 h-full w-full" />
            <span dir="rtl" lang="ar" className="absolute right-[18px] top-[18px] rounded-full bg-cream/95 px-4 py-2 font-ar text-base font-bold text-ink">
              {c.ar}
            </span>
          </div>
          <div className="flex flex-col gap-[18px] px-10 py-11 max-[560px]:px-6 max-[560px]:py-8">
            <span className="text-xs font-bold uppercase tracking-[.22em] text-teal-light">{plural(count, 'product')}</span>
            <h3 className="m-0 font-serif text-[56px] font-medium leading-[.95] max-[560px]:text-[44px]">{c.name}</h3>
            <p className="m-0 text-base leading-[1.7] text-mist">{c.desc}</p>
            <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-2.5 p-0" aria-label={`${c.name} includes`}>
              {c.subs.map((s) => (
                <li key={s}>
                  <Link
                    to={`/shop/${c.slug}`}
                    className="chip inline-flex min-h-11 items-center rounded-full border-[1.5px] border-cream/30 px-[18px] text-sm font-semibold text-cream no-underline"
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to={`/shop/${c.slug}`}
              className={`${btnBase} mt-auto min-h-[54px] self-start bg-gold px-7 text-ink hover:bg-gold-light hover:text-ink`}
            >
              Shop all {c.name} <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function BestSellers() {
  const items = bestSellers
    .map((b) => ({ p: getProductById(b.id), meta: b.meta }))
    .filter((x): x is { p: Product; meta: string } => !!x.p);
  return (
    <section id="shop" className="container-page pb-[120px] pt-5 max-[560px]:pb-20" aria-labelledby="best-title">
      <div className="reveal mb-9 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3.5">Shop online</p>
          <h2 id="best-title" className="m-0 font-serif text-[clamp(36px,4.5vw,60px)] font-medium leading-none">
            Best sellers, <em>ready to ship.</em>
          </h2>
        </div>
        <Link to="/shop" className="text-[15px] font-bold">
          View all {products.length} products →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 min-[561px]:gap-5 min-[981px]:grid-cols-4">
        {items.map(({ p, meta }, i) => (
          <ProductCard key={p.id} product={p} meta={meta} heading="h3" index={i} />
        ))}
      </div>
      <ul className="reveal m-0 mt-7 flex list-none flex-wrap justify-center gap-x-7 gap-y-2 p-0 text-sm font-semibold text-muted">
        <li>✦ Card, wallet or cash on delivery</li>
        <li>✦ Delivery across Egypt</li>
        <li>✦ Gift wrapping at checkout</li>
      </ul>
    </section>
  );
}

const XO_MARKS = ['x', 'o', 'x', '', 'x', 'o', 'o', '', 'x'];

function BoardGames() {
  return (
    <section id="games" className="on-dark relative scroll-mt-4 overflow-clip bg-ink text-cream" aria-labelledby="games-title">
      <div aria-hidden="true" className="morph pointer-events-none absolute -bottom-[340px] -left-[260px] h-[700px] w-[700px] [background:radial-gradient(circle,rgba(20,163,160,.45),rgba(20,163,160,0)_65%)]" />
      <div className="container-page relative grid items-center gap-16 py-[120px] min-[981px]:grid-cols-2 max-[560px]:gap-12 max-[560px]:py-20">
        <div className="reveal relative h-[480px] max-[560px]:h-[380px]">
          <div className="absolute inset-[0_60px_40px_0] overflow-hidden rounded-[32px] max-[560px]:inset-[0_30px_50px_0] max-[560px]:rounded-[24px]">
            <Picture src="/images/products/f5fbe12d.jpg" alt="Five glitter resin tic-tac-toe boards" sizes="(min-width: 981px) 520px, 90vw" className="h-full w-full" />
          </div>
          <div aria-hidden="true" className="absolute bottom-0 right-0 w-[230px] rounded-[26px] bg-cream p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.6)] max-[560px]:w-[180px] max-[560px]:p-4">
            <div className="grid grid-cols-3 gap-2">
              {XO_MARKS.map((m, i) => (
                <div key={i} className="flex aspect-square items-center justify-center rounded-xl bg-teal-mist">
                  {m === 'x' && (
                    <svg className="pop" style={{ animationDelay: `${0.6 + i * 0.35}s` }} width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#14A3A0" strokeWidth="3.4" strokeLinecap="round">
                      <path d="M5 5l14 14M19 5L5 19" />
                    </svg>
                  )}
                  {m === 'o' && (
                    <svg className="pop" style={{ animationDelay: `${0.6 + i * 0.35}s` }} width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#B8913A" strokeWidth="3.4">
                      <circle cx="12" cy="12" r="7.5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="reveal">
          <p className="eyebrow mb-3.5 text-teal-light">Board games collection</p>
          <h2 id="games-title" className="m-0 font-serif text-[clamp(40px,5vw,72px)] font-medium leading-none">
            Game night,
            <br />
            <em className="goldline">but make it art.</em>
          </h2>
          <p className="mt-[26px] max-w-[470px] text-[17px] leading-[1.7] text-mist">
            Heirloom-weight sets in poured resin — made to live on the coffee table long after the last round.
          </p>
          <ul className="m-0 mt-9 flex list-none flex-col gap-0.5 p-0">
            {[
              ['XO', 'Tic-tac-toe in any colourway'],
              ['Domino', 'Amber, ocean & marble sets'],
              ['Chess', 'Poured board, sculpted pieces'],
            ].map(([n, d]) => (
              <li key={n} className="flex items-center justify-between gap-4 border-b border-cream/15 py-5">
                <span className="font-serif text-[30px]">{n}</span>
                <span className="text-right text-sm text-mist-2">{d}</span>
              </li>
            ))}
          </ul>
          <Link to="/shop/gaming" className={`${btnBase} mt-9 min-h-[54px] bg-gold px-7 text-ink hover:bg-gold-light hover:text-ink`}>
            Shop board games <ArrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Workshops() {
  const [sel, setSel] = useState(0);
  const { listProps, tabProps } = useTabs(workshops.length, sel, setSel);
  const w = workshops[sel];
  const book = contactLink(`Hi Coco! I'd like to book the ${w.name} workshop. Which dates are available?`);

  return (
    <section id="workshops" className="container-page scroll-mt-4 pb-[110px] pt-[130px] max-[560px]:pb-20 max-[560px]:pt-24" aria-labelledby="workshops-title">
      <div className="reveal mx-auto mb-14 max-w-[760px] text-center max-[560px]:mb-10">
        <p dir="rtl" lang="ar" className="m-0 font-ar text-[26px] font-bold text-teal-dark">
          ورش إبداعية
        </p>
        <h2 id="workshops-title" className="mb-0 mt-2 font-serif text-[clamp(40px,5vw,72px)] font-medium leading-none">
          Let's get <em>creative.</em>
        </h2>
        <p className="mx-auto mt-[22px] max-w-[560px] text-[17px] leading-[1.7] text-muted">
          Two creative days, one week apart — you learn and pour on day one, let it cure, then come back to finish your piece.
        </p>
      </div>

      <div {...listProps} aria-label="Workshops" className="mb-10 flex flex-wrap justify-center gap-2.5">
        {workshops.map((x, i) => (
          <button
            key={x.id}
            type="button"
            id={`ws-tab-${x.id}`}
            aria-controls="ws-panel"
            {...tabProps(i)}
            className={`pill min-h-12 rounded-full border-[1.5px] px-6 text-[15px] font-bold max-[560px]:px-4 max-[560px]:text-sm ${
              i === sel ? 'border-ink bg-ink text-cream' : 'border-line bg-transparent text-ink'
            }`}
          >
            {x.name}
          </button>
        ))}
      </div>

      <div
        id="ws-panel"
        role="tabpanel"
        aria-labelledby={`ws-tab-${w.id}`}
        className="reveal grid items-center gap-12 rounded-[36px] bg-white p-7 shadow-[0_40px_80px_-50px_rgba(11,46,51,.45)] min-[981px]:grid-cols-2 max-[560px]:gap-6 max-[560px]:rounded-[26px] max-[560px]:p-3"
      >
        <div className="zoom relative h-[440px] overflow-hidden rounded-[24px] max-[560px]:h-[280px] max-[560px]:rounded-[18px]">
          <Picture key={w.img} src={w.img} alt={w.alt} sizes="(min-width: 981px) 560px, 100vw" className="h-full w-full" />
          <span className="absolute left-[18px] top-[18px] rounded-full bg-cream/95 px-3.5 py-2 text-[13px] font-bold">{w.tag}</span>
        </div>
        <div className="py-3 pr-5 max-[980px]:px-2 max-[560px]:pb-4 max-[560px]:pt-0">
          <p dir="rtl" lang="ar" className="m-0 text-left font-ar text-xl font-bold text-gold-dark">
            {w.ar}
          </p>
          <h3 className="mb-0 mt-1 font-serif text-[52px] font-medium leading-none max-[560px]:text-[40px]">{w.name}</h3>
          <p className="mt-[18px] text-base leading-[1.7] text-muted">{w.desc}</p>

          <ol className="m-0 mt-[34px] grid list-none grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] p-0">
            <li className="contents">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-btn font-bold text-white">1</span>
              <div className="pb-[18px]">
                <strong className="text-base">Day 1 — Learn &amp; create</strong>
                <p className="mb-0 mt-1 text-sm text-muted-2">{w.day1}</p>
              </div>
            </li>
            <li className="contents">
              <span aria-hidden="true" className="-mt-3.5 h-[46px] w-0.5 justify-self-center [background:repeating-linear-gradient(#B8913A_0_5px,transparent_5px_10px)]" />
              <div className="-mt-2.5 pb-3.5">
                <span className="text-[13px] font-bold uppercase tracking-[.08em] text-price">One week break — your piece cures</span>
              </div>
            </li>
            <li className="contents">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-bold text-white">2</span>
              <div>
                <strong className="text-base">Day 2 — Finish your project</strong>
                <p className="mb-0 mt-1 text-sm text-muted-2">{w.day2}</p>
              </div>
            </li>
          </ol>

          <div className="mt-[34px] flex flex-wrap items-center gap-3">
            <a href={book.href} target="_blank" rel="noopener noreferrer" className={`${btnBase} btn-primary min-h-[52px] bg-ink px-[26px] text-white hover:text-white`}>
              Book your seat <ArrowRight />
            </a>
            <span className="text-sm text-muted-2">Mix &amp; match courses — ask about special offers</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomGifts() {
  const steps = [
    ['01', 'Tell us the occasion', "Who it's for and when you need it"],
    ['02', 'Pick colours & details', 'Names, initials, dates, flowers, gold leaf'],
    ['03', 'We pour, cure & wrap it', 'Ready to gift, straight out of the box'],
  ];
  const ask = contactLink("Hi Coco! I'd like a personalised gift.");
  return (
    <section id="gifts" className="scroll-mt-4 [background:linear-gradient(180deg,#F7F3EC,#ECE3D3)]" aria-labelledby="gifts-title">
      <div className="container-page grid items-center gap-16 pb-[120px] pt-[110px] min-[981px]:grid-cols-2 max-[560px]:gap-12 max-[560px]:py-20">
        <div className="reveal">
          <p className="eyebrow mb-3.5">We customise your gifts</p>
          <h2 id="gifts-title" className="m-0 font-serif text-[clamp(40px,5vw,72px)] font-medium leading-none">
            A gift with
            <br />
            their <em className="font-script text-[1.15em] not-italic text-gold-dark">name</em> in it.
          </h2>
          <p className="mt-6 max-w-[470px] text-[17px] leading-[1.7] text-muted">
            Birthdays, weddings, Secret Santa or a full corporate event — tell us the moment and we'll pour it.
          </p>
          <ol className="m-0 mt-10 flex list-none flex-col gap-3.5 p-0">
            {steps.map(([n, t, d]) => (
              <li key={n} className="lift flex items-center gap-[18px] rounded-[20px] bg-white px-[22px] py-[18px]">
                <span aria-hidden="true" className="w-9 font-serif text-[34px] text-teal-dark">
                  {n}
                </span>
                <span>
                  <strong>{t}</strong>
                  <span className="mt-0.5 block text-sm text-muted-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={ask.href} target="_blank" rel="noopener noreferrer" className={`${btnBase} btn-primary min-h-[52px] bg-teal-btn px-[26px] text-white hover:text-white`}>
              Start a custom order <ArrowRight />
            </a>
            <Link to="/shop?occasion=personalised" className={`${btnBase} btn-ghost min-h-[52px] border-[1.5px] border-ink px-[26px] text-ink`}>
              Shop personalised
            </Link>
          </div>
        </div>
        <div className="reveal relative h-[600px] max-[560px]:h-[440px]">
          <div className="float absolute right-0 top-0 h-[88%] w-[78%] overflow-hidden rounded-[200px_200px_28px_28px] shadow-[0_40px_80px_-40px_rgba(11,46,51,.55)] [--r:3deg]">
            <Picture src="/images/products/1a615249.jpg" alt="Personalised resin notebook with an Arabic name in gold" sizes="(min-width: 981px) 450px, 78vw" className="h-full w-full" />
          </div>
          <div className="float b absolute bottom-0 left-0 aspect-square w-[46%] overflow-hidden rounded-full border-8 border-cream shadow-[0_30px_60px_-30px_rgba(11,46,51,.55)] [--r:-5deg]">
            <Picture src="/images/legacy-crops/bouquet.jpg" alt="Festive personalised bouquet with a name ribbon" sizes="260px" className="h-full w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

function InstagramStrip() {
  return (
    <section className="container-page py-[100px] max-[560px]:py-16" aria-labelledby="ig-title">
      <div className="reveal mb-8 flex flex-wrap items-center justify-between gap-5">
        <h2 id="ig-title" className="m-0 font-serif text-[44px] font-medium max-[560px]:text-[36px]">
          Fresh from the studio
        </h2>
        <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-[15px] font-bold">
          @{site.instagramHandle} →
        </a>
      </div>
      <ul className="reveal m-0 grid list-none grid-cols-3 gap-3 p-0 min-[981px]:grid-cols-6 max-[560px]:gap-2">
        {instagramTiles.map((t) => (
          <li key={t.img}>
            <a
              className="ig block aspect-square overflow-hidden rounded-[18px] max-[560px]:rounded-xl"
              href={site.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t.alt} — see more on Instagram`}
            >
              <Picture src={t.img} alt="" sizes="(min-width: 981px) 200px, 33vw" className="h-full w-full" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
