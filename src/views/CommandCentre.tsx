import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Stat, Card, Badge, Button, SeverityStack, Empty } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { LineChart, Donut, Gauge, seriesColor } from '@/components/charts';
import { FindingListItem } from '@/components/FindingRow';
import { Markdown } from '@/components/Markdown';
import { FindingForm } from './FindingForm';
import {
  isOpen, riskIndex, riskLabel, severityCounts, findingsByMonth, mttrDays, remediationRate,
  activityFeed, topRisks, totalHours, coverage,
} from '@/lib/metrics';
import { SEVERITY_LABEL, ENGAGEMENT_TYPE_LABEL } from '@/lib/severity';
import { fmtNum, relTime, plural } from '@/lib/format';

export function CommandCentre() {
  const { data } = useStore();
  const [showForm, setShowForm] = useState(false);
  const f = data.findings;
  const open = f.filter(isOpen);
  const risk = riskIndex(f);
  const rl = riskLabel(risk);
  const counts = severityCounts(open);
  const months = findingsByMonth(f, 12);
  const mttr = mttrDays(f);
  const rem = remediationRate(f);
  const feed = activityFeed(data, 12);
  const risks = topRisks(f, 5);
  const cov = coverage(data);
  const activeEng = data.engagements.filter((e) => e.status === 'in-progress' || e.status === 'ongoing');
  const criticalOpen = open.filter((x) => x.severity === 'critical').length;
  const hours = totalHours(data);

  return (
    <div className="page">
      {data.org.sampleData && (
        <div className="banner mb-16" style={{ borderRadius: 'var(--radius-m)', border: '1px solid var(--line-1)' }}>
          <Icon name="alert" size={16} />
          <span><strong>Sample data.</strong> This dashboard is seeded with example ARK STUDIOS content. Replace it under <span className="mono">content/</span> or log real work — set <span className="mono">sampleData:false</span> in <span className="mono">content/org.json</span> to hide this.</span>
        </div>
      )}
      <PageHeader
        eyebrow={`${data.org.name} · Security Operations`}
        title="Command centre"
        sub="Live posture across every engagement, finding and build — past, present and planned."
        actions={<>
          <Link to="/present" className="btn"><Icon name="presentation" size={15} />Present</Link>
          <Button variant="primary" icon="plus" onClick={() => setShowForm(true)}>Log finding</Button>
        </>}
      />

      <div className="grid grid--4 mb-16">
        <Stat label="Live risk index" value={risk} tone={risk >= 50 ? 'critical' : undefined} bar={`var(--${rl.tone})`}
          hint={<Badge tone={rl.tone} size="sm">{rl.label}</Badge>} icon="gauge" />
        <Stat label="Open findings" value={open.length} tone={criticalOpen ? 'critical' : undefined} icon="bug"
          hint={<span>{criticalOpen ? <b style={{ color: 'var(--sev-critical)' }}>{plural(criticalOpen, 'critical')}</b> : 'none critical'} · {f.length} total</span>} />
        <Stat label="Remediation rate" value={`${rem.total ? Math.round((rem.done / rem.total) * 100) : 0}%`} tone="good" icon="shield-check"
          hint={`${rem.done} of ${rem.total} resolved`} />
        <Stat label="Effort logged" value={fmtNum(hours)} icon="clock" hint={<><small>hrs</small> across {plural(data.engagements.length, 'engagement')}</>} />
      </div>

      <div className="grid grid--main mb-16">
        <Card title="Findings discovered vs resolved" sub="Rolling 12 months" accent>
          <LineChart
            data={months.map((m) => ({ label: m.label, Discovered: m.discovered, Resolved: m.resolved, Open: m.open }))}
            series={[
              { key: 'Discovered', label: 'Discovered', color: seriesColor(0) },
              { key: 'Resolved', label: 'Resolved', color: seriesColor(2) },
              { key: 'Open', label: 'Open (running)', color: seriesColor(1) },
            ]}
            height={230}
          />
        </Card>
        <Card title="Live risk" sub={rl.label}>
          <div className="col gap-16" style={{ alignItems: 'center' }}>
            <Gauge value={risk} label="0 = contained · 100 = critical exposure" size={180} />
            <div className="w-100">
              <div className="row row--between text-sm mb-8"><span className="muted">Open by severity</span><span className="num">{open.length}</span></div>
              <SeverityStack counts={counts} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid--3 mb-16">
        <Card title="Top open risks" actions={<Link to="/findings" className="btn btn--ghost btn--sm">All<Icon name="chevron-right" size={14} /></Link>} className="span-2">
          {risks.length ? <div className="list">{risks.map((x) => <FindingListItem key={x.id} f={x} />)}</div> : <Empty icon="shield-check" title="No open risks" >Everything is remediated or accepted.</Empty>}
        </Card>
        <Card title="Mean time to remediate">
          <div className="col gap-16">
            <div className="center">
              <div className="stat__value num" style={{ fontSize: 40 }}>{mttr ?? '—'}<small style={{ fontSize: 16 }}> days</small></div>
              <div className="text-xs muted">average, resolved findings</div>
            </div>
            <div>
              <div className="section-title" style={{ marginTop: 0 }}>Severity mix (open)</div>
              <Donut size={130} thickness={20}
                data={(['critical', 'high', 'medium', 'low', 'info'] as const).filter((s) => counts[s] > 0).map((s) => ({ label: SEVERITY_LABEL[s], value: counts[s], color: `var(--sev-${s})` }))}
                center={<div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{open.length}</div><div className="text-xs muted">open</div></div>}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid--main mb-16">
        <Card title="Recent activity" sub="Past & present work" actions={<Link to="/timeline" className="btn btn--ghost btn--sm">Timeline<Icon name="chevron-right" size={14} /></Link>}>
          {feed.length ? (
            <div className="feed">
              {feed.map((it) => (
                <Link key={it.id} to={it.href ?? '#'} className="feed__item" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="feed__time">{relTime(it.date)}</span>
                  <span className="feed__sev" style={{ background: it.severity ? `var(--sev-${it.severity})` : 'var(--ink-4)', marginTop: 6 }} />
                  <span>
                    <span className="feed__title row gap-8"><FeedIcon kind={it.kind} />{it.title}</span>
                    <span className="feed__meta">{it.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : <Empty title="No activity yet" />}
        </Card>
        <div className="col gap-16">
          <Card title="Active engagements" actions={<Link to="/engagements" className="btn btn--ghost btn--sm">All</Link>}>
            {activeEng.length ? activeEng.slice(0, 4).map((e) => (
              <Link key={e.id} to={`/engagements/${e.id}`} className="list__item list__item--link">
                <span className="list__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}><Icon name="target" size={15} /></span>
                <div className="list__body"><div className="list__title">{e.title}</div><div className="list__meta"><Badge tone="warn" size="sm">{ENGAGEMENT_TYPE_LABEL[e.type]}</Badge></div></div>
              </Link>
            )) : <Empty icon="target" title="No active engagements" />}
          </Card>
          <Card title="Coverage" sub={`${cov.length} activity types`}>
            <div className="chips">
              {cov.map((c, i) => <Link key={c.type} to={`/engagements?type=${c.type}`} className="chip" style={{ borderColor: 'var(--line-2)' }}><span className="badge__dot" style={{ background: seriesColor(i), width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />{ENGAGEMENT_TYPE_LABEL[c.type]} <b className="num">{c.count}</b></Link>)}
            </div>
          </Card>
        </div>
      </div>

      {data.org.soc?.description && (
        <Card title={<span className="row gap-8"><Icon name="robot" size={16} />{data.org.soc.botName ?? 'SOC Bot'}</span>} sub="Always-on monitoring" accent>
          <div className="row row--between row--wrap gap-16">
            <div className="flex-1"><Markdown sm>{data.org.soc.description}</Markdown></div>
            <Link to="/soc" className="btn">Open SOC monitor<Icon name="arrow-right" size={15} /></Link>
          </div>
        </Card>
      )}

      {showForm && <FindingForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function FeedIcon({ kind }: { kind: string }) {
  const map: Record<string, string> = { finding: 'bug', fix: 'shield-check', task: 'check', engagement: 'target', soc: 'radar', build: 'wrench', report: 'file' };
  return <Icon name={map[kind] ?? 'activity'} size={13} style={{ color: 'var(--ink-3)', flex: '0 0 auto' }} />;
}
