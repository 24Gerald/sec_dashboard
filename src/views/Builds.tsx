import { useMemo, useState } from 'react';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Empty, Stat, Segmented } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SearchInput } from '@/components/Filters';
import { Markdown } from '@/components/Markdown';
import type { Build } from '@/types';
import { fmtDate, humanKey, plural } from '@/lib/format';

const KIND_ICON: Record<string, string> = { tool: 'wrench', bot: 'robot', pipeline: 'route', policy: 'book', integration: 'layers', hardening: 'shield-check', documentation: 'file', other: 'grid' };
const STATUS_TONE: Record<string, string> = { idea: 'neutral', planned: 'neutral', building: 'warn', shipped: 'good', maintained: 'accent', retired: 'neutral' };

export function Builds() {
  const { data, index } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'shipped' | 'building'>('all');

  const list = useMemo(() => {
    let l = data.builds;
    if (status === 'shipped') l = l.filter((b) => b.status === 'shipped' || b.status === 'maintained');
    if (status === 'building') l = l.filter((b) => b.status === 'building' || b.status === 'planned');
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter((b) => (b.title + b.description + (b.tags ?? []).join(' ')).toLowerCase().includes(s)); }
    return l;
  }, [data.builds, status, q]);

  const shipped = data.builds.filter((b) => b.status === 'shipped' || b.status === 'maintained').length;
  const building = data.builds.filter((b) => b.status === 'building').length;

  return (
    <div className="page">
      <PageHeader eyebrow="What we've built" title="Builds & tooling" sub="The security tooling, bots, pipelines and hardening work the team has produced." />

      <div className="grid grid--4 mb-16">
        <Stat label="Total builds" value={data.builds.length} icon="wrench" />
        <Stat label="Shipped" value={shipped} tone="good" icon="check" />
        <Stat label="In progress" value={building} tone="accent" icon="activity" />
        <Stat label="Kinds" value={new Set(data.builds.map((b) => b.kind)).size} icon="grid" />
      </div>

      <div className="toolbar">
        <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'shipped', label: 'Shipped' }, { value: 'building', label: 'In progress' }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search builds…" />
        <div className="toolbar__spacer" /><span className="toolbar__count">{plural(list.length, 'build')}</span>
      </div>

      {list.length ? (
        <div className="grid grid--auto">
          {list.map((b: Build) => (
            <Card key={b.id} className="card--pad">
              <div className="row row--between mb-8">
                <span className="list__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}><Icon name={KIND_ICON[b.kind] ?? 'wrench'} size={16} /></span>
                <Badge tone={STATUS_TONE[b.status]} size="sm" dot>{b.status}</Badge>
              </div>
              <div className="list__title">{b.title}</div>
              <div className="text-xs muted mb-8">{humanKey(b.kind)}{b.owner && ` · ${index.memberById.get(b.owner)?.name ?? b.owner}`}</div>
              <div className="text-sm dim"><Markdown sm>{b.description}</Markdown></div>
              {b.impact && <div className="sim__defend text-sm mt-8"><b><Icon name="zap" size={12} /> Impact:</b> {b.impact}</div>}
              {b.tags?.length ? <div className="chips mt-8">{b.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div> : null}
              <div className="row row--between text-xs muted mt-12" style={{ borderTop: '1px solid var(--line-1)', paddingTop: 8 }}>
                <span>{b.shipped ? `Shipped ${fmtDate(b.shipped, { month: 'short', year: '2-digit' })}` : b.started ? `Started ${fmtDate(b.started, { month: 'short', year: '2-digit' })}` : ''}</span>
                <span className="row gap-8">
                  {b.repo && <a href={b.repo} target="_blank" rel="noreferrer" className="row gap-4"><Icon name="code" size={12} />Repo</a>}
                  {b.links?.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer" className="row gap-4"><Icon name="external" size={12} />{l.title}</a>)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : <Empty icon="wrench" title="No builds recorded" />}
    </div>
  );
}
