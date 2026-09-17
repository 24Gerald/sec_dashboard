import type { Dataset, Finding, Severity, Engagement, Task, TeamMember, EngagementType } from '@/types';
import { SEVERITIES, OPEN_STATUSES, ENGAGEMENT_TYPES } from '@/types';
import { SEVERITY_WEIGHT } from './severity';
import { daysBetween } from './format';

export const isOpen = (f: Finding) => OPEN_STATUSES.includes(f.status);
export const isResolved = (f: Finding) => f.status === 'fixed' || f.status === 'verified';
export const isReal = (f: Finding) => f.status !== 'false-positive';

/** Remediation SLA in days by severity — used when a finding has no explicit due date. */
export const SLA_DAYS: Record<Severity, number> = { critical: 7, high: 30, medium: 90, low: 180, info: 365 };

export function dueDate(f: Finding): string {
  if (f.due) return f.due;
  const d = new Date(f.discovered);
  d.setDate(d.getDate() + SLA_DAYS[f.severity]);
  return d.toISOString().slice(0, 10);
}
export function isOverdue(f: Finding, now = new Date()): boolean {
  return isOpen(f) && new Date(dueDate(f)) < now;
}

export function severityCounts(findings: Finding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) c[f.severity]++;
  return c;
}

/** 0–100 live-risk index from open findings; saturates smoothly so one critical still registers. */
export function riskIndex(findings: Finding[]): number {
  const sum = findings.filter(isOpen).reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0);
  return Math.round(100 * (1 - Math.exp(-sum / 30)));
}
export function riskLabel(score: number): { label: string; tone: string } {
  if (score >= 75) return { label: 'Critical exposure', tone: 'crit' };
  if (score >= 50) return { label: 'Elevated', tone: 'serious' };
  if (score >= 25) return { label: 'Moderate', tone: 'warn' };
  return { label: 'Contained', tone: 'good' };
}

export function mttrDays(findings: Finding[]): number | null {
  const done = findings.filter((f) => isResolved(f) && f.fixedAt);
  if (!done.length) return null;
  return Math.round(done.reduce((s, f) => s + daysBetween(f.discovered, f.fixedAt), 0) / done.length);
}

export function remediationRate(findings: Finding[]): { done: number; total: number } {
  const real = findings.filter(isReal);
  return { done: real.filter((f) => isResolved(f) || f.status === 'risk-accepted').length, total: real.length };
}

export interface MonthPoint { key: string; label: string; discovered: number; resolved: number; open: number }
/** Findings discovered vs resolved per month, plus running open count. */
export function findingsByMonth(findings: Finding[], months = 12, now = new Date()): MonthPoint[] {
  const pts: MonthPoint[] = [];
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    pts.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(undefined, { month: 'short' }), discovered: 0, resolved: 0, open: 0 });
  }
  const keyOf = (iso: string) => iso.slice(0, 7);
  for (const f of findings) {
    const a = pts.find((p) => p.key === keyOf(f.discovered));
    if (a) a.discovered++;
    if (f.fixedAt) { const b = pts.find((p) => p.key === keyOf(f.fixedAt!)); if (b) b.resolved++; }
  }
  // running open = discovered before month end - resolved before month end
  const endOf = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0, 23, 59, 59); };
  for (const p of pts) {
    const end = endOf(p.key);
    p.open = findings.filter((f) => isReal(f) && new Date(f.discovered) <= end && !(f.fixedAt && new Date(f.fixedAt) <= end) && !(f.status === 'risk-accepted' || f.status === 'wont-fix')).length;
  }
  return pts;
}

export interface EngagementStats { total: number; open: number; bySeverity: Record<Severity, number>; hours: number; tasks: number; tasksDone: number }
export function engagementStats(e: Engagement, findings: Finding[], tasks: Task[]): EngagementStats {
  const fs = findings.filter((f) => f.engagement === e.id);
  const ts = tasks.filter((t) => t.engagement === e.id);
  const hours = Number(e.metrics?.hoursSpent ?? e.metrics?.hours ?? 0) || fs.reduce((s, f) => s + (f.effortHours ?? 0), 0) + ts.reduce((s, t) => s + (t.effortHours ?? 0), 0);
  return { total: fs.length, open: fs.filter(isOpen).length, bySeverity: severityCounts(fs), hours, tasks: ts.length, tasksDone: ts.filter((t) => t.status === 'done').length };
}

export interface MemberEffort { member: TeamMember; findings: number; critical: number; tasksDone: number; tasksOpen: number; engagements: number; hours: number; led: number }
export function effortByMember(d: Dataset): MemberEffort[] {
  return d.org.team.map((member) => {
    const fs = d.findings.filter((f) => f.reporter === member.id || f.assignee === member.id);
    const reported = d.findings.filter((f) => f.reporter === member.id);
    const ts = d.tasks.filter((t) => t.assignee === member.id);
    const es = d.engagements.filter((e) => e.lead === member.id || e.team?.includes(member.id));
    const hours = reported.reduce((s, f) => s + (f.effortHours ?? 0), 0) + ts.reduce((s, t) => s + (t.effortHours ?? 0), 0);
    return {
      member, findings: fs.length, critical: reported.filter((f) => f.severity === 'critical' || f.severity === 'high').length,
      tasksDone: ts.filter((t) => t.status === 'done').length, tasksOpen: ts.filter((t) => t.status !== 'done').length,
      engagements: es.length, led: d.engagements.filter((e) => e.lead === member.id).length, hours,
    };
  }).sort((a, b) => b.findings + b.tasksDone - (a.findings + a.tasksDone));
}

