/** Human-friendly, sortable ids: ARK-F-2026-0042 style. */
export function nextId(prefix: string, existing: string[], year = new Date().getFullYear()): string {
  const re = new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`);
  let max = 0;
  for (const id of existing) {
    const m = id.match(re);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}
export const ID_PREFIX = { finding: 'ARK-F', engagement: 'ARK-E', task: 'ARK-T', asset: 'ARK-A', socEvent: 'ARK-S', report: 'ARK-R', build: 'ARK-B', deck: 'ARK-D' } as const;
