import type { Dataset, SlideSpec, Deck, Finding } from '@/types';
import { isOpen, severityCounts, remediationRate } from '@/lib/metrics';
import { plural } from '@/lib/format';
import { DEFAULT_WINDOW_DAYS, windowActivity, type WindowActivity, type WindowDays } from '@/lib/activity';
import { SEVERITY_ORDER } from '@/lib/severity';

/**
 * Auto deck = the last N days of logged work only.
 *
 * No team roster, coverage catalogue, builds, SOC or roadmap filler —
 * just what was found, why it matters, how it was proved, and where fixes stand.
 */
export function autoDeck(data: Dataset, days: WindowDays = DEFAULT_WINDOW_DAYS): Deck {
  const scope = windowActivity(data, days);
  const findings = scope.findings
    .slice()
    .sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || b.discovered.localeCompare(a.discovered));

  const slides: SlideSpec[] = [];
  const open = findings.filter(isOpen);
  const counts = severityCounts(open);
  const rem = remediationRate(findings);
  const remPct = rem.total ? Math.round((rem.done / rem.total) * 100) : 0;
  const label = scope.label;

  slides.push({
    kind: 'title',
    title: `${data.org.name} — ${label} security review`,
    notes: `${plural(findings.length, 'finding')} in scope · ${plural(open.length, 'still open')}`,
  });

  if (!findings.length) {
    slides.push({
      kind: 'activity',
      notes: `Nothing logged in the ${label.toLowerCase()} yet.`,
    });
    slides.push({ kind: 'closing', notes: 'Log the next report and this deck fills itself.' });
    return {
      id: 'auto',
      title: `${data.org.name} · ${label}`,
      subtitle: `No findings in the ${label.toLowerCase()} yet`,
      date: new Date().toISOString().slice(0, 10),
      slides,
    };
  }

  slides.push({ kind: 'agenda' });
  slides.push({
    kind: 'activity',
    notes: `${scope.logged.length} logged · ${scope.retested.length} re-tested · ${scope.resolved.length} resolved`,
  });
  slides.push({
    kind: 'exec-summary',
    notes: `${open.length} open · ${counts.critical} critical · ${remPct}% remediated in window`,
  });
  slides.push({ kind: 'severity' });

  // One briefing per finding (cap so the deck stays presentable), then a walkthrough for the worst.
  const briefings = findings.slice(0, 8);
  for (const f of briefings) {
    slides.push({
      kind: 'finding',
      ref: f.id,
      notes: briefNote(f),
    });
  }

  const walkthroughs = findings.filter((f) => f.severity === 'critical' || f.severity === 'high' || f.attack?.exploited).slice(0, 3);
  for (const f of (walkthroughs.length ? walkthroughs : findings.slice(0, 1))) {
    slides.push({ kind: 'simulation', ref: f.id, notes: `How an attacker exploits ${f.title}` });
  }

  slides.push({ kind: 'remediation' });
  slides.push({ kind: 'closing', notes: 'Questions and next steps.' });

  return {
    id: 'auto',
    title: `${data.org.name} · ${label}`,
    subtitle: deckSubtitle(scope, findings, open.length, remPct),
    date: new Date().toISOString().slice(0, 10),
    slides,
  };
}

function deckSubtitle(scope: WindowActivity, findings: Finding[], open: number, remPct: number): string {
  return `${scope.label} · ${plural(findings.length, 'finding')} · ${plural(open, 'open')} · ${remPct}% remediated`;
}

function briefNote(f: Finding): string {
  return `${f.severity} · ${f.status} · ${f.title}`;
}

export const SLIDE_TITLES: Record<string, string> = {
  title: 'Title',
  agenda: 'Agenda',
  activity: 'This period',
  'exec-summary': 'Stakes',
  kpis: 'Key metrics',
  severity: 'Severity mix',
  engagements: 'Coverage',
  finding: 'Finding brief',
  simulation: 'Attack walkthrough',
  remediation: 'Fix progress',
  roadmap: 'Roadmap',
  team: 'Team',
  soc: 'Monitoring',
  builds: 'Builds',
  closing: 'Close',
  engagement: 'Engagement',
  markdown: 'Note',
};