export interface Coverage { type: EngagementType; count: number; done: number; active: number; planned: number; lastDate?: string; findings: number }
export function coverage(d: Dataset): Coverage[] {
  return ENGAGEMENT_TYPES.map((type) => {
    const es = d.engagements.filter((e) => e.type === type);
    const ids = new Set(es.map((e) => e.id));
    return {
      type, count: es.length,
      done: es.filter((e) => e.status === 'completed').length,
      active: es.filter((e) => e.status === 'in-progress' || e.status === 'ongoing').length,
      planned: es.filter((e) => e.status === 'planned' || e.status === 'scheduled').length,
      lastDate: es.map((e) => e.endDate ?? e.startDate).sort().pop(),
      findings: d.findings.filter((f) => f.engagement && ids.has(f.engagement)).length,
    };
  }).filter((c) => c.count > 0);
}

export function totalHours(d: Dataset): number {
  const eng = d.engagements.reduce((s, e) => s + (Number(e.metrics?.hoursSpent ?? e.metrics?.hours ?? 0) || 0), 0);
  const fin = d.findings.reduce((s, f) => s + (f.effortHours ?? 0), 0);
  const tsk = d.tasks.reduce((s, t) => s + (t.effortHours ?? 0), 0);
  return Math.round(eng + fin + tsk);
}

const RETEST_DETAIL: Record<string, string> = {
  'still-present': 'Re-tested — still present',
  resolved: 'Re-tested — fix confirmed',
  'partially-fixed': 'Re-tested — partially fixed',
  inconclusive: 'Re-tested — inconclusive',
};

export interface ActivityItem { id: string; date: string; kind: 'finding' | 'fix' | 'task' | 'engagement' | 'soc' | 'build' | 'report' | 'retest'; title: string; detail?: string; severity?: Severity; href?: string }
export function activityFeed(d: Dataset, limit = 30): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const f of d.findings) {
    items.push({ id: `f-${f.id}`, date: f.discovered, kind: 'finding', title: f.title, detail: `Finding logged · ${f.id}`, severity: f.severity, href: `/findings/${f.id}` });
    if (f.fixedAt) items.push({ id: `fx-${f.id}`, date: f.fixedAt, kind: 'fix', title: f.title, detail: `Remediated · ${f.id}`, severity: f.severity, href: `/findings/${f.id}` });
    (f.retests ?? []).forEach((r, i) => items.push({
      id: `rt-${f.id}-${i}`, date: r.date, kind: 'retest', title: f.title,
      detail: `${RETEST_DETAIL[r.outcome] ?? 'Re-tested'} · ${f.id}`, severity: f.severity, href: `/findings/${f.id}`,
    }));
  }
  for (const t of d.tasks) if (t.completed) items.push({ id: `t-${t.id}`, date: t.completed, kind: 'task', title: t.title, detail: 'Task completed', href: '/tasks' });
  for (const e of d.engagements) {
    items.push({ id: `e-${e.id}`, date: e.startDate, kind: 'engagement', title: e.title, detail: e.status === 'planned' || e.status === 'scheduled' ? 'Engagement scheduled' : 'Engagement started', href: `/engagements/${e.id}` });
    if (e.endDate && e.status === 'completed') items.push({ id: `ee-${e.id}`, date: e.endDate, kind: 'engagement', title: e.title, detail: 'Engagement completed', href: `/engagements/${e.id}` });
  }
  for (const s of d.socEvents.slice(0, 40)) items.push({ id: `s-${s.id}`, date: s.timestamp, kind: 'soc', title: s.title, detail: `SOC · ${s.source}`, severity: s.severity, href: '/soc' });
  for (const b of d.builds) if (b.shipped) items.push({ id: `b-${b.id}`, date: b.shipped, kind: 'build', title: b.title, detail: 'Shipped', href: '/builds' });
  for (const r of d.reports) items.push({ id: `r-${r.id}`, date: r.date, kind: 'report', title: r.title, detail: 'Report published', href: `/reports/${r.id}` });
  const now = Date.now();
  return items.filter((i) => new Date(i.date).getTime() <= now + 86400000).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
}

export function topRisks(findings: Finding[], n = 5): Finding[] {
  return findings.filter(isOpen).sort((a, b) => {
    const w = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (w) return w;
    return (b.cvss?.score ?? 0) - (a.cvss?.score ?? 0);
  }).slice(0, n);
}

export function severityEntries(c: Record<Severity, number>) {
  return SEVERITIES.map((s) => ({ severity: s, count: c[s] }));
}
