import { Link } from 'react-router';
import { LogoBadge } from './Logo';
import { Facebook, Instagram, WhatsApp } from './Icons';
import { contactLink, site } from '../config/site';
import { categories } from '../data/catalog';

const year = new Date().getFullYear();

function SocialButtons() {
  const wa = contactLink("Hi Coco! I'd like to order a custom piece.");
  const cls =
    'btn inline-flex min-h-[58px] items-center gap-2.5 rounded-full px-[30px] font-bold no-underline max-[560px]:w-full max-[560px]:justify-center';
  return (
    <div className="reveal mt-12 flex flex-wrap gap-3.5">
      <a className={`${cls} bg-cream text-deep hover:bg-gold-light hover:text-deep`} href={wa.href} target="_blank" rel="noopener noreferrer">
        {wa.channel === 'whatsapp' ? <WhatsApp /> : <Instagram />}
        {wa.channel === 'whatsapp' ? 'Custom order on WhatsApp' : 'Custom order on Instagram'}
      </a>
      {wa.channel === 'whatsapp' && (
        <a className={`${cls} border-[1.5px] border-cream/50 text-cream hover:border-cream hover:text-cream`} href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
          <Instagram />
          Instagram
        </a>
      )}
      {site.facebookUrl && (
        <a className={`${cls} border-[1.5px] border-cream/50 text-cream hover:border-cream hover:text-cream`} href={site.facebookUrl} target="_blank" rel="noopener noreferrer">
          <Facebook />
          Facebook
        </a>
      )}
    </div>
  );
}

function FooterLinks() {
  return (
    <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-[.2em] text-gold-light">Shop</span>
        <Link to="/shop" className="text-mist-2 no-underline hover:text-cream">All products</Link>
        {categories.map((c) => (
          <Link key={c.slug} to={`/shop/${c.slug}`} className="text-mist-2 no-underline hover:text-cream">
            {c.name}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-[.2em] text-gold-light">Studio</span>
        <Link to="/#workshops" className="text-mist-2 no-underline hover:text-cream">Workshops</Link>
        <Link to="/#gifts" className="text-mist-2 no-underline hover:text-cream">Custom gifts</Link>
        <Link to="/#games" className="text-mist-2 no-underline hover:text-cream">Board games</Link>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-[.2em] text-gold-light">Follow</span>
        <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-mist-2 no-underline hover:text-cream">
          @{site.instagramHandle}
        </a>
        {site.facebookUrl && (
          <a href={site.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-mist-2 no-underline hover:text-cream">
            Facebook
          </a>
        )}
        <span className="text-mist-2">Delivery across {site.country}</span>
      </div>
    </nav>
  );
}

/** Big "poured just for you" CTA footer (homepage). */
export function CtaFooter() {
  return (
    <footer id="contact" className="on-dark relative overflow-clip bg-deep text-cream">
      <div aria-hidden="true" className="morph pointer-events-none absolute -right-[120px] -top-[180px] h-[520px] w-[520px] opacity-55 [background:radial-gradient(circle_at_35%_35%,#4FD1C5,#14A3A0_40%,#0B5560_75%)]" />
      <div aria-hidden="true" className="morph pointer-events-none absolute -bottom-[150px] left-[8%] h-[260px] w-[260px] opacity-50 [animation-delay:-5s] [background:radial-gradient(circle,#D4AF5A,rgba(212,175,90,0)_70%)]" />
      <div className="container-page relative pb-12 pt-[120px] max-[560px]:pt-20">
        <p className="reveal m-0 font-script text-[46px] text-gold-light max-[560px]:text-[36px]">Let's make something</p>
        <h2 className="reveal m-0 font-serif text-[clamp(54px,8vw,128px)] font-medium leading-[.92] tracking-[-.02em] max-[400px]:text-[46px]">
          poured <em>just for you.</em>
        </h2>
        <SocialButtons />
        <div className="mt-[90px] border-t border-cream/15 pt-10">
          <FooterLinks />
        </div>
        <FooterBar />
      </div>
    </footer>
  );
}

function FooterBar() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-cream/15 pt-7 text-sm text-mist-2">
      <LogoBadge />
      <span>Handmade board games · resin · wood &amp; decoupage · macramé · candles</span>
      <span className="flex flex-wrap items-center gap-4">
        <Link to="/privacy" className="text-mist-2 no-underline hover:text-cream">Privacy &amp; terms</Link>
        <span suppressHydrationWarning>© {year} {site.name}</span>
      </span>
    </div>
  );
}

/** Compact footer for inner pages. */
export function SiteFooter() {
  return (
    <footer className="on-dark bg-deep text-mist-2">
      <div className="container-page pb-9 pt-14">
        <FooterLinks />
        <FooterBar />
      </div>
    </footer>
  );
}
