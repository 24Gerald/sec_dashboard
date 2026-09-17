/**
 * Report → finding parser.
 *
 * Takes the plain text of a submitted report (however it was written) and pulls
 * out everything the dashboard needs: title, severity, CVSS, CWE, dates, the
 * affected component, reproduction steps, remediation and evidence. Anything it
 * can't find is left blank for the analyst to fill in — nothing is invented.
 *
 * The parser also reports whether the document reads like a *re-test* of an
 * earlier issue; `match.ts` decides which finding that re-test belongs to.
 */
import type { Asset, Engagement, Evidence, Finding, FindingStatus, RetestOutcome, Severity, TeamMember } from '@/types';
import { severityFromCvss } from '@/lib/severity';
import { todayISO } from '@/lib/format';
import type { IntakeFileType } from './extract';

export interface ParseContext {
  engagements: Engagement[];
  assets: Asset[];
  team: TeamMember[];
}

export interface RetestSignal {
  outcome: RetestOutcome | null;
  /** The phrase that gave it away, shown in the UI so the call is explainable. */
  evidence?: string;
}

export interface Candidate {
  /** Everything the parser could fill in. `id` is assigned when it is saved. */
  draft: Omit<Finding, 'id'>;
  /** Field labels the parser filled, for the review screen. */
  extracted: string[];
  retest: RetestSignal;
  /** Markdown of just this finding's part of the document. */
  body: string;
  /** Name found next to "tested by"/"author" even when it matched no team member. */
  reporterName?: string;
}

export interface ParsedReport {
  documentTitle: string;
  date: string;
  candidates: Candidate[];
  warnings: string[];
  type: IntakeFileType;
  fileName?: string;
  /** The whole document, normalised to markdown-ish text. */
  body: string;
}

// ------------------------------------------------------------------ utilities

function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

