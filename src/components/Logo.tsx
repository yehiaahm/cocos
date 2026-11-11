import { Link } from 'react-router';
import { site } from '../config/site';
import logo160 from '../assets/brand/logo-160.webp';
import logo240 from '../assets/brand/logo-240.webp';
import logo320 from '../assets/brand/logo-320.webp';
import logo480 from '../assets/brand/logo-480.webp';

// Intrinsic size of the trimmed master logo (scripts/make-brand-assets.mjs) — keeps the box ratio exact.
const LOGO_W = 821;
const LOGO_H = 788;
const SRCSET = `${logo160} 160w, ${logo240} 240w, ${logo320} 320w, ${logo480} 480w`;

function LogoImage({ height, className = '', eager = false }: { height: number; className?: string; eager?: boolean }) {
  const width = Math.round((height * LOGO_W) / LOGO_H);
  return (
    <img
      src={logo320}
      srcSet={SRCSET}
      sizes={`${width}px`}
      width={width}
      height={height}
      alt={`${site.name} logo`}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      draggable={false}
      className={`block h-auto select-none ${className}`}
    />
  );
}

/** Header logo: the brand mark, revealed with a brush-sweep on load. */
export function Logo({ size = 100, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <Link to="/" aria-label={`${site.name} — home`} className="logo-link -my-3 flex shrink-0 items-center no-underline">
      <LogoImage
        height={size}
        eager
        className={`w-[104px] max-[560px]:w-[76px] ${animate ? 'logo-reveal' : ''}`}
      />
    </Link>
  );
}

/** Logo on a cream disc, for dark backgrounds (the mark was designed on white). */
export function LogoBadge({ size = 92, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-cream shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)] ring-1 ring-gold/40 ${className}`}
      style={{ width: size, height: size }}
    >
      <LogoImage height={Math.round(size * 0.78)} />
    </span>
  );
}
