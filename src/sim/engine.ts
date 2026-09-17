import type { Finding, AttackClass } from '@/types';
import type { Simulation } from './types';
import { classifyFinding } from './classify';
import { templateFor, type TemplateCtx } from './templates';
import { damageProfile } from './damage';

const CLASS_LABEL: Record<string, string> = {
  'sql-injection': 'SQL Injection', 'command-injection': 'Command Injection', xss: 'Cross-Site Scripting', csrf: 'Cross-Site Request Forgery',
  ssrf: 'Server-Side Request Forgery', xxe: 'XML External Entity', 'path-traversal': 'Path Traversal', deserialization: 'Insecure Deserialization',
  rce: 'Remote Code Execution', 'file-upload': 'Unrestricted File Upload', 'auth-bypass': 'Authentication Bypass', 'weak-credentials': 'Weak / Default Credentials',
  'session-management': 'Session Management Flaw', idor: 'Insecure Direct Object Reference', 'privilege-escalation': 'Privilege Escalation', 'jwt-flaw': 'Token / JWT Flaw',
  'secrets-exposure': 'Exposed Secret', 'info-disclosure': 'Information Disclosure', misconfiguration: 'Security Misconfiguration', 'outdated-component': 'Vulnerable / Outdated Component',
  'weak-crypto': 'Weak Cryptography', 'business-logic': 'Business Logic Flaw', 'race-condition': 'Race Condition', 'rate-limit': 'Missing Rate Limiting',
  dos: 'Denial of Service', 'resource-exhaustion': 'Resource Exhaustion', reentrancy: 'Reentrancy', 'access-control-contract': 'Missing Access Control (Contract)',
  'integer-overflow': 'Integer Overflow / Underflow', 'oracle-manipulation': 'Price Oracle Manipulation', 'flash-loan': 'Flash Loan Attack', 'front-running': 'Front-Running / MEV',
  'unchecked-call': 'Unchecked External Call', 'signature-replay': 'Signature Replay', upgradeability: 'Upgradeability Flaw', 'denial-of-service-contract': 'Contract Denial of Service',
  mitm: 'Man-in-the-Middle', 'cleartext-traffic': 'Cleartext Transmission', 'open-port': 'Exposed Service / Open Port', 'network-segmentation': 'Poor Network Segmentation',
  dns: 'DNS Attack', 'lateral-movement': 'Lateral Movement', phishing: 'Phishing', 'social-engineering': 'Social Engineering', 'supply-chain': 'Supply Chain Attack',
  malware: 'Malware / Ransomware', insider: 'Insider Threat', generic: 'Security Weakness', auto: 'Security Weakness',
};

export function classLabel(cls: AttackClass): string { return CLASS_LABEL[cls] ?? 'Security Weakness'; }

function affectLabels(f: Finding): { target: string; dataLabel: string; entryLabel: string } {
  const a = f.affected ?? {};
  const target = a.contract || a.component || a.endpoint || a.file || a.network || f.assets?.[0] || 'the target system';
  const dataLabel = (f.attack?.dataAtRisk && f.attack.dataAtRisk.join(', ')) || defaultData(f);
  const entryLabel = a.endpoint || a.contract || a.component || f.attack?.entryPoint || 'the exposed interface';
  return { target: short(target), dataLabel: short(dataLabel, 42), entryLabel: short(entryLabel) };
}
function defaultData(f: Finding): string {
  const t = (f.title + ' ' + f.summary).toLowerCase();
  if (/wallet|token|fund|treasury|liquidity|vault|defi|swap|stake/.test(t)) return 'user funds';
  if (/payment|card|invoice|transaction|billing/.test(t)) return 'payment data';
  if (/user|customer|account|profile|pii|personal|email/.test(t)) return 'customer records';
  if (/health|medical|patient/.test(t)) return 'health records';
  return 'sensitive data';
}
function short(s: string, max = 26): string { s = s.trim(); return s.length > max ? s.slice(0, max - 1) + '…' : s; }

/** Build a full simulation for a finding. Deterministic — same finding, same result. */
export function simulate(f: Finding, engagementType?: string): Simulation {
  const { cls, confidence, reason } = classifyFinding(f, engagementType);
  const { template, usedClass } = templateFor(cls);
  const ctx: TemplateCtx = affectLabels(f);
  const { nodes, edges, stages } = template.build(ctx);
  const { scores, impact, financialExposure } = damageProfile(usedClass, f.severity, f.attack?.financialExposure);

  return {
    class: cls,
    classLabel: classLabel(cls),
    confidence,
    reason,
    severity: f.severity,
    headline: template.headline,
    analogy: template.analogy,
    nodes,
    edges,
    stages,
    damage: scores,
    impactScore: impact,
    blastRadius: template.blastRadius,
    affects: f.attack?.dataAtRisk?.length ? [`${ctx.dataLabel} at risk`, ...template.affects.slice(1)] : template.affects,
    keyControl: f.remediation?.recommendation ? template.keyControl : template.keyControl,
    financialExposure,
    tactics: template.tactics,
  };
}

export { CLASS_LABEL };
