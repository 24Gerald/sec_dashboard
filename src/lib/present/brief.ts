/**
 * Presentation briefings — turn a finding into plain-English stakes for a
 * board-style deck. Tone is deliberate: we spell out exploitability and loss
 * so non-technical listeners feel the weight of the work, without inventing
 * numbers that aren't on the record.
 */
import type { Finding } from '@/types';
import { SEVERITY_LABEL, STATUS_LABEL } from '@/lib/severity';
import { classLabel } from '@/sim/engine';
import { classifyFinding } from '@/sim/classify';
import { plural } from '@/lib/format';

export interface FindingBrief {
  id: string;
  title: string;
  severity: string;
  status: string;
  headline: string;
  impact: string;
  how: string;
  work: string;
  stakes: string[];
}

const SEV_IMPACT: Record<string, string> = {
  critical: 'A critical, actively exploitable weakness. Left open it is a direct path to compromise — data theft, account takeover or full system control.',
  high: 'A high-severity weakness that a motivated attacker can reliably weaponise. It expands their reach and raises the cost of every day it stays open.',
  medium: 'A medium-severity issue that compounds with other flaws. In a real intrusion it becomes a stepping stone, not a footnote.',
  low: 'Lower severity on its own, but still an exposure that weakens the overall defensive posture and should be closed.',
  info: 'Informational finding — logged so the programme has a complete record of what was tested and observed.',
};

const SEV_LOSS: Record<string, string> = {
  critical: 'Material loss potential: confidentiality breach, service outage, regulatory exposure and lasting reputational damage.',
  high: 'Significant loss potential across data, operations and trust if this is chained into a broader attack.',
  medium: 'Meaningful exposure — quieter than critical, but still costly if left to accumulate.',
  low: 'Limited direct loss, but it erodes the security baseline and wastes future remediation effort.',
  info: 'No immediate loss — context for the programme.',
};

export function briefFinding(f: Finding): FindingBrief {
  const attackClass = f.attack?.class && f.attack.class !== 'auto' ? f.attack.class : classifyFinding(f).cls;
  const label = classLabel(attackClass);
  const hours = f.effortHours ?? 0;
  const retests = f.retests?.length ?? 0;
  const evidence = f.evidence?.length ?? 0;
  const entry = f.attack?.entryPoint || f.affected?.endpoint || f.affected?.component || f.affected?.network;
  const money = f.attack?.financialExposure;
  const exploited = !!f.attack?.exploited;
  const steps = (f.stepsToReproduce ?? []).join(' ');

  const impactBits = [
    SEV_IMPACT[f.severity] ?? SEV_IMPACT.medium,
    f.impact?.trim() || null,
    money != null && money > 0 ? `Estimated financial exposure on record: ${fmtMoney(money)}.` : SEV_LOSS[f.severity],
  ].filter(Boolean) as string[];

  const howBits = [
    `Classified as ${label}${exploited ? ' — and confirmed exploitable during testing' : ''}.`,
    entry ? `Attack surface: ${entry}.` : null,
    f.attack?.authRequired && f.attack.authRequired !== 'none'
      ? `Requires ${f.attack.authRequired} access — once past that gate, impact escalates fast.`
      : f.attack?.authRequired === 'none' ? 'No authentication required — reachable by an unauthenticated attacker.' : null,
    firstSentence(steps) ? `How we proved it: ${firstSentence(steps)}` : firstSentence(f.description) || firstSentence(f.summary),
  ].filter(Boolean) as string[];

  const workBits = [
    hours > 0 ? `${hours} engineer-hour${hours === 1 ? '' : 's'} invested in discovery, validation and write-up` : 'Logged through structured report intake with full evidence capture',
    evidence > 0 ? `${plural(evidence, 'evidence artefact')} attached` : null,
    retests > 0 ? `${plural(retests, 're-test')} completed to verify the fix` : 'Ready for re-test once remediation lands',
    `Current status: ${STATUS_LABEL[f.status]}.`,
  ].filter(Boolean) as string[];

  const stakes = [
    `${SEVERITY_LABEL[f.severity]} severity`,
    money != null && money > 0 ? fmtMoney(money) + ' exposure' : 'Loss-capable if exploited',
    exploited ? 'Exploit confirmed' : 'Exploit path modelled',
    hours > 0 ? `${hours}h of work` : 'Hands-on validated',
  ];

  return {
    id: f.id,
    title: f.title,
    severity: SEVERITY_LABEL[f.severity],
    status: STATUS_LABEL[f.status],
    headline: amplifyHeadline(f, label, exploited),
    impact: impactBits.join(' '),
    how: howBits.join(' '),
    work: workBits.join(' · '),
    stakes,
  };
}

function amplifyHeadline(f: Finding, label: string, exploited: boolean): string {
  if (f.severity === 'critical') return `Critical ${label.toLowerCase()} — immediate compromise risk`;
  if (f.severity === 'high') return `High-impact ${label.toLowerCase()} with a clear exploit path`;
  if (exploited) return `${label} — successfully demonstrated during testing`;
  return `${label} logged and under the programme's control`;
}

function firstSentence(s?: string): string | null {
  if (!s?.trim()) return null;
  const clean = s.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.{20,220}?[.!?])(?:\s|$)/);
  return (m?.[1] ?? clean.slice(0, 180)).trim();
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}
