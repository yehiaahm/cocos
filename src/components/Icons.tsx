import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, sw: number | string = 2) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
});

export const ArrowRight = ({ size = 18, ...p }: P) => (
  <svg {...base(size, 2.2)} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ArrowLeft = ({ size = 18, ...p }: P) => (
  <svg {...base(size, 2.2)} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const Bag = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 7h12l-1 13H7z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);
export const Close = ({ size = 18, ...p }: P) => (
  <svg {...base(size, 2.2)} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const Menu = ({ size = 20, ...p }: P) => (
  <svg {...base(size, 2.2)} {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);
export const ChevronUp = ({ size = 16, ...p }: P) => (
  <svg {...base(size, 2.4)} {...p}>
    <path d="M18 15l-6-6-6 6" />
  </svg>
);
export const Check = ({ size = 18, ...p }: P) => (
  <svg {...base(size, 2.6)} {...p}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
export const Search = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const WhatsApp = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);
export const Instagram = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
  </svg>
);
export const Facebook = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h3l.5-4H12V7.8c0-.6.4-1 1-1h2z" />
  </svg>
);
export const Copy = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
