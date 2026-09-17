import type { Severity, FindingStatus, EngagementType, EngagementStatus, TaskStatus, Priority } from '@/types';

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };
export const SEVERITY_VAR: Record<Severity, string> = {
  critical: 'var(--sev-critical)', high: 'var(--sev-high)', medium: 'var(--sev-medium)', low: 'var(--sev-low)', info: 'var(--sev-info)',
};
/** Base risk weight used for the risk index (0–100 scale after normalisation). */
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 10, high: 6, medium: 3, low: 1, info: 0.2 };

export function severityFromCvss(score: number): Severity {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'info';
}

export const STATUS_LABEL: Record<FindingStatus, string> = {
  open: 'Open', triaged: 'Triaged', 'in-remediation': 'In remediation', fixed: 'Fixed', verified: 'Verified',
  'risk-accepted': 'Risk accepted', 'false-positive': 'False positive', 'wont-fix': "Won't fix",
};
export const STATUS_TONE: Record<FindingStatus, string> = {
  open: 'crit', triaged: 'warn', 'in-remediation': 'accent', fixed: 'good', verified: 'good',
  'risk-accepted': 'neutral', 'false-positive': 'neutral', 'wont-fix': 'neutral',
};

export const ENGAGEMENT_TYPE_LABEL: Record<EngagementType, string> = {
  'vulnerability-assessment': 'Vulnerability assessment',
  'smart-contract-audit': 'Smart contract audit',
  'penetration-test': 'Penetration test',
  'load-test': 'Load & stress test',
  'bug-hunt': 'Bug hunt',
  'network-traffic-analysis': 'Network traffic analysis',
  'code-review': 'Secure code review',
  'red-team': 'Red team exercise',
  'soc-monitoring': 'SOC monitoring',
  'incident-response': 'Incident response',
  'security-architecture': 'Security architecture',
  'compliance-review': 'Compliance review',
  'threat-model': 'Threat model',
  training: 'Training & awareness',
  other: 'Other',
};
export const ENGAGEMENT_STATUS_LABEL: Record<EngagementStatus, string> = {
  planned: 'Planned', scheduled: 'Scheduled', 'in-progress': 'In progress', completed: 'Completed', ongoing: 'Ongoing', 'on-hold': 'On hold', cancelled: 'Cancelled',
};
export const ENGAGEMENT_STATUS_TONE: Record<EngagementStatus, string> = {
  planned: 'neutral', scheduled: 'accent', 'in-progress': 'warn', completed: 'good', ongoing: 'accent', 'on-hold': 'neutral', cancelled: 'neutral',
};
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog', todo: 'To do', 'in-progress': 'In progress', review: 'Review', done: 'Done', blocked: 'Blocked',
};
export const PRIORITY_LABEL: Record<Priority, string> = { p0: 'P0 · Urgent', p1: 'P1 · High', p2: 'P2 · Normal', p3: 'P3 · Low' };

/** Time-bucket helper for past / present / future views. */
export function tense(status: EngagementStatus): 'past' | 'present' | 'future' {
  if (status === 'completed' || status === 'cancelled') return 'past';
  if (status === 'planned' || status === 'scheduled') return 'future';
  return 'present';
}

export function sortBySeverity<T extends { severity: Severity }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
