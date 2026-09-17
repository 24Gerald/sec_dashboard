import { useMemo, useState } from 'react';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Empty, Stat, SeverityStack } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SearchInput, Select } from '@/components/Filters';
import type { AssetType, Criticality } from '@/types';
import { severityCounts, isOpen } from '@/lib/metrics';
import { humanKey, plural } from '@/lib/format';

const ASSET_ICON: Record<string, string> = {
  'web-app': 'globe', api: 'route', 'mobile-app': 'grid', 'smart-contract': 'contract', server: 'server', network: 'network',
  cloud: 'cloud', database: 'database', repository: 'code', service: 'layers', endpoint: 'target', wallet: 'coins', other: 'file',
};
const CRIT_TONE: Record<Criticality, string> = { critical: 'crit', high: 'high', medium: 'warn', low: 'neutral' };

export function Assets() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState<AssetType | ''>('');
  const [crit, setCrit] = useState<Criticality | ''>('');

  const findingsByAsset = useMemo(() => {
    const m = new Map<string, typeof data.findings>();
    for (const f of data.findings) for (const a of f.assets ?? []) { if (!m.has(a)) m.set(a, []); m.get(a)!.push(f); }
    return m;
  }, [data.findings]);

  const list = useMemo(() => {
    let l = data.assets;
    if (type) l = l.filter((a) => a.type === type);
    if (crit) l = l.filter((a) => a.criticality === crit);
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter((a) => (a.name + (a.description ?? '') + (a.technologies ?? []).join(' ')).toLowerCase().includes(s)); }
    return l;
  }, [data.assets, type, crit, q]);

  const types = [...new Set(data.assets.map((a) => a.type))];
  const critical = data.assets.filter((a) => a.criticality === 'critical').length;
  const withOpen = data.assets.filter((a) => (findingsByAsset.get(a.id) ?? []).some(isOpen)).length;

  return (
    <div className="page">
      <PageHeader eyebrow="Attack surface" title="Assets" sub="The systems, contracts and services the team protects — and the findings against each." />

      <div className="grid grid--4 mb-16">
        <Stat label="Total assets" value={data.assets.length} icon="layers" />
        <Stat label="Business-critical" value={critical} tone={critical ? 'critical' : undefined} icon="fire" />
        <Stat label="With open findings" value={withOpen} tone={withOpen ? 'high' : undefined} icon="bug" />
        <Stat label="Asset types" value={types.length} icon="grid" />
      </div>

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search assets…" />
        <Select value={type} onChange={setType} options={types.map((t) => ({ value: t, label: humanKey(t) }))} all="All types" />
        <Select value={crit} onChange={setCrit} options={(['critical', 'high', 'medium', 'low'] as Criticality[]).map((c) => ({ value: c, label: humanKey(c) }))} all="Any criticality" />
        <div className="toolbar__spacer" />
        <span className="toolbar__count">{plural(list.length, 'asset')}</span>
      </div>

      {list.length ? (
        <div className="grid grid--auto">
          {list.map((a) => {
            const fs = findingsByAsset.get(a.id) ?? [];
            const open = fs.filter(isOpen).length;
            return (
              <Card key={a.id} className="card--pad">
                <div className="row row--between mb-8">
                  <span className="list__icon" style={{ background: `var(--${CRIT_TONE[a.criticality]}-soft)`, color: `var(--${a.criticality === 'critical' ? 'crit' : a.criticality === 'high' ? 'sev-high' : 'accent'})` }}><Icon name={ASSET_ICON[a.type] ?? 'layers'} size={16} /></span>
                  <Badge tone={CRIT_TONE[a.criticality]} size="sm">{a.criticality}</Badge>
                </div>
                <div className="list__title">{a.name}</div>
                <div className="text-xs muted mb-8">{humanKey(a.type)}{a.environment && ` · ${a.environment}`}{a.exposure && ` · ${a.exposure}`}</div>
                {a.description && <p className="text-sm dim" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.description}</p>}
                {a.technologies?.length ? <div className="chips mt-8">{a.technologies.slice(0, 5).map((t) => <span key={t} className="chip">{t}</span>)}</div> : null}
                <div className="mt-12" style={{ borderTop: '1px solid var(--line-1)', paddingTop: 10 }}>
                  {fs.length ? <><div className="row row--between text-xs mb-8"><span className="muted">{plural(open, 'open finding')}</span></div><SeverityStack counts={severityCounts(fs)} /></> : <span className="text-xs muted"><Icon name="shield-check" size={12} /> No findings</span>}
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Empty icon="layers" title="No assets found" />}
    </div>
  );
}
