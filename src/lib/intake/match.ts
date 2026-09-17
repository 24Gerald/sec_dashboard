/**
 * The intelligence layer behind report intake.
 *
 * When a report is submitted it is compared against every finding already
 * logged. If it is the same issue, the submission is recorded as a *re-test* of
 * that finding instead of a duplicate: the original is resolved (or re-opened)
 * and the re-test is stamped with today's date, so the day's work still shows
 * up in the timeline and in the presentation window.
 */
import type { Finding, IntakeMeta, Retest, RetestOutcome, TimelineEvent } from '@/types';
import { classifyFinding } from '@/sim/classify';
import { classLabel } from '@/sim/engine';
import { todayISO } from '@/lib/format';

/** Above this the intake proposes a re-test rather than a new finding. */
export const MATCH_THRESHOLD = 0.55;

export interface FindingMatch {
  finding: Finding;
  /** 0–1 confidence that this is the same issue. */
  score: number;
  reasons: string[];
}

const STOPWORDS = new Set(['the', 'a', 'an', 'in', 'on', 'of', 'for', 'and', 'to', 'is', 'are', 'with', 'via', 'that', 'this', 'can', 'be', 'by', 'at', 'from', 'it', 'its', 'when', 'allows', 'allow', 'due', 'has', 'have', 'not', 'no']);

function tokens(s?: string): Set<string> {
  if (!s) return new Set();
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s./_-]/g, ' ').split(/\s+/)
      .map((t) => t.replace(/^[-./_]+|[-./_]+$/g, ''))
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Sørensen–Dice overlap of two token sets. */
function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

