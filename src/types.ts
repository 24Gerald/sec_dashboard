/**
 * ARK STUDIOS Security Dashboard — content schema.
 *
 * Every record lives as a JSON file under /content (one object, or an array of
 * objects, per file). These types are the contract for those files, for the
 * authoring API (server/index.js) and for the SOC bot ingest endpoint.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export type FindingStatus =
  | 'open'
  | 'triaged'
  | 'in-remediation'
  | 'fixed'
  | 'verified'
  | 'risk-accepted'
  | 'false-positive'
  | 'wont-fix';
export const FINDING_STATUSES: FindingStatus[] = [
  'open', 'triaged', 'in-remediation', 'fixed', 'verified', 'risk-accepted', 'false-positive', 'wont-fix',
];
/** Statuses that still represent live risk. */
export const OPEN_STATUSES: FindingStatus[] = ['open', 'triaged', 'in-remediation'];

export type EngagementType =
  | 'vulnerability-assessment'
  | 'smart-contract-audit'
  | 'penetration-test'
  | 'load-test'
  | 'bug-hunt'
  | 'network-traffic-analysis'
  | 'code-review'
  | 'red-team'
  | 'soc-monitoring'
  | 'incident-response'
  | 'security-architecture'
  | 'compliance-review'
  | 'threat-model'
  | 'training'
  | 'other';
export const ENGAGEMENT_TYPES: EngagementType[] = [
  'vulnerability-assessment', 'smart-contract-audit', 'penetration-test', 'load-test', 'bug-hunt',
  'network-traffic-analysis', 'code-review', 'red-team', 'soc-monitoring', 'incident-response',
  'security-architecture', 'compliance-review', 'threat-model', 'training', 'other',
];

export type EngagementStatus = 'planned' | 'scheduled' | 'in-progress' | 'completed' | 'ongoing' | 'on-hold' | 'cancelled';
export const ENGAGEMENT_STATUSES: EngagementStatus[] = ['planned', 'scheduled', 'in-progress', 'ongoing', 'completed', 'on-hold', 'cancelled'];

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
export const TASK_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'review', 'done', 'blocked'];

export type Priority = 'p0' | 'p1' | 'p2' | 'p3';

export type AssetType =
  | 'web-app' | 'api' | 'mobile-app' | 'smart-contract' | 'server' | 'network' | 'cloud'
  | 'database' | 'repository' | 'service' | 'endpoint' | 'wallet' | 'other';

export type Criticality = 'critical' | 'high' | 'medium' | 'low';

/** Attack classes the simulator understands. `auto` lets the classifier decide. */
export type AttackClass =
  | 'auto'
  | 'sql-injection' | 'command-injection' | 'xss' | 'csrf' | 'ssrf' | 'xxe' | 'path-traversal'
  | 'deserialization' | 'rce' | 'file-upload'
  | 'auth-bypass' | 'weak-credentials' | 'session-management' | 'idor' | 'privilege-escalation' | 'jwt-flaw'
  | 'secrets-exposure' | 'info-disclosure' | 'misconfiguration' | 'outdated-component' | 'weak-crypto'
  | 'business-logic' | 'race-condition' | 'rate-limit' | 'dos' | 'resource-exhaustion'
  | 'reentrancy' | 'access-control-contract' | 'integer-overflow' | 'oracle-manipulation' | 'flash-loan'
  | 'front-running' | 'unchecked-call' | 'signature-replay' | 'upgradeability' | 'denial-of-service-contract'
  | 'mitm' | 'cleartext-traffic' | 'open-port' | 'network-segmentation' | 'dns' | 'lateral-movement'
  | 'phishing' | 'social-engineering' | 'supply-chain' | 'malware' | 'insider'
  | 'generic';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  handle?: string;
  email?: string;
  avatar?: string;
  skills?: string[];
  active?: boolean;
  bio?: string;
}

export interface Org {
  name: string;
  unit?: string;
  tagline?: string;
  timezone?: string;
  /** When true the UI shows a "sample data" banner. Set false once real content is in. */
  sampleData?: boolean;
  team: TeamMember[];
  soc?: {
    botName?: string;
    description?: string;
    status?: 'planned' | 'building' | 'live' | 'paused';
  };
  presentation?: {
    subtitle?: string;
    footer?: string;
    /** Default rolling window (in days) the deck presents. Defaults to 7; null presents everything. */
    windowDays?: number | null;
  };
}

export type EvidenceType = 'screenshot' | 'code' | 'request' | 'response' | 'log' | 'file' | 'link' | 'poc' | 'transaction' | 'note';

