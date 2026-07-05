'use client';
/**
 * Hand-rolled SVG charts — no chart library. Theme-aware (light/dark ink tokens).
 * Specs: 2px lines, area fill ~9% opacity, bars ≤24px with 4px rounded data-ends
 * (square at baseline), hairline gridlines, hover tooltips.
 */
import { useMemo, useRef, useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';

const INKS = {
  light: {
    muted: '#8a8880', grid: '#e9e8e3', baseline: '#c9c8c0',
    track: '#f0efeb', sparkBase: '#d6d4cd', ring: '#ffffff', emptyBar: '#e8e7e2',
  },
  dark: {
    muted: '#8a8880', grid: '#232329', baseline: '#3c3c43',
    track: '#232329', sparkBase: '#3f3f46', ring: '#131318', emptyBar: '#232329',
  },
};

// Fixed categorical order (validated palette) — light & dark steps from the reference instance
const CAT_LIGHT = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7'];
const CAT_DARK  = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9'];

function useInk() {
  const dark = useThemeStore((s) => s.dark);
  return { ink: dark ? INKS.dark : INKS.light, cat: dark ? CAT_DARK : CAT_LIGHT };
}

export function fmtMoney(n: number, currency = 'NPR') {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(v);
  return ticks;
}

const TOOLTIP_CLS =
  'pointer-events-none absolute rounded-lg bg-gray-900 dark:bg-zinc-800 dark:ring-1 dark:ring-white/10 text-white text-xs px-3 py-2 shadow-lg whitespace-nowrap z-10';

// ── Sparkline (stat tiles) ──────────────────────────────────────────────────
export function Sparkline({ points, color = 'var(--brand, #ea580c)', width = 96, height = 28 }: {
  points: number[]; color?: string; width?: number; height?: number;
}) {
  const { ink } = useInk();
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const x = (i: number) => (i / (points.length - 1)) * (width - 8) + 4;
  const y = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke={ink.sparkBase} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(points[last])} r="4" style={{ fill: color }} stroke={ink.ring} strokeWidth="2" />
    </svg>
  );
}

