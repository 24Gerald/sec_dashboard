export function fmtDate(iso?: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, opts);
}
export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
export function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}
export function daysBetween(a: string, b: string = new Date().toISOString()): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
export function relTime(iso?: string): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? 'ago' : 'from now';
  if (abs < 60) return `${Math.round(abs)}s ${suffix}`;
  if (abs < 3600) return `${Math.round(abs / 60)}m ${suffix}`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h ${suffix}`;
  if (abs < 86400 * 30) return `${Math.round(abs / 86400)}d ${suffix}`;
  if (abs < 86400 * 365) return `${Math.round(abs / (86400 * 30))}mo ${suffix}`;
  return `${(abs / (86400 * 365)).toFixed(1)}y ${suffix}`;
}
export function fmtNum(n: number | string | undefined, digits = 0): string {
  if (n === undefined || n === null) return '—';
  if (typeof n === 'string') return n;
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
export function fmtMoney(n?: number, currency = 'USD'): string {
  if (n === undefined) return '—';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return n.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
}
export function pct(n: number, d: number): string {
  if (!d) return '0%';
  return `${Math.round((n / d) * 100)}%`;
}
export function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export function humanKey(k: string): string {
  return k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
export function initials(name?: string): string {
  if (!name) return '?';
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
