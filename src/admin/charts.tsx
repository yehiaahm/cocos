import { useEffect, useRef, useState } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/**
 * Single-series area chart with a crosshair tooltip. Time runs left → right.
 * One series, so no legend: the card title names the measure.
 */
export function AreaChart({
  points,
  format,
  label,
}: {
  points: { x: string; xLabel: string; y: number }[];
  format: (n: number) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 220;
  const pad = { t: 12, r: 8, b: 26, l: 44 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(0, ...points.map((p) => p.y)));
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
  const area = points.length ? `${line}L${x(points.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z` : '';
  const ticks = [0, max / 2, max];
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))));

  const onMove = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !points.length) return;
    const rel = clientX - box.left - pad.l;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round((rel / iw) * (points.length - 1)))));
  };

  const h = hover !== null ? points[hover] : null;
  return (
    <div ref={ref} dir="ltr" className="relative select-none">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={label}
          onMouseMove={(e) => onMove(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX)}
          onTouchMove={(e) => onMove(e.touches[0].clientX)}
          onTouchEnd={() => setHover(null)}
          className="block touch-pan-y"
        >
          <defs>
            <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#14A3A0" stopOpacity=".22" />
              <stop offset="1" stopColor="#14A3A0" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="#EDE8DE" strokeWidth="1" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7C8A8C" fontFamily="Manrope, sans-serif">
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <text key={p.x} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#7C8A8C" fontFamily="Tajawal, sans-serif">
                {p.xLabel}
              </text>
            ) : null,
          )}
          <path d={area} fill="url(#area-fill)" />
          <path d={line} fill="none" stroke="#0E7C79" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#0B2E33" strokeOpacity=".25" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(h.y)} r="5" fill="#0E7C79" stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-xl bg-ink px-3 py-2 text-center text-xs text-cream shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) - 60, 0), Math.max(0, width - 120)), width: 120 }}
          dir="rtl"
        >
          <div className="font-ar opacity-75">{h.xLabel}</div>
          <div className="mt-0.5 text-sm font-bold">{format(h.y)}</div>
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars (one hue — magnitude only). Values are printed, so colour is never the only cue. */
export function BarList({ rows, format }: { rows: { key: string; label: React.ReactNode; value: number; title: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((r) => (
        <li key={r.key} title={`${r.title}: ${format(r.value)}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="flex-none font-bold tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F1EEE7]">
            <div className="h-full rounded-full bg-[#0E7C79]" style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