const stripMd = (s: string) => s.replace(/\*\*|__|`|^#+\s*/g, '').trim();

/** Titles are one line: first sentence, no numbering, capped so a pasted paragraph doesn't become the title. */
function clampTitle(s: string): string {
  const bare = s.trim()
    .replace(/^(?:finding|issue|vulnerability|vuln)\s*(?:#|no\.?)?\s*\d*\s*[:.)-]\s*/i, '')
    .replace(/^\d{1,2}[.)]\s*/, '');
  const first = (bare.split(/(?<=[.!?])\s|\n/)[0] || bare).trim() || bare;
  const cut = first.length > 110 ? first.slice(0, 110).replace(/\s+\S*$/, '') : first;
  return cut.replace(/[.,;:]+$/, '').trim();
}

/** `Severity: High` / `- **Severity** — High` / `Severity = high` */
function labelValue(text: string, names: string[]): string | undefined {
  const alt = names.join('|');
  const re = new RegExp(`^[ \\t]*(?:[-*+>]\\s*)?(?:\\*\\*|__)?\\s*(?:${alt})\\s*(?:\\*\\*|__)?\\s*[:=\\u2013\\u2014-]\\s*(.+)$`, 'im');
  const m = text.match(re);
  if (!m) return undefined;
  const v = stripMd(m[1]).replace(/\s*[|·]\s*$/, '').trim();
  return v || undefined;
}

const SEVERITY_WORDS: Record<string, Severity> = {
  critical: 'critical', crit: 'critical', severe: 'critical', catastrophic: 'critical', blocker: 'critical', p0: 'critical',
  high: 'high', important: 'high', major: 'high', serious: 'high', p1: 'high',
  medium: 'medium', moderate: 'medium', med: 'medium', p2: 'medium',
  low: 'low', minor: 'low', p3: 'low',
  info: 'info', informational: 'info', information: 'info', note: 'info', none: 'info',
};

function parseSeverity(value?: string): Severity | undefined {
  if (!value) return undefined;
  const first = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const w of first) if (SEVERITY_WORDS[w]) return SEVERITY_WORDS[w];
  return undefined;
}

const STATUS_WORDS: [RegExp, FindingStatus][] = [
  [/\b(verified|closed[- ]verified|confirmed\s+fixed|retest\s+passed)\b/i, 'verified'],
  [/\b(fixed|resolved|remediated|patched|mitigated|closed)\b/i, 'fixed'],
  [/\b(in[- ]remediation|being\s+fixed|fix\s+in\s+progress|in\s+progress)\b/i, 'in-remediation'],
  [/\b(triaged|acknowledged|accepted\s+for\s+fix)\b/i, 'triaged'],
  [/\b(risk[- ]accepted|accepted\s+risk)\b/i, 'risk-accepted'],
  [/\b(false[- ]positive|not\s+a\s+(bug|vulnerability))\b/i, 'false-positive'],
  [/\b(wont[- ]?fix|will\s+not\s+(be\s+)?fix)\b/i, 'wont-fix'],
  [/\b(open|new|unresolved|outstanding)\b/i, 'open'],
];

function parseStatus(value?: string): FindingStatus | undefined {
  if (!value) return undefined;
  for (const [re, status] of STATUS_WORDS) if (re.test(value)) return status;
  return undefined;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Accepts 2026-09-14, 14 Sep 2026, Sep 14 2026 and 14/09/2026. Returns yyyy-mm-dd. */
export function parseDate(value?: string, fallback?: string): string | undefined {
  if (!value) return fallback;
  const iso = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return clampDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), fallback);
  const dmy = value.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[ .-]+(${MONTHS.join('|')})[a-z]*[ ,.-]+(20\\d{2})\\b`, 'i'));
  if (dmy) return clampDate(Number(dmy[3]), MONTHS.indexOf(dmy[2].toLowerCase().slice(0, 3)) + 1, Number(dmy[1]), fallback);
  const mdy = value.match(new RegExp(`\\b(${MONTHS.join('|')})[a-z]*[ .-]+(\\d{1,2})(?:st|nd|rd|th)?[ ,.-]+(20\\d{2})\\b`, 'i'));
  if (mdy) return clampDate(Number(mdy[3]), MONTHS.indexOf(mdy[1].toLowerCase().slice(0, 3)) + 1, Number(mdy[2]), fallback);
  const slash = value.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  // Day-first unless that is impossible (13/05 → 13 May, 05/13 → 13 May).
  if (slash) {
    const a = Number(slash[1]); const b = Number(slash[2]);
    return a > 12 || b <= 12 ? clampDate(Number(slash[3]), b, a, fallback) : clampDate(Number(slash[3]), a, b, fallback);
  }
  return fallback;
}

function clampDate(y: number, m: number, d: number, fallback?: string): string | undefined {
  if (!y || !m || !d || m > 12 || d > 31) return fallback;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return iso > todayISO() ? todayISO() : iso;
}

// ------------------------------------------------------------------- sections

const SECTION_ALIASES: Record<string, RegExp> = {
  summary: /^(executive\s+)?(summary|overview|abstract|synopsis|tl;?dr|what\s+we\s+found)\b/i,
  description: /^(description|details?|technical\s+(details?|description|analysis)|finding\s+details?|analysis|背景)\b/i,
  impact: /^(impact|business\s+impact|risk|consequence|why\s+it\s+matters|so\s+what)\b/i,
  steps: /^(steps?(\s+to\s+reproduce)?|reproduction|repro(\s+steps?)?|proof[- ]of[- ]concept|poc|exploit(ation)?(\s+steps?)?|how\s+to\s+reproduce|attack\s+path)\b/i,
  remediation: /^(remediation|recommendation|recommended\s+(fix|action)|mitigation|fix|how\s+to\s+fix|suggested\s+fix|resolution)\b/i,
  references: /^(references?|links?|further\s+reading|resources)\b/i,
  evidence: /^(evidence|screenshots?|artifacts?|logs?|request|response)\b/i,
  retest: /^(re-?test|verification|validation|retest\s+(results?|notes?)|follow[- ]up)\b/i,
  affected: /^(affected|affected\s+(component|asset|system|endpoint|file)|location|scope|target)\b/i,
};

