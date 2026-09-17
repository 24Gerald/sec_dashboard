import type { FlowNode, FlowEdge, NodeRole } from './types';

/** Node placement helpers on a 0..1 canvas. */
export function node(id: string, label: string, role: NodeRole, x: number, y: number, activeAt?: number): FlowNode {
  return { id, label, role, x, y, activeAt };
}
export function edge(from: string, to: string, at: number, label?: string, kind: FlowEdge['kind'] = 'attack'): FlowEdge {
  return { from, to, at, label, kind };
}

/** A linear chain laid left-to-right, evenly spaced. Attacker is always node 0. */
export function chain(labels: { id: string; label: string; role: NodeRole }[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const n = labels.length;
  const nodes = labels.map((l, i) => node(l.id, l.label, l.role, n === 1 ? 0.5 : 0.08 + (0.84 * i) / (n - 1), 0.5, i === 0 ? 0 : i));
  const edges = labels.slice(1).map((l, i) => edge(labels[i].id, l.id, i + 1));
  return { nodes, edges };
}

/** Hub-and-spoke: attacker → entry → hub, hub fans out to spokes (data/users/systems). */
export function hub(entry: { id: string; label: string; role: NodeRole }, hubNode: { id: string; label: string; role: NodeRole }, spokes: { id: string; label: string; role: NodeRole }[], spokeStage = 3): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [
    node('attacker', 'Attacker', 'attacker', 0.06, 0.5, 0),
    node(entry.id, entry.label, entry.role, 0.3, 0.5, 1),
    node(hubNode.id, hubNode.label, hubNode.role, 0.56, 0.5, 2),
  ];
  const edges: FlowEdge[] = [edge('attacker', entry.id, 1), edge(entry.id, hubNode.id, 2)];
  const m = spokes.length;
  spokes.forEach((s, i) => {
    const y = m === 1 ? 0.5 : 0.12 + (0.76 * i) / (m - 1);
    nodes.push(node(s.id, s.label, s.role, 0.86, y, spokeStage));
    edges.push(edge(hubNode.id, s.id, spokeStage, undefined, s.role === 'data' ? 'exfil' : 'lateral'));
  });
  return { nodes, edges };
}
