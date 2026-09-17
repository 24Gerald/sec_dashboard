import type { AttackClass, Severity } from '@/types';
import type { DamageScore, DamageDim } from './types';

/** Base damage profile per class: 0..100 per dimension (before severity scaling). */
type Profile = Partial<Record<DamageDim, number>>;

const PROFILES: Record<AttackClass, Profile> = {
  auto: { confidentiality: 50, integrity: 50, availability: 40 },
  generic: { confidentiality: 50, integrity: 45, availability: 40, reputation: 40 },
  'sql-injection': { confidentiality: 95, integrity: 80, availability: 45, compliance: 85, reputation: 75, financial: 70 },
  'command-injection': { confidentiality: 90, integrity: 90, availability: 80, financial: 65, reputation: 75 },
  xss: { confidentiality: 70, integrity: 65, availability: 20, reputation: 60, financial: 40 },
  csrf: { integrity: 75, confidentiality: 40, financial: 55, reputation: 45 },
  ssrf: { confidentiality: 85, integrity: 55, availability: 40, financial: 55, reputation: 55 },
  xxe: { confidentiality: 85, availability: 55, integrity: 40, reputation: 50 },
  'path-traversal': { confidentiality: 88, integrity: 40, availability: 35, compliance: 70 },
  deserialization: { confidentiality: 85, integrity: 88, availability: 80, financial: 60, reputation: 70 },
  rce: { confidentiality: 95, integrity: 95, availability: 90, financial: 80, reputation: 90, compliance: 80 },
  'file-upload': { confidentiality: 80, integrity: 85, availability: 70, reputation: 65 },
  'auth-bypass': { confidentiality: 90, integrity: 80, availability: 40, compliance: 80, reputation: 80, financial: 65 },
  'weak-credentials': { confidentiality: 80, integrity: 70, availability: 40, reputation: 65, financial: 55 },
  'session-management': { confidentiality: 75, integrity: 70, reputation: 55, financial: 50 },
  idor: { confidentiality: 90, integrity: 55, compliance: 85, reputation: 75, financial: 55 },
  'privilege-escalation': { confidentiality: 90, integrity: 90, availability: 60, compliance: 75, reputation: 80 },
  'jwt-flaw': { confidentiality: 85, integrity: 80, reputation: 65, financial: 55 },
  'secrets-exposure': { confidentiality: 95, integrity: 75, availability: 55, financial: 75, reputation: 85, compliance: 80 },
  'info-disclosure': { confidentiality: 70, integrity: 20, reputation: 45, compliance: 50 },
  misconfiguration: { confidentiality: 70, integrity: 55, availability: 50, reputation: 50, compliance: 60 },
  'outdated-component': { confidentiality: 75, integrity: 75, availability: 70, reputation: 55, compliance: 55 },
  'weak-crypto': { confidentiality: 80, integrity: 60, compliance: 75, reputation: 55 },
  'business-logic': { integrity: 80, financial: 85, confidentiality: 40, reputation: 60 },
  'race-condition': { integrity: 80, financial: 85, availability: 40 },
  'rate-limit': { confidentiality: 55, availability: 65, integrity: 45, financial: 50, reputation: 45 },
  dos: { availability: 95, financial: 70, reputation: 65, integrity: 15 },
  'resource-exhaustion': { availability: 90, financial: 70, reputation: 60, integrity: 20, safety: 30 },
  reentrancy: { financial: 98, integrity: 85, reputation: 90, availability: 40 },
  'access-control-contract': { financial: 95, integrity: 90, reputation: 88, availability: 55 },
  'integer-overflow': { financial: 90, integrity: 85, reputation: 75 },
  'oracle-manipulation': { financial: 95, integrity: 80, reputation: 85 },
  'flash-loan': { financial: 98, integrity: 75, reputation: 88, availability: 35 },
  'front-running': { financial: 80, integrity: 60, reputation: 55 },
  'unchecked-call': { financial: 75, integrity: 70, availability: 45 },
  'signature-replay': { financial: 88, integrity: 82, reputation: 70 },
  upgradeability: { financial: 92, integrity: 90, reputation: 85, availability: 60 },
  'denial-of-service-contract': { availability: 88, financial: 70, reputation: 65 },
  mitm: { confidentiality: 90, integrity: 75, reputation: 60, compliance: 70 },
  'cleartext-traffic': { confidentiality: 85, integrity: 60, compliance: 75, reputation: 55 },
  'open-port': { confidentiality: 70, integrity: 65, availability: 60, reputation: 50 },
  'network-segmentation': { confidentiality: 75, integrity: 70, availability: 65, reputation: 55 },
  dns: { confidentiality: 70, integrity: 80, availability: 60, reputation: 65 },
  'lateral-movement': { confidentiality: 88, integrity: 85, availability: 65, reputation: 75 },
  phishing: { confidentiality: 85, integrity: 70, financial: 75, reputation: 70, compliance: 55 },
  'social-engineering': { confidentiality: 80, integrity: 70, financial: 70, reputation: 70 },
  'supply-chain': { confidentiality: 90, integrity: 92, availability: 75, financial: 70, reputation: 88, compliance: 65 },
  malware: { confidentiality: 88, integrity: 88, availability: 85, financial: 80, reputation: 85, safety: 40 },
  insider: { confidentiality: 90, integrity: 80, financial: 70, reputation: 75, compliance: 70 },
};

