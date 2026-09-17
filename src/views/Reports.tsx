import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Empty, Stat } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SearchInput } from '@/components/Filters';
import { Markdown } from '@/components/Markdown';
import { fmtDate, plural } from '@/lib/format';

const TYPE_ICON: Record<string, string> = { assessment: 'shield', audit: 'contract', pentest: 'crosshair', 'load-test': 'gauge', summary: 'file', incident: 'alert', executive: 'presentation', other: 'file' };

export function Reports() {
  const { data, index } = useStore();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    let l = data.reports;
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter((r) => (r.title + (r.summary ?? '') + (r.tags ?? []).join(' ')).toLowerCase().includes(s)); }
    return l;
  }, [data.reports, q]);

  return (
    <div className="page">
      <PageHeader eyebrow="Deliverables" title="Reports" sub="Written reports, audits and executive summaries the team has produced." />
      <div className="grid grid--4 mb-16">
        <Stat label="Reports" value={data.reports.length} icon="file" />
        <Stat label="Audits" value={data.reports.filter((r) => r.type === 'audit').length} icon="contract" />
        <Stat label="Pentests" value={data.reports.filter((r) => r.type === 'pentest').length} icon="crosshair" />
        <Stat label="Executive" value={data.reports.filter((r) => r.type === 'executive' || r.type === 'summary').length} icon="presentation" />
      </div>
      <div className="toolbar"><SearchInput value={q} onChange={setQ} placeholder="Search reports…" /><div className="toolbar__spacer" /><span className="toolbar__count">{plural(list.length, 'report')}</span></div>
      {list.length ? (
        <div className="grid grid--auto">
          {list.map((r) => {
            const eng = r.engagement ? index.engagementById.get(r.engagement) : undefined;
            return (
              <Link key={r.id} to={`/reports/${r.id}`} className="card card--link card--pad">
                <div className="row row--between mb-8"><span className="list__icon"><Icon name={TYPE_ICON[r.type] ?? 'file'} size={16} /></span><Badge tone="neutral" size="sm">{r.type}</Badge></div>
                <div className="list__title">{r.title}</div>
                <div className="text-xs muted mb-8">{fmtDate(r.date)}{r.author && ` · ${index.memberById.get(r.author)?.name ?? r.author}`}</div>
                {r.summary && <p className="text-sm dim" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.summary}</p>}
                {eng && <div className="chip mt-8"><Icon name="target" size={12} />{eng.title}</div>}
              </Link>
            );
          })}
        </div>
      ) : <Empty icon="file" title="No reports yet" >Add markdown reports under <span className="mono">content/reports/</span>.</Empty>}
    </div>
  );
}

export function ReportDetail() {
  const { id } = useParams();
  const { data, index } = useStore();
  const r = id ? index.reportById.get(id) : undefined;
  if (!r) return <div className="page"><Empty title="Report not found"><Link to="/reports">Back</Link></Empty></div>;
  const body = data.markdown[`reports/${r.path}`] ?? data.markdown[r.path];
  const eng = r.engagement ? index.engagementById.get(r.engagement) : undefined;

  return (
    <div className="page">
      <div className="row gap-8 mb-12 text-sm muted"><Link to="/reports" className="row gap-4"><Icon name="chevron-left" size={14} />Reports</Link><span>/</span><span className="mono">{r.id}</span></div>
      <PageHeader eyebrow={r.type} title={r.title} sub={<span className="row gap-8">{fmtDate(r.date)}{r.author && <span>· {index.memberById.get(r.author)?.name ?? r.author}</span>}{eng && <Link to={`/engagements/${eng.id}`} className="chip"><Icon name="target" size={12} />{eng.title}</Link>}</span>}
        actions={<a className="btn" onClick={() => window.print()}><Icon name="download" size={15} />Print / PDF</a>} />
      <Card className="card--pad">
        {body ? <Markdown wide>{body}</Markdown> : (
          <div>{r.summary ? <Markdown>{r.summary}</Markdown> : <Empty title="Report body not found" >Expected markdown at <span className="mono">content/reports/{r.path}</span>.</Empty>}</div>
        )}
      </Card>
    </div>
  );
}
