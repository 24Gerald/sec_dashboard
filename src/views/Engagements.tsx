import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Empty, SeverityStack, Stat, Segmented, Tabs } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SearchInput, Select } from '@/components/Filters';
import { FindingListItem } from '@/components/FindingRow';
import { Markdown } from '@/components/Markdown';
import type { EngagementType } from '@/types';
import { ENGAGEMENT_TYPES } from '@/types';
import { ENGAGEMENT_TYPE_LABEL, ENGAGEMENT_STATUS_LABEL, ENGAGEMENT_STATUS_TONE, tense } from '@/lib/severity';
import { engagementStats, severityCounts } from '@/lib/metrics';
import { fmtDate, humanKey, fmtNum, plural } from '@/lib/format';

const TYPE_ICON: Record<string, string> = {
  'vulnerability-assessment': 'shield', 'smart-contract-audit': 'contract', 'penetration-test': 'crosshair', 'load-test': 'gauge',
  'bug-hunt': 'bug', 'network-traffic-analysis': 'network', 'code-review': 'code', 'red-team': 'fire', 'soc-monitoring': 'radar',
  'incident-response': 'alert', 'security-architecture': 'layers', 'compliance-review': 'book', 'threat-model': 'route', training: 'users', other: 'file',
};

export function Engagements() {
  const { data, index } = useStore();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [type, setType] = useState<EngagementType | ''>((params.get('type') as EngagementType) || '');
  const [when, setWhen] = useState<'all' | 'past' | 'present' | 'future'>('all');

  const list = useMemo(() => {
    let l = data.engagements;
    if (type) l = l.filter((e) => e.type === type);
    if (when !== 'all') l = l.filter((e) => tense(e.status) === when);
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter((e) => (e.title + e.summary + (e.target ?? '') + (e.tags ?? []).join(' ')).toLowerCase().includes(s)); }
    return l;
  }, [data.engagements, type, when, q]);

  const done = data.engagements.filter((e) => e.status === 'completed').length;
  const active = data.engagements.filter((e) => tense(e.status) === 'present').length;
  const planned = data.engagements.filter((e) => tense(e.status) === 'future').length;
  const typeCounts = ENGAGEMENT_TYPES.map((t) => ({ type: t, n: data.engagements.filter((e) => e.type === t).length })).filter((x) => x.n > 0);

  return (
    <div className="page">
      <PageHeader eyebrow="Security work" title="Engagements" sub="Every assessment, audit, test and hunt the team has run — past, present and planned." />

      <div className="grid grid--4 mb-16">
        <Stat label="Total engagements" value={data.engagements.length} icon="target" />
        <Stat label="Completed" value={done} tone="good" icon="check" />
        <Stat label="In progress" value={active} tone="accent" icon="activity" />
        <Stat label="Planned" value={planned} icon="calendar" />
      </div>

      <div className="toolbar">
        <Segmented value={when} onChange={setWhen} options={[{ value: 'all', label: 'All' }, { value: 'present', label: 'Active' }, { value: 'past', label: 'Past' }, { value: 'future', label: 'Planned' }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search engagements…" />
        <Select value={type} onChange={setType} options={typeCounts.map((t) => ({ value: t.type, label: `${ENGAGEMENT_TYPE_LABEL[t.type]} (${t.n})` }))} all="All types" />
        <div className="toolbar__spacer" />
        <span className="toolbar__count">{plural(list.length, 'engagement')}</span>
      </div>

      {list.length ? (
        <div className="grid grid--auto">
          {list.map((e) => {
            const st = engagementStats(e, data.findings, data.tasks);
            const fs = index.findingsByEngagement.get(e.id) ?? [];
            return (
              <Link key={e.id} to={`/engagements/${e.id}`} className="card card--link card--pad">
                <div className="row row--between mb-8">
                  <span className="list__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}><Icon name={TYPE_ICON[e.type] ?? 'target'} size={16} /></span>
                  <Badge tone={ENGAGEMENT_STATUS_TONE[e.status]} size="sm" dot>{ENGAGEMENT_STATUS_LABEL[e.status]}</Badge>
                </div>
                <div className="list__title" style={{ fontSize: 15 }}>{e.title}</div>
                <div className="text-xs muted mb-8">{ENGAGEMENT_TYPE_LABEL[e.type]}{e.target && ` · ${e.target}`}</div>
                <p className="text-sm dim" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.summary}</p>
                <div className="mt-8">{fs.length ? <SeverityStack counts={severityCounts(fs)} /> : <span className="text-xs muted">No findings logged</span>}</div>
                <div className="row row--between text-xs muted mt-12" style={{ borderTop: '1px solid var(--line-1)', paddingTop: 8 }}>
                  <span><Icon name="calendar" size={11} /> {fmtDate(e.startDate, { month: 'short', year: '2-digit' })}</span>
                  {st.hours > 0 && <span><Icon name="clock" size={11} /> {fmtNum(st.hours)}h</span>}
                  <span>{plural(st.total, 'finding')}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : <Empty icon="target" title="No engagements found" />}
    </div>
  );
}

export function EngagementDetail() {
  const { id } = useParams();
  const { data, index } = useStore();
  const [tab, setTab] = useState<'overview' | 'findings' | 'scope' | 'deliverables'>('overview');
  const e = id ? index.engagementById.get(id) : undefined;
  if (!e) return <div className="page"><Empty title="Engagement not found"><Link to="/engagements">Back</Link></Empty></div>;
  const fs = index.findingsByEngagement.get(e.id) ?? [];
  const st = engagementStats(e, data.findings, data.tasks);
  const report = e.reportId ? index.reportById.get(e.reportId) : undefined;

  return (
    <div className="page">
      <div className="row gap-8 mb-12 text-sm muted">
        <Link to="/engagements" className="row gap-4"><Icon name="chevron-left" size={14} />Engagements</Link><span>/</span><span className="mono">{e.id}</span>
      </div>
      <PageHeader eyebrow={ENGAGEMENT_TYPE_LABEL[e.type]} title={e.title}
        sub={<span className="row gap-8 row--wrap"><Badge tone={ENGAGEMENT_STATUS_TONE[e.status]} dot>{ENGAGEMENT_STATUS_LABEL[e.status]}</Badge>{e.target && <span className="mono text-sm">{e.target}</span>}{e.lead && <span className="text-sm">Lead: {index.memberById.get(e.lead)?.name ?? e.lead}</span>}</span>}
        actions={report ? <Link to={`/reports/${report.id}`} className="btn"><Icon name="file" size={15} />View report</Link> : undefined}
      />

      <div className="grid grid--4 mb-16">
        <Stat label="Findings" value={st.total} tone={st.bySeverity.critical ? 'critical' : undefined} icon="bug" hint={`${st.open} open`} />
        <Stat label="Duration" value={e.endDate ? `${Math.max(1, Math.round((+new Date(e.endDate) - +new Date(e.startDate)) / 86400000))}` : '—'} icon="calendar" hint={<><small>days</small> · {fmtDate(e.startDate, { month: 'short', day: 'numeric' })}{e.endDate && ` – ${fmtDate(e.endDate, { month: 'short', day: 'numeric' })}`}</>} />
        <Stat label="Effort" value={st.hours ? fmtNum(st.hours) : '—'} icon="clock" hint={st.hours ? 'hours' : 'not tracked'} />
        <Stat label="Tasks" value={`${st.tasksDone}/${st.tasks}`} icon="check" hint="done" />
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview', icon: 'file' },
        { id: 'findings', label: 'Findings', icon: 'bug', count: fs.length },
        { id: 'scope', label: 'Scope & method', icon: 'route' },
        { id: 'deliverables', label: 'Deliverables', icon: 'download', count: e.deliverables?.length },
      ]} />

      {tab === 'overview' && (
        <div className="grid grid--detail">
          <div className="col gap-16">
            <Card title="Summary"><Markdown>{e.summary}</Markdown></Card>
            {e.highlights?.length ? <Card title="Highlights"><ul className="md">{e.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul></Card> : null}
            {fs.length ? <Card title="Findings by severity"><SeverityStack counts={severityCounts(fs)} showZero /></Card> : null}
          </div>
          <div className="col gap-16">
            <Card title="Details">
              <dl className="detail-key">
                <dt>Type</dt><dd>{ENGAGEMENT_TYPE_LABEL[e.type]}</dd>
                <dt>Status</dt><dd><Badge tone={ENGAGEMENT_STATUS_TONE[e.status]} size="sm">{ENGAGEMENT_STATUS_LABEL[e.status]}</Badge></dd>
                {e.client && <><dt>Client</dt><dd>{e.client}</dd></>}
                {e.lead && <><dt>Lead</dt><dd>{index.memberById.get(e.lead)?.name ?? e.lead}</dd></>}
                {e.team?.length ? <><dt>Team</dt><dd>{e.team.map((t) => index.memberById.get(t)?.name ?? t).join(', ')}</dd></> : null}
              </dl>
            </Card>
            {e.metrics && Object.keys(e.metrics).length ? (
              <Card title="Coverage metrics">
                <div className="grid grid--2 gap-8">
                  {Object.entries(e.metrics).map(([k, v]) => <div key={k} className="stat" style={{ padding: '10px 12px' }}><div className="stat__label">{humanKey(k)}</div><div className="stat__value num" style={{ fontSize: 22 }}>{typeof v === 'number' ? fmtNum(v) : v}</div></div>)}
                </div>
              </Card>
            ) : null}
            {e.tools?.length ? <Card title="Tools used"><div className="chips">{e.tools.map((t) => <span key={t} className="chip">{t}</span>)}</div></Card> : null}
          </div>
        </div>
      )}

      {tab === 'findings' && (fs.length ? <Card pad><div className="list">{fs.map((f) => <FindingListItem key={f.id} f={f} />)}</div></Card> : <Empty icon="bug" title="No findings logged for this engagement" />)}

      {tab === 'scope' && (
        <div className="grid grid--2">
          {e.scope?.length ? <Card title="Scope"><ul className="md">{e.scope.map((s, i) => <li key={i} className="mono text-sm">{s}</li>)}</ul></Card> : null}
          {e.objectives?.length ? <Card title="Objectives"><ul className="md">{e.objectives.map((s, i) => <li key={i}>{s}</li>)}</ul></Card> : null}
          {e.methodology?.length ? <Card title="Methodology"><ol className="md">{e.methodology.map((s, i) => <li key={i}>{s}</li>)}</ol></Card> : null}
          {!e.scope?.length && !e.objectives?.length && !e.methodology?.length && <Empty title="No scope recorded" />}
        </div>
      )}

      {tab === 'deliverables' && (
        e.deliverables?.length ? (
          <div className="grid grid--auto">
            {e.deliverables.map((d, i) => (
              <a key={i} href={d.url ?? '#'} target={d.url ? '_blank' : undefined} rel="noreferrer" className="card card--link card--pad row gap-12">
                <span className="list__icon"><Icon name={d.type === 'report' ? 'file' : d.type === 'slides' ? 'presentation' : d.type === 'repo' ? 'code' : 'download'} size={16} /></span>
                <div><div className="list__title">{d.title}</div><div className="text-xs muted">{d.type}</div></div>
              </a>
            ))}
          </div>
        ) : <Empty icon="download" title="No deliverables listed" />
      )}
    </div>
  );
}