// ── Area chart (revenue over time) ──────────────────────────────────────────
export function AreaChart({ data, color = 'var(--brand, #ea580c)', height = 240, currency = 'NPR' }: {
  data: { label: string; value: number }[]; color?: string; height?: number; currency?: string;
}) {
  const { ink } = useInk();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, PAD_L = 46, PAD_R = 12, PAD_T = 12, PAD_B = 24;
  const plotW = W - PAD_L - PAD_R, plotH = height - PAD_T - PAD_B;

  const { max, ticks } = useMemo(() => {
    const m = Math.max(...data.map((d) => d.value), 1);
    const t = niceTicks(m);
    return { max: t[t.length - 1], ticks: t };
  }, [data]);

  if (!data.length) return <Empty height={height} />;
  const x = (i: number) => PAD_L + (i / Math.max(data.length - 1, 1)) * plotW;
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${PAD_L},${(PAD_T + plotH).toFixed(1)} Z`;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD_L) / plotW) * (data.length - 1));
    setHover(i >= 0 && i < data.length ? i : null);
  }

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke={t === 0 ? ink.baseline : ink.grid} strokeWidth="1" />
            <text x={PAD_L - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={ink.muted}>
              {t >= 1000 ? `${(t / 1000).toLocaleString()}K` : t.toLocaleString()}
            </text>
          </g>
        ))}
        {data.map((d, i) => ((i % 7 === 0 && data.length - 1 - i >= 4) || i === data.length - 1) && (
          <text key={d.label} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill={ink.muted}>
            {d.label.slice(5).replace('-', '/')}
          </text>
        ))}
        <path d={area} style={{ fill: color }} opacity="0.09" />
        <path d={line} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + plotH} stroke={ink.baseline} strokeWidth="1" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" style={{ fill: color }} stroke={ink.ring} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className={`${TOOLTIP_CLS} -translate-x-1/2`}
          style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}
        >
          <p className="text-gray-300 dark:text-zinc-300">{data[hover].label}</p>
          <p className="font-semibold">{fmtMoney(data[hover].value, currency)}</p>
        </div>
      )}
    </div>
  );
}

// ── Horizontal bars (top items) ─────────────────────────────────────────────
export function HBars({ items, color = 'var(--brand, #ea580c)', currency = 'NPR' }: {
  items: { label: string; value: number; sub?: string }[]; color?: string; currency?: string;
}) {
  const { ink } = useInk();
  if (!items.length) return <Empty height={180} />;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label} className="group">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-sm text-gray-700 dark:text-zinc-300 truncate pr-2">
              {it.label}{it.sub && <span className="text-xs text-gray-400 dark:text-zinc-400 ml-1.5">{it.sub}</span>}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 tabular-nums shrink-0">{fmtMoney(it.value, currency)}</p>
          </div>
          <div className="h-3.5 rounded-r" style={{ background: ink.track }}>
            <div
              className="h-full transition group-hover:opacity-80"
              style={{ width: `${Math.max((it.value / max) * 100, 2)}%`, background: color, borderRadius: '0 4px 4px 0' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Column chart (peak hours) ───────────────────────────────────────────────
export function Columns({ data, color = 'var(--brand, #ea580c)', height = 170, unit = 'sessions' }: {
  data: { label: string; value: number }[]; color?: string; height?: number; unit?: string;
}) {
  const { ink } = useInk();
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty height={height} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const plotH = height - 22;
  return (
    <div className="relative">
      <div className="flex items-end gap-[2px]" style={{ height: plotH }}>
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex-1 flex flex-col justify-end h-full cursor-default"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              style={{
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 1)}%`,
                background: d.value > 0 ? color : ink.emptyBar,
                opacity: hover === null || hover === i ? 1 : 0.45,
                borderRadius: '4px 4px 0 0',
                maxWidth: 24,
                margin: '0 auto',
                width: '100%',
                transition: 'opacity .1s',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex border-t mt-0 pt-1" style={{ borderColor: ink.baseline }}>
        {data.map((d, i) => (
          <p key={d.label} className="flex-1 text-center text-[10px]" style={{ color: ink.muted }}>
            {i % 4 === 0 ? d.label : ''}
          </p>
        ))}
      </div>
      {hover !== null && (
        <div
          className={`${TOOLTIP_CLS} -top-1 -translate-x-1/2 -translate-y-full`}
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          <p className="text-gray-300 dark:text-zinc-300">{data[hover].label}</p>
          <p className="font-semibold">{data[hover].value} {unit}</p>
        </div>
      )}
    </div>
  );
}

// ── Single stacked bar + legend (payment mix) ───────────────────────────────
// Fixed categorical order (validated palette); relief rule → values in legend.
export function StackedShare({ parts, currency = 'NPR' }: {
  parts: { label: string; value: number }[]; currency?: string;
}) {
  const { cat } = useInk();
  if (!parts.length || parts.every((p) => p.value === 0)) return <Empty height={90} />;
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div>
      <div className="flex h-6 rounded overflow-hidden" style={{ gap: 2 }}>
        {parts.map((p, i) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: cat[i % cat.length], minWidth: p.value > 0 ? 4 : 0 }} />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {parts.map((p, i) => (
          <div key={p.label} className="flex items-center gap-2.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: cat[i % cat.length] }} />
            <span className="text-gray-600 dark:text-zinc-300 flex-1">{p.label}</span>
            <span className="text-gray-900 dark:text-zinc-100 font-medium tabular-nums">{fmtMoney(p.value, currency)}</span>
            <span className="text-gray-400 dark:text-zinc-400 text-xs w-10 text-right tabular-nums">{Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-gray-400 dark:text-zinc-400" style={{ height }}>
      No data yet
    </div>
  );
}
