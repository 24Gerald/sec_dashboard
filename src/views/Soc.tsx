import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Button, Empty, Stat, SeverityBadge, Segmented } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SearchInput, Select } from '@/components/Filters';
import { LineChart, seriesColor } from '@/components/charts';
import { Markdown } from '@/components/Markdown';
import type { SocEvent, Severity } from '@/types';
import { SEVERITIES } from '@/types';
import { fmtDateTime, fmtTime, relTime, plural } from '@/lib/format';
import { SEVERITY_LABEL } from '@/lib/severity';

const CAT_ICON: Record<string, string> = { intrusion: 'crosshair', malware: 'fire', anomaly: 'activity', auth: 'lock', 'config-drift': 'layers', 'vuln-scan': 'bug', availability: 'gauge', 'data-exfil': 'external', policy: 'book', 'on-chain': 'coins', info: 'bell' };
const SOC_STATUS_TONE: Record<string, string> = { new: 'crit', acknowledged: 'warn', investigating: 'accent', resolved: 'good', 'false-positive': 'neutral' };

export function SocMonitor() {
  const { data, save, toast, online } = useStore();
  const [q, setQ] = useState('');
  const [sev, setSev] = useState<Severity | ''>('');
  const [view, setView] = useState<'all' | 'active'>('active');
  const soc = data.org.soc;

  const events = useMemo(() => {
    let l = data.socEvents;
    if (view === 'active') l = l.filter((e) => e.status === 'new' || e.status === 'acknowledged' || e.status === 'investigating');
    if (sev) l = l.filter((e) => e.severity === sev);
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter((e) => (e.title + e.message + e.source + (e.rule ?? '')).toLowerCase().includes(s)); }
    return l;
  }, [data.socEvents, view, sev, q]);

  const newCount = data.socEvents.filter((e) => e.status === 'new').length;
  const open = data.socEvents.filter((e) => e.status !== 'resolved' && e.status !== 'false-positive').length;
  const last24 = data.socEvents.filter((e) => Date.now() - +new Date(e.timestamp) < 86400000).length;

  // events per day, last 14 days
  const trend = useMemo(() => {
    const days: { label: string; Events: number; Critical: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const evs = data.socEvents.filter((e) => e.timestamp.slice(0, 10) === key);
      days.push({ label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), Events: evs.length, Critical: evs.filter((e) => e.severity === 'critical' || e.severity === 'high').length });
    }
    return days;
  }, [data.socEvents]);

  const ack = async (e: SocEvent, status: SocEvent['status']) => { await save('socEvent', { ...e, status }); toast(`Event ${status}`, 'good'); };

  return (
    <div className="page">
      <PageHeader eyebrow="Always-on monitoring" title={<span className="row gap-12">SOC monitor {soc?.status === 'live' && <Badge tone="good" dot>Live</Badge>}</span>}
        sub={`Continuous security events${soc?.botName ? ` from ${soc.botName}` : ''}. Future issues land here automatically and can be promoted to findings.`} />

      {soc?.description && (
        <Card className="mb-16" accent title={<span className="row gap-8"><Icon name="robot" size={16} />{soc.botName ?? 'SOC Bot'}</span>}
          sub={soc.status ? `Status: ${soc.status}` : undefined}>
          <div className="row row--between row--wrap gap-16">
            <div className="flex-1"><Markdown sm>{soc.description}</Markdown></div>
            <div className="col gap-4 text-xs muted">
              <span className="row gap-4"><Icon name="route" size={13} /> POST events to <span className="mono">/api/ingest</span></span>
              <span className="row gap-4"><Icon name="key" size={13} /> Auth: <span className="mono">X-Ingest-Token</span></span>
              <span className="row gap-4"><Icon name="code" size={13} /> Demo: <span className="mono">npm run soc:demo</span></span>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid--4 mb-16">
        <Stat label="New / unhandled" value={newCount} tone={newCount ? 'critical' : undefined} icon="bell" />
        <Stat label="Open" value={open} tone={open ? 'high' : undefined} icon="radar" />
        <Stat label="Last 24 hours" value={last24} icon="clock" />
        <Stat label="Total logged" value={data.socEvents.length} icon="layers" />
      </div>

      {data.socEvents.length > 0 && (
        <Card title="Event volume" sub="Last 14 days" className="mb-16">
          <LineChart data={trend} series={[{ key: 'Events', label: 'All events', color: seriesColor(0) }, { key: 'Critical', label: 'Critical/High', color: seriesColor(7) }]} height={180} area />
        </Card>
      )}

      <div className="toolbar">
        <Segmented value={view} onChange={setView} options={[{ value: 'active', label: 'Active' }, { value: 'all', label: `All ${data.socEvents.length}` }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search events…" />
        <Select value={sev} onChange={setSev} options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))} all="Any severity" />
        <div className="toolbar__spacer" />
        <span className="toolbar__count">{plural(events.length, 'event')}</span>
      </div>

      {events.length ? (
        <Card pad={false}>
          {events.map((e) => (
            <div key={e.id} className={`list__item${e.status === 'new' ? ' feed__item--new' : ''}`} style={{ padding: '12px 16px', alignItems: 'center' }}>
              <span className="list__icon" style={{ background: `var(--sev-${e.severity}-soft)`, color: `var(--sev-${e.severity})` }}><Icon name={CAT_ICON[e.category] ?? 'bell'} size={15} /></span>
              <div className="list__body">
                <div className="row gap-8 row--wrap"><b className="text-sm">{e.title}</b><SeverityBadge severity={e.severity} size="sm" /><Badge tone={SOC_STATUS_TONE[e.status]} size="sm">{e.status}</Badge>{e.linkedFinding && <Link to={`/findings/${e.linkedFinding}`} className="chip chip--mono">{e.linkedFinding}</Link>}</div>
                <div className="text-sm dim mt-4">{e.message}</div>
                <div className="list__meta"><span className="mono">{e.source}</span>{e.rule && <span className="chip">{e.rule}</span>}{e.asset && <span>{e.asset}</span>}<span title={fmtDateTime(e.timestamp)}>{relTime(e.timestamp)}</span></div>
              </div>
              <div className="col gap-4" style={{ flex: '0 0 auto' }}>
                <span className="text-xs muted num">{fmtTime(e.timestamp)}</span>
                {(e.status === 'new' || e.status === 'acknowledged') && (
                  <div className="btn-group">
                    {e.status === 'new' && <Button size="sm" onClick={() => ack(e, 'acknowledged')} title="Acknowledge"><Icon name="check" size={13} /></Button>}
                    <Button size="sm" onClick={() => ack(e, 'investigating')} title="Investigate"><Icon name="search" size={13} /></Button>
                    <Button size="sm" onClick={() => ack(e, 'resolved')} title="Resolve"><Icon name="shield-check" size={13} /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </Card>
      ) : <Empty icon="radar" title="No events" >{view === 'active' ? 'Nothing needs attention right now.' : 'The SOC bot has not logged anything yet.'}</Empty>}

      {!online && <div className="text-xs muted mt-12 row gap-8"><Icon name="alert" size={13} />Acknowledgements are stored locally until the authoring server is running. The SOC bot ingest endpoint (<span className="mono">/api/ingest</span>) also needs the server.</div>}
    </div>
  );
}
