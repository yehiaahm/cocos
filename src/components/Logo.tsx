import { useId } from 'react';
import { Link } from 'react-router';

/** Brush-stroke "C" that draws itself on load, with the "Coco's / ART" logotype. */
export function Logo({ size = 54, animate = true }: { size?: number; animate?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <Link to="/" className="flex items-center gap-3 no-underline">
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" className="shrink-0">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4FD1C5" />
            <stop offset=".55" stopColor="#14A3A0" />
            <stop offset="1" stopColor="#0B4F5A" />
          </linearGradient>
          <filter id={`r${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={4} />
            <feDisplacementMap in="SourceGraphic" scale="9" />
          </filter>
        </defs>
        <circle cx="100" cy="100" r="96" fill="#fff" />
        <path
          className={animate ? 'draw-c' : undefined}
          d="M150 52 A66 66 0 1 0 156 140"
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth="30"
          strokeLinecap="round"
          filter={`url(#r${id})`}
        />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-script text-[30px] text-gold-dark">Coco's</span>{' '}
        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-[.32em] text-ink">Art</span>
      </span>
    </Link>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-baseline gap-2.5 ${className}`}>
      <span className="font-script text-[30px] text-gold-light">Coco's</span>
      <span className="text-[11px] font-bold uppercase tracking-[.3em] text-cream">Art</span>
    </span>
  );
}