const norm = (s?: string) => s?.toLowerCase().replace(/[?#].*$/, '').replace(/\{[^}]*\}|:\w+|\/\d+/g, '/*').replace(/\/+$/, '').trim() || undefined;

function affectedKeys(f: Pick<Finding, 'affected'>): string[] {
  const a = f.affected;
  if (!a) return [];
  return [norm(a.endpoint), norm(a.component), norm(a.file), norm(a.contract), norm(a.function)].filter((x): x is string => !!x && x.length > 2);
}

export interface MatchOptions {
  /** Engagement type per finding id, so classification matches the detail view. */
  engagementType?: (engagementId?: string) => string | undefined;
}

/** Rank existing findings by how likely the draft is the same issue, best first. */
export function matchExisting(draft: Omit<Finding, 'id'>, findings: Finding[], opts: MatchOptions = {}): FindingMatch[] {
  const engType = opts.engagementType ?? (() => undefined);
  const draftAsFinding = { ...draft, id: '__draft__' } as Finding;
  const draftClass = classifyFinding(draftAsFinding, engType(draft.engagement));
  const draftTitle = tokens(draft.title);
  const draftText = tokens(`${draft.title} ${draft.summary}`);
  const draftKeys = affectedKeys(draft);
  const draftCwe = new Set((draft.cwe ?? []).map((c) => c.toUpperCase()));

  const matches: FindingMatch[] = [];
  for (const f of findings) {
    const reasons: string[] = [];
    let score = 0;

    const titleSim = dice(draftTitle, tokens(f.title));
    score += titleSim * 0.45;
    if (titleSim >= 0.75) reasons.push('Nearly the same title');
    else if (titleSim >= 0.4) reasons.push(`Similar title (${Math.round(titleSim * 100)}% word overlap)`);

    const cls = classifyFinding(f, engType(f.engagement));
    if (cls.cls === draftClass.cls && cls.cls !== 'generic') {
      score += 0.2;
      reasons.push(`Same attack class — ${classLabel(cls.cls)}`);
    }

    const keys = affectedKeys(f);
    const sharedKey = draftKeys.find((k) => keys.some((k2) => k2 === k || k2.includes(k) || k.includes(k2)));
    if (sharedKey) {
      score += 0.2;
      reasons.push(`Same affected component — ${sharedKey}`);
    }

    const sharedCwe = [...draftCwe].filter((c) => (f.cwe ?? []).map((x) => x.toUpperCase()).includes(c));
    if (sharedCwe.length) {
      score += 0.1;
      reasons.push(`Shares ${sharedCwe.join(', ')}`);
    }

    if (draft.engagement && draft.engagement === f.engagement) { score += 0.05; reasons.push('Same engagement'); }
    const sharedAsset = (draft.assets ?? []).find((a) => (f.assets ?? []).includes(a));
    if (sharedAsset) { score += 0.05; reasons.push('Same asset'); }

    // Body text agreement breaks ties between similar-sounding findings.
    score += dice(draftText, tokens(`${f.title} ${f.summary}`)) * 0.1;

    if (score > 0.25) matches.push({ finding: f, score: Math.min(1, score), reasons });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}

export const OUTCOME_LABEL: Record<RetestOutcome, string> = {
  'still-present': 'Still present',
  resolved: 'Resolved — fix confirmed',
  'partially-fixed': 'Partially fixed',
  inconclusive: 'Inconclusive',
};

export interface RetestInput {
  outcome: RetestOutcome;
  date?: string;
  by?: string;
  note?: string;
  reportId?: string;
  confidence?: number;
}

/**
 * Fold a re-test into the finding it belongs to: record the re-test, move the
 * status on, and stamp the date so the work is visible.
 */
export function applyRetest(existing: Finding, input: RetestInput): Finding {
  const date = input.date ?? todayISO();
  const retest: Retest = {
    date,
    outcome: input.outcome,
    by: input.by,
    note: input.note,
    reportId: input.reportId,
    via: 'intake',
    confidence: input.confidence,
  };
  const timeline: TimelineEvent[] = [...(existing.timeline ?? []), { date, type: 'retest', by: input.by, note: input.note ?? OUTCOME_LABEL[input.outcome] }];
  const next: Finding = {
    ...existing,
    retests: [...(existing.retests ?? []), retest],
    timeline,
    lastActivity: maxDate(existing.lastActivity, date),
    reports: input.reportId ? [...new Set([...(existing.reports ?? []), input.reportId])] : existing.reports,
  };

  const wasResolved = existing.status === 'fixed' || existing.status === 'verified';
  switch (input.outcome) {
    case 'resolved':
      next.status = 'verified';
      next.fixedAt = existing.fixedAt ?? date;
      next.verifiedAt = date;
      next.remediation = existing.remediation ? { ...existing.remediation, status: 'verified' } : undefined;
      timeline.push({ date, type: 'verified', by: input.by, note: 'Re-test confirmed the fix' });
      break;
    case 'partially-fixed':
      next.status = 'in-remediation';
      if (wasResolved) timeline.push({ date, type: 'reopened', by: input.by, note: 'Re-test found the fix incomplete' });
      break;
    case 'still-present':
      next.status = wasResolved ? 'open' : existing.status;
      if (wasResolved) timeline.push({ date, type: 'reopened', by: input.by, note: 'Re-test found the issue still present' });
      break;
    case 'inconclusive':
      break;
  }
  return next;
}

/** Turn a parsed draft into a finding ready to save. */
export function findingFromDraft(draft: Omit<Finding, 'id'>, id: string, intake?: IntakeMeta, reportId?: string): Finding {
  const timeline: TimelineEvent[] = [{ date: draft.discovered, type: 'discovered', by: draft.reporter }];
  if (draft.reported && draft.reported !== draft.discovered) timeline.push({ date: draft.reported, type: 'reported', by: draft.reporter });
  return {
    ...draft,
    id,
    intake,
    reports: reportId ? [reportId] : undefined,
    lastActivity: maxDate(draft.reported, draft.discovered),
    timeline: draft.timeline?.length ? draft.timeline : timeline,
  };
}

export function maxDate(...dates: (string | undefined)[]): string {
  return dates.filter((d): d is string => !!d).sort().pop() ?? todayISO();
}