/** Heading-driven split; falls back to `Label:` paragraphs so plain emails work too. */
function sections(body: string): Record<string, string> {
  const lines = body.split('\n');
  const out: Record<string, string> = {};
  let current = '';
  let buf: string[] = [];
  const flush = () => { if (current && buf.length) out[current] = ((out[current] ?? '') + '\n' + buf.join('\n')).trim(); buf = []; };

  for (const line of lines) {
    const heading = line.match(/^\s*(?:#{1,6}\s*|\*\*)?([A-Za-z][A-Za-z ’'\-/;]{2,44})(?:\*\*)?\s*:?\s*$/);
    const labelled = line.match(/^\s*(?:#{1,6}\s*|\*\*)?([A-Za-z][A-Za-z ’'\-/]{2,44})(?:\*\*)?\s*:\s*(.*)$/);
    const candidate = heading?.[1] ?? labelled?.[1];
    const key = candidate ? Object.keys(SECTION_ALIASES).find((k) => SECTION_ALIASES[k].test(candidate.trim())) : undefined;
    if (key) {
      flush();
      current = key;
      const rest = labelled?.[2]?.trim();
      if (rest) buf.push(rest);
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return out;
}

const firstParagraph = (s?: string): string | undefined => {
  if (!s) return undefined;
  const para = s.split(/\n\s*\n/).map((p) => p.replace(/^[-*+]\s*/gm, '').replace(/\s+/g, ' ').trim()).find((p) => p.length > 24 || (p.length > 0 && !/^[-=_*#]+$/.test(p)));
  return para?.slice(0, 600);
};

function bulletList(s?: string, cap = 14): string[] | undefined {
  if (!s) return undefined;
  const items: string[] = [];
  let currentItem = '';
  for (const line of s.split('\n')) {
    const bullet = line.match(/^\s*(?:\d{1,2}[.)]|[-*+•]|step\s*\d+\s*[:.)-]?)\s+(.*)$/i);
    if (bullet) { if (currentItem) items.push(currentItem.trim()); currentItem = stripMd(bullet[1]); }
    else if (currentItem && line.trim() && !/^\s*(?:#{1,6}|```)/.test(line)) currentItem += ' ' + line.trim();
    else if (currentItem) { items.push(currentItem.trim()); currentItem = ''; }
  }
  if (currentItem) items.push(currentItem.trim());
  const clean = items.filter((i) => i.length > 2).slice(0, cap);
  return clean.length >= 2 ? clean : undefined;
}

function codeEvidence(body: string): Evidence[] | undefined {
  const blocks = [...body.matchAll(/```([a-z0-9+#-]*)\n([\s\S]*?)```/gi)];
  const out: Evidence[] = [];
  for (const [, lang, content] of blocks.slice(0, 4)) {
    const code = content.trim();
    if (code.length < 8) continue;
    const isRequest = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+/m.test(code) || /^HTTP\/\d/m.test(code);
    out.push({
      type: isRequest ? 'request' : 'code',
      title: isRequest ? 'Request captured in the report' : 'Snippet from the report',
      content: code.slice(0, 4000),
      language: lang || (isRequest ? 'http' : undefined),
    });
  }
  return out.length ? out : undefined;
}

function references(body: string): { title: string; url: string }[] | undefined {
  const out = new Map<string, string>();
  for (const m of body.matchAll(/\[([^\]]{2,80})\]\((https?:\/\/[^\s)]+)\)/g)) out.set(m[2], m[1]);
  for (const m of body.matchAll(/(?<![([])\bhttps?:\/\/[^\s)>\]]+/g)) {
    const url = m[0].replace(/[.,;]$/, '');
    if (!out.has(url)) out.set(url, url.replace(/^https?:\/\//, '').split('/')[0]);
  }
  const list = [...out].slice(0, 8).map(([url, title]) => ({ title, url }));
  return list.length ? list : undefined;
}

// ------------------------------------------------------------- retest signals

const RESOLVED_PHRASES: RegExp[] = [
  /\bno\s+longer\s+(reproducible|exploitable|vulnerable|present|possible|works?)\b/i,
  /\b(not|cannot|could\s+not|couldn['’]t|unable\s+to)\s+(be\s+)?(reproduce|reproduced|exploit|exploited|replicate|replicated)\b/i,
  /\b(issue|finding|vulnerability|bug)\s+(is\s+|has\s+been\s+|now\s+)?(fixed|resolved|remediated|patched|closed|mitigated)\b/i,
  /\bretest\s+(passed|successful|confirms?\s+the\s+fix)\b/i,
  /\b(fix|patch|remediation)\s+(is\s+)?(confirmed|verified|effective|working|in\s+place)\b/i,
  /\bconfirmed\s+(as\s+)?(fixed|resolved|remediated)\b/i,
  /\bnow\s+(returns|rejects|blocks|requires)\b.{0,40}\b(403|401|error|denied)\b/i,
];

const STILL_PHRASES: RegExp[] = [
  /\bstill\s+(present|vulnerable|reproducible|exploitable|open|there|possible|fails?)\b/i,
  /\b(remains|remain)\s+(open|vulnerable|unresolved|exploitable|present)\b/i,
  /\b(not|never)\s+(yet\s+)?(fixed|resolved|remediated|patched|addressed)\b/i,
  /\bretest\s+(failed|unsuccessful)\b/i,
  /\b(regression|reintroduced|re-?appeared|reoccurred|reopened)\b/i,
  /\bfix\s+(is\s+)?(incomplete|insufficient|partial|bypassable|can\s+be\s+bypassed)\b/i,
  /\bstill\s+able\s+to\b/i,
];

const PARTIAL_PHRASES: RegExp[] = [
  /\bpartially\s+(fixed|resolved|remediated|mitigated)\b/i,
  /\bpartial\s+(fix|remediation|mitigation)\b/i,
  /\bfixed\s+for\s+.{2,40}\bbut\s+(still|not)\b/i,
];

function retestSignal(body: string, sec: Record<string, string>, status?: FindingStatus): RetestSignal {
  const scope = [sec.retest ?? '', sec.summary ?? '', body].join('\n');
  const hit = (list: RegExp[]) => { for (const re of list) { const m = scope.match(re); if (m) return m[0]; } return undefined; };
  const partial = hit(PARTIAL_PHRASES);
  if (partial) return { outcome: 'partially-fixed', evidence: partial };
  const still = hit(STILL_PHRASES);
  const resolved = hit(RESOLVED_PHRASES);
  // "still present" wins ties: never close something the report says is live.
  if (still) return { outcome: 'still-present', evidence: still };
  if (resolved) return { outcome: 'resolved', evidence: resolved };
  if (status === 'fixed' || status === 'verified') return { outcome: 'resolved', evidence: `Status: ${status}` };
  if (/\bre-?test|verification|follow[- ]up\b/i.test(scope)) return { outcome: 'inconclusive', evidence: 'Reads like a re-test but the result is unclear' };
  return { outcome: null };
}

// ------------------------------------------------------- candidate boundaries

const BOUNDARY = /^(?:#{1,4}\s+(.{4,120})|(?:finding|issue|vulnerability|vuln)\s*(?:#|no\.?)?\s*\d+\s*[:.)-]\s*(.{3,120})|\d{1,2}[.)]\s+([A-Z][^\n]{4,120}))$/i;

interface Block { title: string; start: number; end: number }

function splitCandidates(body: string): Block[] {
  const lines = body.split('\n');
  const heads: { title: string; line: number }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(BOUNDARY);
    if (m) heads.push({ title: clampTitle(stripMd(m[1] ?? m[2] ?? m[3] ?? '')), line: i });
  });
  const blocks: Block[] = heads.map((h, i) => ({ title: h.title, start: h.line, end: i + 1 < heads.length ? heads[i + 1].line : lines.length }));
  // A finding section is one that carries its own severity or CVSS score.
  const scored = blocks.filter((b) => {
    const text = lines.slice(b.start, b.end).join('\n');
    return /^\s*(?:[-*+>]\s*)?(?:\*\*|__)?\s*(severity|risk\s+rating|criticality|cvss)/im.test(text) && !SECTION_ALIASES.summary.test(b.title) && !Object.values(SECTION_ALIASES).some((re) => re.test(b.title));
  });
  return scored.length >= 2 ? scored : [{ title: '', start: 0, end: lines.length }];
}

// ----------------------------------------------------------------- the parser

export function parseReport(rawText: string, ctx: ParseContext, meta: { type: IntakeFileType; fileName?: string }): ParsedReport {
  const body = normalise(rawText);
  const warnings: string[] = [];
  if (!body) warnings.push('The document was empty.');

  const lines = body.split('\n');
  const documentTitle = clampTitle(stripMd(lines.find((l) => l.trim() && !/^[-=_*#\s]+$/.test(l.trim())) ?? '')) || (meta.fileName ?? 'Submitted report');
  const docDate = parseDate(labelValue(body, ['date', 'report date', 'tested on', 'test date', 'assessment date']) ?? lines.slice(0, 12).join('\n'), todayISO())!;

  const blocks = splitCandidates(body);
  const candidates = blocks.map((b) => buildCandidate(lines.slice(b.start, b.end).join('\n').trim(), b.title, { body, documentTitle, docDate }, ctx));
  if (blocks.length > 1) warnings.push(`Found ${blocks.length} findings in this document — review each one below.`);

  return { documentTitle, date: docDate, candidates, warnings, type: meta.type, fileName: meta.fileName, body };
}

function buildCandidate(
  section: string,
  blockTitle: string,
  doc: { body: string; documentTitle: string; docDate: string },
  ctx: ParseContext,
): Candidate {
  const extracted: string[] = [];
  const found = <T>(label: string, value: T | undefined): T | undefined => { if (value !== undefined && value !== '') extracted.push(label); return value; };
  // Document-level labels (reporter, engagement, date) may sit in a header above the section.
  const scoped = (names: string[]) => labelValue(section, names) ?? labelValue(doc.body, names);
  const sec = sections(section);

  const rawTitle = found('Title', labelValue(section, ['title', 'finding', 'vulnerability', 'issue', 'name'])
    ?? (blockTitle || undefined)
    ?? (doc.documentTitle !== 'Submitted report' ? doc.documentTitle : undefined));
  const title = rawTitle ? clampTitle(rawTitle) : 'Untitled finding';

  const cvssMatch = section.match(/cvss[^\n]{0,24}?(\d{1,2}(?:\.\d)?)\s*(?:\/\s*10)?/i);
  const vector = section.match(/\b(?:CVSS:[34]\.\d\/)?AV:[NALP]\/AC:[LHM](?:\/[A-Z]{1,2}:[A-Z]+)+/i)?.[0];
  const score = cvssMatch && Number(cvssMatch[1]) <= 10 ? Number(cvssMatch[1]) : undefined;
  const cvss = found('CVSS', score !== undefined ? { score, vector, version: /cvss:?\s*4\.0/i.test(section) ? ('4.0' as const) : ('3.1' as const) } : undefined);

  const severity = found('Severity', parseSeverity(scoped(['severity', 'risk rating', 'risk level', 'criticality', 'rating', 'risk'])))
    ?? (score !== undefined ? found('Severity', severityFromCvss(score)) : undefined)
    ?? 'medium';

  const cweIds = [...new Set([...section.matchAll(/\b(CWE-\d{1,4}|SWC-\d{3})\b/gi)].map((m) => m[1].toUpperCase()))].slice(0, 6);
  const owasp = section.match(/\bA\d{2}:20\d{2}[^\n,;]{0,40}/)?.[0] ?? section.match(/\bOWASP\s+A\d{1,2}[^\n,;]{0,40}/i)?.[0];

  const statusLabel = parseStatus(labelValue(section, ['status', 'state', 'current status']));
  const retest = retestSignal(section, sec, statusLabel);

  const discovered = found('Discovered', parseDate(scoped(['discovered', 'date discovered', 'found on', 'identified on', 'tested on', 'test date', 'date']), undefined)) ?? doc.docDate;
  const reported = found('Reported', parseDate(scoped(['reported', 'reported on', 'submitted', 'disclosed']), undefined));

  const reporterName = scoped(['reporter', 'tested by', 'author', 'analyst', 'prepared by', 'found by', 'researcher']);
  const reporter = found('Reporter', matchMember(reporterName, ctx.team));

  const engagement = found('Engagement', matchEngagement(section, doc.body, ctx));
  const assets = found('Assets', matchAssets(section, ctx.assets));

  const target = scoped(['target', 'affected asset', 'affected system', 'host', 'application', 'system', 'url', 'domain', 'repository', 'repo']);
  const endpoint = labelValue(section, ['endpoint', 'affected endpoint', 'path', 'route', 'request'])
    ?? section.match(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[\w\-./{}:%]*)/)?.[1]
    ?? section.match(/https?:\/\/[^\s)"']+(\/[\w\-./{}%]+)/)?.[1];
  const file = labelValue(section, ['file', 'affected file', 'source file', 'location', 'module'])
    ?? section.match(/\b[\w./-]+\.(?:sol|ts|tsx|js|jsx|py|go|rs|java|php|rb|cs|yml|yaml|tf|json)\b(?::\d+)?/)?.[0];
  const contract = labelValue(section, ['contract', 'smart contract']) ?? section.match(/\b[A-Z][A-Za-z0-9_]*\.sol\b/)?.[0];
  const fn = labelValue(section, ['function', 'method']) ?? section.match(/\bfunction\s+([A-Za-z_]\w*)\s*\(/)?.[1];
  const affected = compact({
    component: labelValue(section, ['component', 'service', 'affected component']) ?? (endpoint ? undefined : target),
    endpoint, file, contract, function: fn,
    network: labelValue(section, ['network', 'chain', 'environment']),
    version: labelValue(section, ['version', 'affected version']),
  });
  if (affected) extracted.push('Affected component');

  const summary = found('Summary', firstParagraph(sec.summary) ?? firstParagraph(sec.description) ?? firstParagraph(sec.impact) ?? firstParagraph(stripHeader(section, title)))
    ?? `${title} — see the attached report for details.`;
  const description = found('Description', clean(sec.description) ?? clean(sec.affected));
  const impact = found('Impact', clean(sec.impact));
  const steps = found('Steps to reproduce', bulletList(sec.steps));
  const remediationText = clean(sec.remediation);
  const remediation = found('Remediation', remediationText ? { recommendation: remediationText.slice(0, 1500) } : undefined);
  const refs = found('References', references(section));
  const evidence = found('Evidence', codeEvidence(section));
  const tags = found('Tags', splitList(labelValue(section, ['tags', 'category', 'categories', 'labels'])));
  const effortHours = found('Effort', numberFrom(labelValue(section, ['time spent', 'effort', 'hours', 'time'])));
  const financialExposure = found('Financial exposure', moneyFrom(labelValue(section, ['financial exposure', 'potential loss', 'estimated loss', 'exposure'])));
  const exploited = /\b(successfully\s+(exploited|extracted|retrieved|bypassed)|proof[- ]of[- ]concept\s+(worked|succeeded|confirmed)|we\s+were\s+able\s+to)\b/i.test(section) || undefined;

  const draft: Omit<Finding, 'id'> = compactRecord({
    title,
    severity,
    status: statusLabel ?? 'open',
    engagement,
    cvss,
    cwe: cweIds.length ? cweIds : undefined,
    owasp,
    tags,
    reporter,
    discovered,
    reported,
    assets,
    affected,
    summary,
    description,
    impact,
    stepsToReproduce: steps,
    evidence,
    remediation,
    references: refs,
    attack: financialExposure || exploited ? compact({ financialExposure, exploited }) : undefined,
    effortHours,
    source: 'report-intake',
  }) as Omit<Finding, 'id'>;

  return { draft, extracted, retest, body: section, reporterName };
}

// ------------------------------------------------------------------- matching

function matchMember(name: string | undefined, team: TeamMember[]): string | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().replace(/[^a-z0-9@. ]/g, '').trim();
  if (!n) return undefined;
  for (const m of team) {
    const handle = m.handle?.toLowerCase().replace(/^@/, '');
    if (m.id.toLowerCase() === n) return m.id;
    if (m.name.toLowerCase() === n || n.includes(m.name.toLowerCase())) return m.id;
    if (m.email && n.includes(m.email.toLowerCase())) return m.id;
    if (handle && (n === handle || n.includes(`@${handle}`))) return m.id;
    const first = m.name.split(/\s+/)[0].toLowerCase();
    if (first.length > 2 && new RegExp(`\\b${first}\\b`).test(n)) return m.id;
  }
  return undefined;
}

function matchEngagement(section: string, body: string, ctx: ParseContext): string | undefined {
  const explicit = labelValue(section, ['engagement', 'engagement id', 'assessment', 'project']) ?? labelValue(body, ['engagement', 'engagement id', 'assessment', 'project']);
  if (explicit) {
    const byId = ctx.engagements.find((e) => e.id.toLowerCase() === explicit.toLowerCase());
    if (byId) return byId.id;
    const byTitle = ctx.engagements.find((e) => e.title.toLowerCase() === explicit.toLowerCase() || explicit.toLowerCase().includes(e.title.toLowerCase()));
    if (byTitle) return byTitle.id;
  }
  const idInText = body.match(/\bARK-E-\d{4}-\d{4}\b/i)?.[0].toUpperCase();
  if (idInText && ctx.engagements.some((e) => e.id === idInText)) return idInText;
  // Fall back to a live engagement whose target is named in the report.
  const active = ctx.engagements.filter((e) => e.status === 'in-progress' || e.status === 'ongoing');
  const text = body.toLowerCase();
  for (const e of [...active, ...ctx.engagements]) {
    const target = e.target?.toLowerCase();
    if (target && target.length > 3 && text.includes(target)) return e.id;
  }
  return undefined;
}

function matchAssets(section: string, assets: Asset[]): string[] | undefined {
  const text = section.toLowerCase();
  const hits = assets.filter((a) => {
    if (new RegExp(`\\b${escapeRe(a.id.toLowerCase())}\\b`).test(text)) return true;
    return a.name.length > 3 && text.includes(a.name.toLowerCase());
  }).map((a) => a.id).slice(0, 4);
  return hits.length ? hits : undefined;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// -------------------------------------------------------------------- helpers

function stripHeader(section: string, title: string): string {
  return section.split('\n').filter((l) => stripMd(l) !== title && !/^\s*(?:[-*+>]\s*)?(?:\*\*|__)?\s*(severity|cvss|status|date|reporter|tested by|engagement|cwe|target)\b/i.test(l)).join('\n');
}

function clean(s?: string): string | undefined {
  if (!s) return undefined;
  const out = s.replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n').trim();
  return out.length > 2 ? out.slice(0, 4000) : undefined;
}

function splitList(s?: string): string[] | undefined {
  if (!s) return undefined;
  const list = s.split(/[,;/]|\s{2,}/).map((t) => stripMd(t).toLowerCase().replace(/\s+/g, '-')).filter((t) => t.length > 1).slice(0, 8);
  return list.length ? list : undefined;
}

function numberFrom(s?: string): number | undefined {
  const n = s?.match(/(\d+(?:\.\d+)?)/);
  return n ? Number(n[1]) : undefined;
}

function moneyFrom(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([km]|million|thousand)?/i);
  if (!m) return undefined;
  const mult = /^m|million/i.test(m[2] ?? '') ? 1e6 : /^k|thousand/i.test(m[2] ?? '') ? 1e3 : 1;
  return Number(m[1]) * mult;
}

/** Drop undefined keys; return undefined when nothing is left. */
function compact<T extends object>(o: T): T | undefined {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
  return Object.keys(out).length ? out : undefined;
}
function compactRecord<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
}