const SEVERITY_SCALE: Record<Severity, number> = { critical: 1, high: 0.85, medium: 0.62, low: 0.4, info: 0.22 };

const DIM_LABEL: Record<DamageDim, string> = {
  confidentiality: 'Data exposure', integrity: 'Data / system tampering', availability: 'Downtime / outage',
  financial: 'Financial loss', reputation: 'Reputation & trust', compliance: 'Regulatory / legal', safety: 'Physical / safety',
};

const NOTE_HIGH: Record<DamageDim, string> = {
  confidentiality: 'Sensitive data can be read and stolen',
  integrity: 'Records or logic can be altered without detection',
  availability: 'The service can be knocked offline',
  financial: 'Direct monetary loss or theft is likely',
  reputation: 'Public trust and brand take a serious hit',
  compliance: 'Breach notification and fines become likely',
  safety: 'Real-world / operational safety could be affected',
};
const NOTE_LOW: Record<DamageDim, string> = {
  confidentiality: 'Limited or no data exposure',
  integrity: 'Little ability to change data',
  availability: 'Minimal effect on uptime',
  financial: 'Low direct financial impact',
  reputation: 'Minor reputational effect',
  compliance: 'Limited regulatory relevance',
  safety: 'No meaningful safety impact',
};

const ORDER: DamageDim[] = ['confidentiality', 'integrity', 'availability', 'financial', 'reputation', 'compliance', 'safety'];

export function damageProfile(cls: AttackClass, severity: Severity, overrideExposure?: number): { scores: DamageScore[]; impact: number; financialExposure?: number } {
  const base = PROFILES[cls] ?? PROFILES.generic;
  const scale = SEVERITY_SCALE[severity];
  const scores: DamageScore[] = ORDER.filter((d) => base[d] !== undefined).map((dim) => {
    const raw = Math.round((base[dim] ?? 0) * scale);
    const note = raw >= 55 ? NOTE_HIGH[dim] : NOTE_LOW[dim];
    return { dim, label: DIM_LABEL[dim], score: Math.min(100, raw), note };
  });
  // Impact = weighted blend favouring the worst dimensions.
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const impact = Math.round(sorted.slice(0, 3).reduce((s, d, i) => s + d.score * [0.5, 0.3, 0.2][i], 0));
  return { scores, impact, financialExposure: overrideExposure };
}

export { DIM_LABEL };
