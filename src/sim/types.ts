import type { AttackClass, Severity } from '@/types';

export type NodeRole = 'attacker' | 'entry' | 'system' | 'data' | 'user' | 'asset' | 'external' | 'internal' | 'contract' | 'funds' | 'network';

export interface FlowNode {
  id: string;
  label: string;
  role: NodeRole;
  /** normalised 0..1 position on the canvas */
  x: number;
  y: number;
  icon?: string;
  /** stage index at which this node becomes compromised/active */
  activeAt?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** stage index at which this edge fires */
  at: number;
  label?: string;
  kind?: 'attack' | 'data' | 'lateral' | 'exfil';
}

export interface Stage {
  /** short kill-chain phase name */
  phase: string;
  title: string;
  /** plain-English narration aimed at non-technical readers */
  narrative: string;
  /** the concrete technique in security terms */
  technique?: string;
  /** what stops it */
  defence?: string;
  mitre?: string;
  /** node ids that light up at this stage */
  activate?: string[];
  /** edge fired going into this stage (index into edges) */
  edge?: number;
}

export type DamageDim = 'confidentiality' | 'integrity' | 'availability' | 'financial' | 'reputation' | 'compliance' | 'safety';

export interface DamageScore {
  dim: DamageDim;
  label: string;
  /** 0..100 */
  score: number;
  note: string;
}

export interface Simulation {
  class: AttackClass;
  classLabel: string;
  confidence: number;
  reason: string;
  severity: Severity;
  /** one-line "what an attacker does" */
  headline: string;
  /** everyday-language analogy for non-technical audiences */
  analogy: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  stages: Stage[];
  damage: DamageScore[];
  /** aggregate 0..100 potential-impact score */
  impactScore: number;
  /** estimated blast radius description */
  blastRadius: string;
  /** who/what is affected in plain terms */
  affects: string[];
  /** the single most important control */
  keyControl: string;
  /** estimated financial exposure if known */
  financialExposure?: number;
  /** ATT&CK-style tactic labels covered */
  tactics: string[];
}