export interface Evidence {
  type: EvidenceType;
  title?: string;
  description?: string;
  /** Path relative to /content/evidence (screenshots, files) */
  path?: string;
  /** Inline code / request / log content */
  content?: string;
  language?: string;
  /** Source file this snippet came from, plus the line range and highlighted lines */
  file?: string;
  lines?: [number, number];
  highlight?: number[];
  url?: string;
  /** For on-chain evidence */
  txHash?: string;
  chain?: string;
}

export type TimelineEventType =
  | 'discovered' | 'reported' | 'triaged' | 'acknowledged' | 'fix-started' | 'fixed' | 'verified'
  | 'reopened' | 'accepted' | 'escalated' | 'closed' | 'note' | 'retest';

export interface TimelineEvent {
  date: string;
  type: TimelineEventType;
  by?: string;
  note?: string;
}

export interface AttackMeta {
  /** Override automatic classification */
  class?: AttackClass;
  vector?: 'network' | 'adjacent' | 'local' | 'physical' | 'on-chain' | 'social';
  entryPoint?: string;
  authRequired?: 'none' | 'user' | 'privileged';
  complexity?: 'low' | 'high';
  /** How far the damage can spread */
  reach?: 'single-user' | 'multi-user' | 'system' | 'organisation' | 'ecosystem';
  dataAtRisk?: string[];
  /** Estimated financial exposure, in the org's currency */
  financialExposure?: number;
  mitre?: string[];
  /** Whether the finding was exploited for real during the engagement */
  exploited?: boolean;
}

export interface Remediation {
  recommendation: string;
  effort?: 'trivial' | 'low' | 'medium' | 'high';
  owner?: string;
  status?: 'not-started' | 'planned' | 'in-progress' | 'done' | 'verified';
  verification?: string;
  eta?: string;
  /** Suggested / applied code fix */
  patch?: string;
  patchLanguage?: string;
}

/** Outcome of re-testing a finding that was already logged. */
export type RetestOutcome = 'still-present' | 'resolved' | 'partially-fixed' | 'inconclusive';
export const RETEST_OUTCOMES: RetestOutcome[] = ['still-present', 'resolved', 'partially-fixed', 'inconclusive'];

/**
 * One re-test of an existing finding. Written by the report intake when a
 * submitted report is recognised as the same issue, so the day the retest
 * happened still shows up as work even though no new finding was created.
 */
export interface Retest {
  date: string;
  outcome: RetestOutcome;
  by?: string;
  note?: string;
  /** Report record holding the submitted document */
  reportId?: string;
  /** How the retest was recorded */
  via?: 'intake' | 'manual';
  /** Match confidence 0–1 when the intake matched this automatically */
  confidence?: number;
}

/** Where an intake-created record came from. */
export interface IntakeMeta {
  fileName?: string;
  fileType?: 'txt' | 'md' | 'pdf' | 'docx' | 'paste';
  importedAt: string;
  /** Fields the parser filled in, for transparency in the UI */
  extracted?: string[];
}

export interface Finding {
  id: string;
  title: string;
  engagement?: string;
  severity: Severity;
  status: FindingStatus;
  cvss?: { score: number; vector?: string; version?: '3.1' | '4.0' };
  cwe?: string[];
  owasp?: string;
  category?: string;
  tags?: string[];
  assignee?: string;
  reporter?: string;
  discovered: string;
  reported?: string;
  due?: string;
  fixedAt?: string;
  verifiedAt?: string;
  assets?: string[];
  affected?: {
    component?: string;
    file?: string;
    function?: string;
    endpoint?: string;
    contract?: string;
    network?: string;
    version?: string;
  };
  /** One-paragraph plain-English summary for non-technical readers */
  summary: string;
  /** Markdown */
  description?: string;
  /** Markdown */
  impact?: string;
  stepsToReproduce?: string[];
  evidence?: Evidence[];
  remediation?: Remediation;
  references?: { title: string; url: string }[];
  attack?: AttackMeta;
  timeline?: TimelineEvent[];
  effortHours?: number;
  /** Re-tests of this same issue, newest last. */
  retests?: Retest[];
  /** Last day anything happened to this finding — drives the presentation window. */
  lastActivity?: string;
  /** Reports this finding was logged or re-tested from. */
  reports?: string[];
  /** Set by the SOC bot or the report intake when a finding is auto-created */
  source?: 'manual' | 'soc-bot' | 'scanner' | 'import' | 'report-intake';
  intake?: IntakeMeta;
  sample?: boolean;
}

