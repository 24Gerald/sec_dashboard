import React, { useId, useState } from 'react';

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];
export const seriesColor = (i: number) => SERIES[i % SERIES.length];

function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  return { tip, show: (x: number, y: number, content: React.ReactNode) => setTip({ x, y, content }), hide: () => setTip(null) };
}
function Tooltip({ tip }: { tip: { x: number; y: number; content: React.ReactNode } | null }) {
  if (!tip) return null;
  return <div className="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>;
}

export interface BarDatum { label: string; value: number; color?: string; sub?: string }
/** Horizontal bar chart with direct value labels (works when a color sits below contrast floor). */
export function BarChart({ data, height, unit = '', valueFmt }: { data: BarDatum[]; height?: number; unit?: string; valueFmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const rowH = 30;
  const h = height ?? data.length * rowH + 8;
  const labelW = 116;
  const { tip, show, hide } = useTooltip();
  const fmt = valueFmt ?? ((n: number) => `${n}${unit}`);
  return (
    <div className="viz">
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ height: h }} role="img">
        {data.map((d, i) => {
          const y = i * rowH + 4;
          const w = (d.value / max) * (100 - labelW / 6 - 10);
          const bw = Math.max(0.6, w);
          return (
            <g key={i}>
              <text x="0" y={y + rowH / 2} dominantBaseline="middle" className="label" style={{ fontSize: 4.6 }}>{d.label.length > 20 ? d.label.slice(0, 19) + '…' : d.label}</text>
              <rect x={labelW / 6} y={y + 4} width={100 - labelW / 6 - 8} height={rowH - 12} fill="var(--bg-3)" rx="1.5" opacity="0.4" />
              <rect x={labelW / 6} y={y + 4} width={bw} height={rowH - 12} fill={d.color ?? seriesColor(i)} rx="1.5"
                onMouseMove={(e) => show(e.nativeEvent.offsetX, e.nativeEvent.offsetY, <><div className="tooltip__title">{d.label}</div><div className="tooltip__row"><span>{d.sub ?? 'Value'}</span><b>{fmt(d.value)}</b></div></>)} onMouseLeave={hide} style={{ cursor: 'default' }} />
              <text x={labelW / 6 + bw + 1.5} y={y + rowH / 2} dominantBaseline="middle" className="label--strong" style={{ fontSize: 4.6 }}>{fmt(d.value)}</text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export interface LinePoint { label: string; [k: string]: string | number }
export interface LineSeries { key: string; label: string; color: string }
/** Multi-series line chart with crosshair + tooltip and a legend. */
export function LineChart({ data, series, height = 220, unit = '', area }: { data: LinePoint[]; series: LineSeries[]; height?: number; unit?: string; area?: boolean }) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, padL = 34, padR = 16, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const niceMax = niceCeil(max);
  const x = (i: number) => padL + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / niceMax) * ih;
  const ticks = 4;
  return (
    <div className="viz">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - padL) / iw) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}>
        {Array.from({ length: ticks + 1 }, (_, t) => {
          const v = (niceMax / ticks) * t;
          return <g key={t}><line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="grid-line" /><text x={padL - 4} y={y(v)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: 10 }}>{fmtShort(v)}{unit}</text></g>;
        })}
        {data.map((d, i) => (i % Math.ceil(data.length / 12 || 1) === 0) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" style={{ fontSize: 10 }}>{d.label}</text>)}
        {series.map((s) => {
          const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key]) || 0)}`).join(' ');
          return (
            <g key={s.key}>
              {area && <polygon points={`${padL},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}`} fill={s.color} opacity="0.08" />}
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="3 3" />
            {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r="3.5" fill="var(--bg-1)" stroke={s.color} strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: 8 }}>
          <div className="tooltip__title">{data[hover].label}</div>
          {series.map((s) => <div key={s.key} className="tooltip__row"><span className="legend__item"><span className="swatch" style={{ background: s.color }} />{s.label}</span><b>{Number(data[hover][s.key]) || 0}{unit}</b></div>)}
        </div>
      )}
      {series.length > 1 && <div className="legend">{series.map((s) => <span key={s.key} className="legend__item"><span className="swatch swatch--line" style={{ background: s.color }} />{s.label}</span>)}</div>}
      <span id={gid} className="sr-only" />
    </div>
  );
}

export interface DonutSlice { label: string; value: number; color: string }
export function Donut({ data, size = 160, thickness = 22, center }: { data: DonutSlice[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const { tip, show, hide } = useTooltip();
  return (
    <div className="viz row gap-16" style={{ alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={thickness} />
          {total > 0 && data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * circ;
            const el = (
              <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${c} ${c})`}
                onMouseMove={(e) => show(e.nativeEvent.offsetX, e.nativeEvent.offsetY, <><div className="tooltip__title">{d.label}</div><div className="tooltip__row"><span>{Math.round(frac * 100)}%</span><b>{d.value}</b></div></>)} onMouseLeave={hide} style={{ cursor: 'default' }} />
            );
            offset += dash;
            return el;
          })}
        </svg>
        {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{center}</div>}
      </div>
      <div className="legend" style={{ flexDirection: 'column', gap: 6 }}>
        {data.map((d) => <span key={d.label} className="legend__item"><span className="swatch" style={{ background: d.color }} />{d.label} <b className="num" style={{ marginLeft: 4 }}>{d.value}</b></span>)}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Radial gauge for a 0..100 score. */
