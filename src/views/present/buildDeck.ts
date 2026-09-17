import type { Dataset, SlideSpec, Deck } from '@/types';
import { isOpen, severityCounts, riskIndex, riskLabel, remediationRate, coverage, topRisks, totalHours } from '@/lib/metrics';
import { plural } from '@/lib/format';
import { DEFAULT_WINDOW_DAYS, windowActivity, type WindowActivity, type WindowDays } from '@/lib/activity';

/**
 * Auto-generate a board-ready deck from the live dataset.
 *
 * Finding-driven slides only cover the presentation window (7 days by default),
 * so the deck is a record of recent work rather than the whole back catalogue.
 * Program-level slides — coverage, builds, roadmap, team — always show everything.
 */
export function autoDeck(data: Dataset, days: WindowDays = DEFAULT_WINDOW_DAYS): Deck {
  const scope = windowActivity(data, days);
  const slides: SlideSpec[] = [];
  const open = data.findings.filter(isOpen);
  const risk = riskIndex(data.findings);
  const counts = severityCounts(scope.findings.filter(isOpen));
  const rem = remediationRate(data.findings);
  const cov = coverage(data);
  const risks = topRisks(scope.findings, 4);
  const completed = data.engagements.filter((e) => e.status === 'completed').length;
  const windowed = days !== null;

  slides.push({ kind: 'title', title: `${data.org.name} — Security Program Review` });
  slides.push({ kind: 'agenda' });
  if (windowed) {
    slides.push({
      kind: 'activity',
      notes: `${scope.logged.length} findings logged, ${scope.retested.length} re-tested and ${scope.resolved.length} confirmed resolved in the ${scope.label.toLowerCase()}.`,
    });
  }
  slides.push({ kind: 'exec-summary', notes: `Risk index ${risk}/100 (${riskLabel(risk).label}). ${open.length} open findings in total, ${counts.critical} critical in this window. Remediation ${rem.total ? Math.round((rem.done / rem.total) * 100) : 0}%.` });
  slides.push({ kind: 'kpis' });
  if (scope.findings.length) slides.push({ kind: 'severity' });
  slides.push({ kind: 'engagements', notes: `${completed} engagements completed across ${cov.length} activity types.` });

  // one simulation slide per top risk — the headline feature for a non-technical audience
  for (const f of risks) slides.push({ kind: 'simulation', ref: f.id, notes: `Walk through how ${f.title} could be exploited and its impact.` });

  slides.push({ kind: 'remediation' });
  if (data.builds.length) slides.push({ kind: 'builds' });
  if (data.socEvents.length || data.org.soc) slides.push({ kind: 'soc' });
  slides.push({ kind: 'roadmap' });
  if (data.org.team.length) slides.push({ kind: 'team' });
  slides.push({ kind: 'closing', notes: 'Questions and next steps.' });

  return {
    id: 'auto',
    title: `${data.org.name} Security Review`,
    subtitle: data.org.presentation?.subtitle ?? deckSubtitle(scope, data, open.length),
    date: new Date().toISOString().slice(0, 10),
    slides,
  };
}

function deckSubtitle(scope: WindowActivity, data: Dataset, openTotal: number): string {
  if (scope.days === null) return `${plural(openTotal, 'open finding')} · risk ${riskIndex(data.findings)}/100 · ${plural(totalHours(data), 'hour')} of work`;
  return `${scope.label} · ${plural(scope.logged.length, 'finding')} logged · ${plural(scope.retested.length, 're-test')} · ${plural(scope.resolved.length, 'issue')} resolved`;
}

export const SLIDE_TITLES: Record<string, string> = {
  title: 'Title', agenda: 'Agenda', activity: 'Recent work', 'exec-summary': 'Executive summary', kpis: 'Key metrics', severity: 'Findings by severity',
  engagements: 'Security coverage', simulation: 'Attack walkthrough', remediation: 'Remediation progress', roadmap: 'Roadmap',
  team: 'The team', soc: 'Always-on monitoring', builds: 'What we built', closing: 'Thank you', engagement: 'Engagement', finding: 'Finding', markdown: 'Note',
};