export interface Deliverable {
  title: string;
  type: 'report' | 'slides' | 'spreadsheet' | 'repo' | 'video' | 'other';
  path?: string;
  url?: string;
}

export interface Engagement {
  id: string;
  title: string;
  type: EngagementType;
  status: EngagementStatus;
  target?: string;
  client?: string;
  startDate: string;
  endDate?: string;
  lead?: string;
  team?: string[];
  /** Markdown */
  summary: string;
  scope?: string[];
  objectives?: string[];
  methodology?: string[];
  tools?: string[];
  deliverables?: Deliverable[];
  /** Free-form effort/coverage numbers shown as stat tiles (e.g. hoursSpent, hostsScanned, contractsReviewed) */
  metrics?: Record<string, number | string>;
  highlights?: string[];
  reportId?: string;
  tags?: string[];
  sample?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: string;
  reporter?: string;
  created: string;
  due?: string;
  completed?: string;
  engagement?: string;
  finding?: string;
  tags?: string[];
  checklist?: { text: string; done: boolean }[];
  effortHours?: number;
  sample?: boolean;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  description?: string;
  owner?: string;
  criticality: Criticality;
  environment?: 'production' | 'staging' | 'development' | 'testnet' | 'mainnet' | 'internal';
  location?: string;
  technologies?: string[];
  dependsOn?: string[];
  exposure?: 'public' | 'internal' | 'private';
  dataClassification?: string[];
  tags?: string[];
  sample?: boolean;
}

export type SocCategory =
  | 'intrusion' | 'malware' | 'anomaly' | 'auth' | 'config-drift' | 'vuln-scan' | 'availability'
  | 'data-exfil' | 'policy' | 'on-chain' | 'info';

export interface SocEvent {
  id: string;
  timestamp: string;
  source: string;
  severity: Severity;
  category: SocCategory;
  title: string;
  message: string;
  asset?: string;
  rule?: string;
  raw?: Record<string, unknown>;
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false-positive';
  linkedFinding?: string;
  sample?: boolean;
}

export interface Report {
  id: string;
  title: string;
  engagement?: string;
  date: string;
  author?: string;
  type: 'assessment' | 'audit' | 'pentest' | 'load-test' | 'summary' | 'incident' | 'executive' | 'other';
  /** Markdown file under /content/reports */
  path: string;
  summary?: string;
  tags?: string[];
  /** Primary finding this report logged or re-tested (legacy / convenience) */
  finding?: string;
  /** All findings logged or re-tested from this report (one report → many findings) */
  findings?: string[];
  intake?: IntakeMeta;
  sample?: boolean;
}

/** Things the team has BUILT (tooling, bots, pipelines, hardening work). */
export interface Build {
  id: string;
  title: string;
  kind: 'tool' | 'bot' | 'pipeline' | 'policy' | 'integration' | 'hardening' | 'documentation' | 'other';
  status: 'idea' | 'planned' | 'building' | 'shipped' | 'maintained' | 'retired';
  description: string;
  owner?: string;
  team?: string[];
  started?: string;
  shipped?: string;
  repo?: string;
  links?: { title: string; url: string }[];
  impact?: string;
  engagement?: string;
  tags?: string[];
  sample?: boolean;
}

export type SlideKind =
  | 'title' | 'agenda' | 'exec-summary' | 'kpis' | 'severity' | 'engagements' | 'engagement'
  | 'finding' | 'simulation' | 'remediation' | 'roadmap' | 'team' | 'soc' | 'builds' | 'markdown' | 'closing'
  | 'activity';

export interface SlideSpec {
  kind: SlideKind;
  /** Reference id for engagement/finding/simulation slides */
  ref?: string;
  title?: string;
  /** Markdown body for 'markdown' slides */
  body?: string;
  notes?: string;
}

export interface Deck {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  presenter?: string;
  audience?: 'executive' | 'technical' | 'board' | 'client' | 'team';
  slides: SlideSpec[];
  sample?: boolean;
}

export interface Dataset {
  org: Org;
  engagements: Engagement[];
  findings: Finding[];
  tasks: Task[];
  assets: Asset[];
  socEvents: SocEvent[];
  reports: Report[];
  builds: Build[];
  decks: Deck[];
  /** markdown bodies keyed by report path */
  markdown: Record<string, string>;
  /** evidence urls keyed by path relative to content/evidence */
  evidence: Record<string, string>;
}

export type RecordKind = 'finding' | 'engagement' | 'task' | 'asset' | 'socEvent' | 'report' | 'build' | 'deck';
