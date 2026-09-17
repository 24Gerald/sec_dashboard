import type { Dataset, SlideSpec, Deck } from '@/types';
import { isOpen, severityCounts, riskIndex, riskLabel, remediationRate, coverage, topRisks, totalHours } from '@/lib/metrics';
import { plural } from '@/lib/format';

/** Auto-generate a board-ready deck from the live dataset. */
export function autoDeck(data: Dataset): Deck {
  const slides: SlideSpec[] = [];
  const open = data.findings.filter(isOpen);
  const risk = riskIndex(data.findings);
  const counts = severityCounts(open);
  const rem = remediationRate(data.findings);
  const cov = coverage(data);
  const risks = topRisks(data.findings, 4);
  const completed = data.engagements.filter((e) => e.status === 'completed').length;

  slides.push({ kind: 'title', title: `${data.org.name} — Security Program Review` });
  slides.push({ kind: 'agenda' });
  slides.push({ kind: 'exec-summary', notes: `Risk index ${risk}/100 (${riskLabel(risk).label}). ${open.length} open findings, ${counts.critical} critical. Remediation ${rem.total ? Math.round((rem.done / rem.total) * 100) : 0}%.` });
  slides.push({ kind: 'kpis' });
  slides.push({ kind: 'severity' });
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
    subtitle: data.org.presentation?.subtitle ?? `${plural(open.length, 'open finding')} · risk ${risk}/100 · ${plural(totalHours(data), 'hour')} of work`,
    date: new Date().toISOString().slice(0, 10),
    slides,
  };
}

export const SLIDE_TITLES: Record<string, string> = {
  title: 'Title', agenda: 'Agenda', 'exec-summary': 'Executive summary', kpis: 'Key metrics', severity: 'Findings by severity',
  engagements: 'Security coverage', simulation: 'Attack walkthrough', remediation: 'Remediation progress', roadmap: 'Roadmap',
  team: 'The team', soc: 'Always-on monitoring', builds: 'What we built', closing: 'Thank you', engagement: 'Engagement', finding: 'Finding', markdown: 'Note',
};
