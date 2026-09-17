import type { Simulation, FlowNode, NodeRole } from '@/sim/types';
import { Icon } from './Icon';

const ROLE_ICON: Record<NodeRole, string> = {
  attacker: 'crosshair', entry: 'globe', system: 'server', data: 'database', user: 'users', asset: 'layers',
  external: 'cloud', internal: 'network', contract: 'contract', funds: 'coins', network: 'network',
};
const ROLE_COLOR: Record<NodeRole, string> = {
  attacker: 'var(--attacker)', entry: 'var(--sev-high)', system: 'var(--accent)', data: 'var(--series-5)', user: 'var(--series-1)',
  asset: 'var(--series-3)', external: 'var(--ink-3)', internal: 'var(--series-7)', contract: 'var(--series-4)', funds: 'var(--sev-medium)', network: 'var(--series-7)',
};

/** The kill-chain diagram. Nodes/edges light up as `stage` advances. */
export function AttackFlow({ sim, stage, compact }: { sim: Simulation; stage: number; compact?: boolean }) {
  const W = 760, H = compact ? 240 : 300;
  const nodeById = new Map(sim.nodes.map((n) => [n.id, n]));
  const px = (n: FlowNode) => 40 + n.x * (W - 80);
  const py = (n: FlowNode) => 30 + n.y * (H - 60);
  const isActive = (n: FlowNode) => (n.activeAt ?? 0) <= stage;
  const nodeR = compact ? 20 : 24;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Attack path: ${sim.classLabel}`}>
      <defs>
        <marker id="af-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1l5 3-5 3z" fill="var(--attacker)" /></marker>
        <marker id="af-arrow-dim" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1l5 3-5 3z" fill="var(--line-3)" /></marker>
      </defs>

      {/* edges */}
      {sim.edges.map((e, i) => {
        const a = nodeById.get(e.from), b = nodeById.get(e.to);
        if (!a || !b) return null;
        const ax = px(a), ay = py(a), bx = px(b), by = py(b);
        const active = e.at <= stage;
        const fired = e.at === stage;
        const ang = Math.atan2(by - ay, bx - ax);
        const sx = ax + Math.cos(ang) * nodeR, sy = ay + Math.sin(ang) * nodeR;
        const ex = bx - Math.cos(ang) * (nodeR + 4), ey = by - Math.sin(ang) * (nodeR + 4);
        const mx = (sx + ex) / 2, my = (sy + ey) / 2 - (Math.abs(ay - by) < 6 ? 0 : 14);
        const col = e.kind === 'exfil' ? 'var(--sev-critical)' : e.kind === 'data' ? 'var(--series-1)' : 'var(--attacker)';
        return (
          <g key={i} opacity={active ? 1 : 0.28}>
            <path d={`M${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={active ? col : 'var(--line-3)'} strokeWidth={fired ? 2.6 : 1.8}
              markerEnd={active ? 'url(#af-arrow)' : 'url(#af-arrow-dim)'} className={fired ? 'edge-dash' : ''} />
            {e.label && fired && <text x={mx} y={my - 4} textAnchor="middle" style={{ fontSize: 11, fill: col, fontWeight: 600 }}>{e.label}</text>}
          </g>
        );
      })}

      {/* nodes */}
      {sim.nodes.map((n) => {
        const cx = px(n), cy = py(n), active = isActive(n);
        const col = ROLE_COLOR[n.role];
        const justActivated = (n.activeAt ?? 0) === stage;
        const compromised = n.role !== 'attacker' && active && n.activeAt !== undefined && n.activeAt > 0;
        return (
          <g key={n.id} opacity={active ? 1 : 0.4}>
            {n.role === 'attacker' && active && <circle cx={cx} cy={cy} r={nodeR} fill="none" stroke={col} strokeWidth="2" className="node-pulse" />}
            {justActivated && compromised && <circle cx={cx} cy={cy} r={nodeR + 3} fill="none" stroke="var(--sev-critical)" strokeWidth="2" className="node-pulse" />}
            <circle cx={cx} cy={cy} r={nodeR} fill="var(--bg-2)" stroke={active ? col : 'var(--line-2)'} strokeWidth={active ? 2.2 : 1.5} className={n.role === 'attacker' ? 'attacker-token' : ''} />
            <g transform={`translate(${cx - 9} ${cy - 9})`} style={{ color: active ? col : 'var(--ink-4)' }}>
              <Icon name={ROLE_ICON[n.role]} size={18} strokeWidth={1.8} />
            </g>
            {compromised && active && <g transform={`translate(${cx + nodeR - 8} ${cy - nodeR - 2})`} style={{ color: 'var(--sev-critical)' }}><Icon name="fire" size={13} /></g>}
            <text x={cx} y={cy + nodeR + 13} textAnchor="middle" style={{ fontSize: 11, fill: active ? 'var(--ink-1)' : 'var(--ink-4)', fontWeight: active ? 600 : 400 }}>
              {n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