export function Gauge({ value, label, size = 150, color }: { value: number; label?: string; size?: number; color?: string }) {
  const r = size / 2 - 12;
  const c = size / 2;
  const circ = Math.PI * r; // semicircle
  const frac = Math.min(1, Math.max(0, value / 100));
  const col = color ?? (value >= 75 ? 'var(--crit)' : value >= 50 ? 'var(--serious)' : value >= 25 ? 'var(--warn)' : 'var(--good)');
  return (
    <div className="viz" style={{ width: size, textAlign: 'center' }}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <path d={`M12 ${c} A ${r} ${r} 0 0 1 ${size - 12} ${c}`} fill="none" stroke="var(--bg-3)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M12 ${c} A ${r} ${r} 0 0 1 ${size - 12} ${c}`} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${frac * circ} ${circ}`} />
        <text x={c} y={c - 6} textAnchor="middle" style={{ fontSize: size * 0.22, fontWeight: 800, fill: 'var(--ink-1)' }} className="num">{Math.round(value)}</text>
      </svg>
      {label && <div className="text-xs muted" style={{ marginTop: -6 }}>{label}</div>}
    </div>
  );
}

/** Stacked-segment horizontal bars for grouped severity across categories. */
export function StackedBars({ rows, keys, colors, labels }: { rows: { label: string; values: Record<string, number>; href?: string }[]; keys: string[]; colors: Record<string, string>; labels: Record<string, string> }) {
  const max = Math.max(1, ...rows.map((r) => keys.reduce((s, k) => s + (r.values[k] || 0), 0)));
  const { tip, show, hide } = useTooltip();
  return (
    <div className="viz">
      <div className="col gap-8">
        {rows.map((r, i) => {
          const total = keys.reduce((s, k) => s + (r.values[k] || 0), 0);
          return (
            <div key={i} className="kpi-row" style={{ gridTemplateColumns: '150px 1fr 40px', alignItems: 'center' }}>
              <span className="text-sm truncate" title={r.label}>{r.label}</span>
              <div className="progress" style={{ width: `${Math.max(6, (total / max) * 100)}%`, minWidth: 6 }}>
                {keys.map((k) => (r.values[k] || 0) > 0 && (
                  <span key={k} style={{ width: `${((r.values[k] || 0) / total) * 100}%`, background: colors[k] }}
                    onMouseMove={(e) => show(e.nativeEvent.offsetX + (e.currentTarget.parentElement?.offsetLeft ?? 0) + 150, e.nativeEvent.offsetY + i * 24, <><div className="tooltip__title">{r.label}</div><div className="tooltip__row"><span className="legend__item"><span className="swatch" style={{ background: colors[k] }} />{labels[k]}</span><b>{r.values[k]}</b></div></>)} onMouseLeave={hide} />
                ))}
              </div>
              <span className="text-sm num right">{total}</span>
            </div>
          );
        })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
function fmtShort(n: number): string { return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(Math.round(n)); }

/** Tiny sparkline for stat tiles. */
export function Sparkline({ values, color = 'var(--accent)', width = 64, height = 22 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
