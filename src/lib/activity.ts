/**
 * The rolling presentation window.
 *
 * The deck presents the last 7 days of work by default, so it doubles as a
 * record of what the team has actually been doing. A presenter can widen the
 * window for a specific session; that override is remembered for the rest of
 * the day only and falls back to 7 days tomorrow. The findings register itself
 * is never filtered — it always shows everything, with dates.
 */
import type { Dataset, Finding, Retest } from '@/types';
import { todayISO } from './format';
import { SEVERITY_ORDER } from './severity';
import { isResolved } from './metrics';

export const DEFAULT_WINDOW_DAYS = 7;
/** `null` means "everything, no window". */
export type WindowDays = number | null;
export const WINDOW_OPTIONS: { days: WindowDays; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: null, label: 'All time' },
];

const WINDOW_KEY = 'ark.present.window';

export function windowLabel(days: WindowDays): string {
  return WINDOW_OPTIONS.find((o) => o.days === days)?.label ?? `Last ${days} days`;
}

/** First day inside the window (inclusive), as yyyy-mm-dd. */
export function windowStart(days: WindowDays, now = new Date()): string {
  if (days === null) return '0000-01-01';
  const d = new Date(now);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

/** A presenter's override only lasts for the day it was set. */
export function loadWindowDays(fallback: WindowDays = DEFAULT_WINDOW_DAYS): WindowDays {
  try {
    const raw = localStorage.getItem(WINDOW_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as { days?: WindowDays; setOn?: string };
    if (saved.setOn !== todayISO()) { localStorage.removeItem(WINDOW_KEY); return fallback; }
    return saved.days === null || typeof saved.days === 'number' ? saved.days : fallback;
  } catch { return fallback; }
}

export function saveWindowDays(days: WindowDays, fallback: WindowDays = DEFAULT_WINDOW_DAYS): void {
  try {
    if (days === fallback) localStorage.removeItem(WINDOW_KEY);
    else localStorage.setItem(WINDOW_KEY, JSON.stringify({ days, setOn: todayISO() }));
  } catch { /* storage unavailable — the window just won't persist */ }
}

/** Every date on which something happened to a finding. */
export function activityDates(f: Finding): string[] {
  return [
    f.discovered, f.reported, f.fixedAt, f.verifiedAt, f.lastActivity,
    ...(f.retests ?? []).map((r) => r.date),
    ...(f.timeline ?? []).map((t) => t.date.slice(0, 10)),
  ].filter((d): d is string => !!d);
}

export function lastActivity(f: Finding): string {
  return activityDates(f).sort().pop() ?? f.discovered;
}

export function isActiveIn(f: Finding, days: WindowDays, now = new Date()): boolean {
  if (days === null) return true;
  const start = windowStart(days, now);
  return activityDates(f).some((d) => d >= start);
}

export interface RetestEntry { finding: Finding; retest: Retest }

export interface WindowActivity {
  days: WindowDays;
  start: string;
  label: string;
  /** Findings touched in the window, worst first. */
  findings: Finding[];
  /** Newly logged in the window. */
  logged: Finding[];
  /** Re-tested in the window (the same issue tested again). */
  retested: RetestEntry[];
  /** Confirmed fixed or verified in the window. */
  resolved: Finding[];
}

/** What the team did inside the window — the basis of the presentation deck. */
export function windowActivity(data: Dataset, days: WindowDays, now = new Date()): WindowActivity {
  const start = windowStart(days, now);
  const within = (d?: string) => !!d && d >= start;

  const logged = data.findings.filter((f) => within(f.discovered) || within(f.reported));
  const retested: RetestEntry[] = [];
  for (const f of data.findings) for (const r of f.retests ?? []) if (within(r.date)) retested.push({ finding: f, retest: r });
  const resolved = data.findings.filter((f) => isResolved(f) && (within(f.verifiedAt) || within(f.fixedAt)));

  const touched = new Map<string, Finding>();
  for (const f of [...logged, ...retested.map((r) => r.finding), ...resolved]) touched.set(f.id, f);
  for (const f of data.findings) if (isActiveIn(f, days, now)) touched.set(f.id, f);

  const findings = [...touched.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || lastActivity(b).localeCompare(lastActivity(a)),
  );

  return {
    days,
    start,
    label: windowLabel(days),
    findings,
    logged,
    retested: retested.sort((a, b) => b.retest.date.localeCompare(a.retest.date)),
    resolved,
  };
}
