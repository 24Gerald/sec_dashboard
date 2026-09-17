import React from 'react';
import type { Dataset, SlideSpec } from '@/types';
import { Icon } from '@/components/Icon';
import { Badge } from '@/components/ui';
import { Logo } from '@/components/Layout';
import { LineChart, Donut, Gauge, BarChart, seriesColor } from '@/components/charts';
import { AttackSimulation } from '@/components/AttackSimulation';
import { Markdown } from '@/components/Markdown';
import {
  isOpen, severityCounts, riskIndex, riskLabel, remediationRate, mttrDays, findingsByMonth,
  coverage, totalHours, effortByMember,
} from '@/lib/metrics';
import { SEVERITY_LABEL, ENGAGEMENT_TYPE_LABEL, tense, ENGAGEMENT_STATUS_LABEL } from '@/lib/severity';
import { fmtNum, fmtDate, plural } from '@/lib/format';

export function Slide({ spec, data, active }: { spec: SlideSpec; data: Dataset; active: boolean }) {
  switch (spec.kind) {
    case 'title': return <TitleSlide spec={spec} data={data} />;
    case 'agenda': return <AgendaSlide data={data} />;
    case 'exec-summary': return <ExecSlide data={data} />;
    case 'kpis': return <KpiSlide data={data} />;
    case 'severity': return <SeveritySlide data={data} />;
    case 'engagements': return <EngagementsSlide data={data} />;
    case 'simulation': return <SimulationSlide spec={spec} data={data} active={active} />;
    case 'remediation': return <RemediationSlide data={data} />;
    case 'builds': return <BuildsSlide data={data} />;
    case 'soc': return <SocSlide data={data} />;
    case 'roadmap': return <RoadmapSlide data={data} />;
    case 'team': return <TeamSlide data={data} />;
    case 'closing': return <ClosingSlide data={data} />;
    case 'markdown': return <MarkdownSlide spec={spec} />;
    default: return <div className="slide"><h1 className="slide__title">{spec.title ?? spec.kind}</h1></div>;
  }
}

function Frame({ eyebrow, title, children, center }: { eyebrow?: string; title?: React.ReactNode; children: React.ReactNode; center?: boolean }) {
  return (
    <div className="slide">
      {(eyebrow || title) && <div>{eyebrow && <div className="slide__eyebrow">{eyebrow}</div>}{title && <h1 className="slide__title" style={{ fontSize: 'clamp(26px,3.4vw,44px)' }}>{title}</h1>}</div>}
      <div className={`slide__body${center ? ' slide__body--center' : ''}`}>{children}</div>
    </div>
  );
}

function TitleSlide({ spec, data }: { spec: SlideSpec; data: Dataset }) {
  const risk = riskIndex(data.findings);
  return (
    <div className="slide slide--title">
      <div className="row gap-16 mb-24"><Logo size={54} /><div><div className="brand__name" style={{ fontSize: 20, letterSpacing: '0.16em' }}>{data.org.name}</div><div className="brand__sub" style={{ fontSize: 14 }}>{data.org.unit ?? 'Security Team'}</div></div></div>
      <h1 className="slide__title">{spec.title ?? `${data.org.name} Security Review`}</h1>
      <div className="slide__sub mt-16">{data.org.presentation?.subtitle ?? `A review of our security work, findings and posture — ${fmtDate(new Date().toISOString())}.`}</div>
      <div className="row gap-24 mt-32">
        <BigStat value={data.engagements.length} label="Engagements" />
        <BigStat value={data.findings.length} label="Findings" />
        <BigStat value={`${risk}`} label="Risk index" />
        <BigStat value={fmtNum(totalHours(data))} label="Hours of work" />
      </div>
    </div>
  );
}

function BigStat({ value, label }: { value: React.ReactNode; label: string }) {
  return <div><div className="num" style={{ fontSize: 'clamp(30px,3.6vw,52px)', fontWeight: 800, color: 'var(--accent-strong)', lineHeight: 1 }}>{value}</div><div className="text-sm muted upper" style={{ marginTop: 6 }}>{label}</div></div>;
}

function AgendaSlide({ data }: { data: Dataset }) {
  const items = [
    'Where we stand — security posture at a glance',
    'What we found — findings by severity and risk',
    `What we've done — ${plural(data.engagements.length, 'engagement')} across the program`,
    'How attacks play out — walkthroughs of our top risks',
    'Remediation progress and roadmap',
  ];
  if (data.builds.length) items.push('What we built — security tooling & automation');
  return (
    <Frame eyebrow="Agenda" title="What we'll cover">
      <ul className="slide__list">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </Frame>
  );
}

function ExecSlide({ data }: { data: Dataset }) {
  const open = data.findings.filter(isOpen);
  const risk = riskIndex(data.findings);
  const rl = riskLabel(risk);
  const counts = severityCounts(open);
  const rem = remediationRate(data.findings);
  const remPct = rem.total ? Math.round((rem.done / rem.total) * 100) : 0;
  const cov = coverage(data);
  return (
    <Frame eyebrow="Executive summary" title="Where we stand">
      <div className="grid grid--2 gap-24" style={{ alignItems: 'center' }}>
        <div className="col gap-16">
          <div className="row gap-16" style={{ alignItems: 'center' }}>
            <Gauge value={risk} size={170} />
            <div>
              <Badge tone={rl.tone} size="lg">{rl.label}</Badge>
              <div className="slide__sub mt-8" style={{ fontSize: 'clamp(14px,1.4vw,18px)' }}>Live risk index across all open findings.</div>
            </div>
          </div>
        </div>
        <ul className="slide__list" style={{ fontSize: 'clamp(15px,1.5vw,21px)' }}>
          <li><span><b>{open.length}</b> open findings{counts.critical ? <> — <b style={{ color: 'var(--sev-critical)' }}>{plural(counts.critical, 'critical')}</b></> : ' — none critical'}</span></li>
          <li><span><b>{remPct}%</b> of findings remediated or accepted</span></li>
          <li><span><b>{plural(data.engagements.length, 'engagement')}</b> run across <b>{cov.length}</b> security disciplines</span></li>
          <li><span><b>{fmtNum(totalHours(data))}</b> hours of security work logged</span></li>
        </ul>
      </div>
    </Frame>
  );
}

function KpiSlide({ data }: { data: Dataset }) {
  const open = data.findings.filter(isOpen);
  const counts = severityCounts(open);
  const rem = remediationRate(data.findings);
  const mttr = mttrDays(data.findings);
  return (
    <Frame eyebrow="Key metrics" title="The numbers">
      <div className="grid grid--4">
        <SlideStat value={data.findings.length} label="Total findings" tone="var(--accent-strong)" />
        <SlideStat value={counts.critical + counts.high} label="Open crit / high" tone="var(--sev-high)" />
        <SlideStat value={`${rem.total ? Math.round((rem.done / rem.total) * 100) : 0}%`} label="Remediated" tone="var(--good)" />
        <SlideStat value={mttr ?? '—'} label="Avg days to fix" />
        <SlideStat value={data.engagements.length} label="Engagements" />
        <SlideStat value={data.assets.length} label="Assets covered" />
        <SlideStat value={data.builds.length} label="Tools built" />
        <SlideStat value={fmtNum(totalHours(data))} label="Hours logged" />
      </div>
    </Frame>
  );
}

function SlideStat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  return <div className="stat"><div className="stat__value num" style={{ color: tone }}>{value}</div><div className="stat__label">{label}</div></div>;
}

function SeveritySlide({ data }: { data: Dataset }) {
  const open = data.findings.filter(isOpen);
  const counts = severityCounts(open);
  const all = severityCounts(data.findings);
  const months = findingsByMonth(data.findings, 12);
  return (
    <Frame eyebrow="Findings" title="By severity">
      <div className="grid grid--2 gap-24" style={{ alignItems: 'center' }}>
        <Donut size={230} thickness={30}
          data={(['critical', 'high', 'medium', 'low', 'info'] as const).filter((s) => counts[s] > 0).map((s) => ({ label: SEVERITY_LABEL[s], value: counts[s], color: `var(--sev-${s})` }))}
          center={<div><div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{open.length}</div><div className="text-sm muted">open</div></div>} />
        <div>
          <div className="text-sm muted upper mb-8">Trend — discovered vs resolved</div>
          <LineChart data={months.map((m) => ({ label: m.label, Discovered: m.discovered, Resolved: m.resolved }))} series={[{ key: 'Discovered', label: 'Found', color: seriesColor(0) }, { key: 'Resolved', label: 'Fixed', color: seriesColor(2) }]} height={200} area />
          <div className="text-sm muted mt-8">{all.critical + all.high} of {data.findings.length} findings were critical or high severity.</div>
        </div>
      </div>
    </Frame>
  );
}

function EngagementsSlide({ data }: { data: Dataset }) {
  const cov = coverage(data);
  return (
    <Frame eyebrow="Coverage" title="What we've assessed">
      <BarChart data={cov.sort((a, b) => b.count - a.count).map((c) => ({ label: ENGAGEMENT_TYPE_LABEL[c.type], value: c.count, sub: 'Engagements' }))} />
      <div className="text-sm muted mt-16">Across {plural(cov.length, 'discipline')} — from smart-contract audits and penetration tests to load testing, bug hunts and network traffic analysis.</div>
    </Frame>
  );
}

function SimulationSlide({ spec, data, active }: { spec: SlideSpec; data: Dataset; active: boolean }) {
  const f = data.findings.find((x) => x.id === spec.ref);
  if (!f) return <Frame title="Attack walkthrough"><div className="empty">Finding not found</div></Frame>;
  const eng = f.engagement ? data.engagements.find((e) => e.id === f.engagement) : undefined;
  return (
    <div className="slide">
      <div className="row row--between row--wrap gap-8">
        <div><div className="slide__eyebrow" style={{ color: 'var(--attacker)' }}>Attack walkthrough · how it plays out</div><h1 className="slide__title" style={{ fontSize: 'clamp(22px,2.8vw,38px)' }}>{f.title}</h1></div>
        <Badge tone={f.severity} size="lg" dot>{SEVERITY_LABEL[f.severity]}</Badge>
      </div>
      <div className="slide__body" style={{ marginTop: 8 }}>
        <AttackSimulation key={f.id + String(active)} finding={f} engagementType={eng?.type} autoPlay={active} present hideHeader />
      </div>
    </div>
  );
}

function RemediationSlide({ data }: { data: Dataset }) {
  const rem = remediationRate(data.findings);
  const pct = rem.total ? Math.round((rem.done / rem.total) * 100) : 0;
  const byStatus = ['verified', 'fixed', 'in-remediation', 'triaged', 'open', 'risk-accepted'] as const;
  const counts = byStatus.map((s) => ({ label: s.replace('-', ' '), value: data.findings.filter((f) => f.status === s).length })).filter((x) => x.value > 0);
  return (
    <Frame eyebrow="Remediation" title="Progress on fixes">
      <div className="grid grid--2 gap-24" style={{ alignItems: 'center' }}>
        <div className="center">
          <div className="num" style={{ fontSize: 'clamp(48px,7vw,96px)', fontWeight: 800, color: 'var(--good)', lineHeight: 1 }}>{pct}%</div>
          <div className="slide__sub">of {plural(rem.total, 'finding')} remediated or formally accepted</div>
        </div>
        <BarChart data={counts.map((c) => ({ label: c.label, value: c.value, color: c.label.includes('fix') || c.label.includes('verif') ? 'var(--good)' : c.label.includes('open') ? 'var(--sev-critical)' : 'var(--sev-high)' }))} />
      </div>
    </Frame>
  );
}

function BuildsSlide({ data }: { data: Dataset }) {
  const shipped = data.builds.filter((b) => b.status === 'shipped' || b.status === 'maintained');
  return (
    <Frame eyebrow="Engineering" title="What we built">
      <div className="grid grid--2 gap-16">
        {(shipped.length ? shipped : data.builds).slice(0, 6).map((b) => (
          <div key={b.id} className="card card--pad">
            <div className="row gap-8 mb-8"><Icon name="wrench" size={18} style={{ color: 'var(--accent-strong)' }} /><b style={{ fontSize: 'clamp(15px,1.4vw,20px)' }}>{b.title}</b><Badge tone={b.status === 'shipped' || b.status === 'maintained' ? 'good' : 'warn'} size="sm">{b.status}</Badge></div>
            <div className="text-sm dim">{b.impact ?? b.description}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function SocSlide({ data }: { data: Dataset }) {
  const soc = data.org.soc;
  const open = data.socEvents.filter((e) => e.status !== 'resolved' && e.status !== 'false-positive').length;
  return (
    <Frame eyebrow="Always-on monitoring" title={soc?.botName ?? 'SOC monitoring'}>
      <div className="grid grid--2 gap-24" style={{ alignItems: 'center' }}>
        <div className="col gap-16">
          <Icon name="robot" size={64} style={{ color: 'var(--accent-strong)' }} />
          <div className="slide__sub">{soc?.description ?? 'A continuously-running bot watches our systems and logs security events the moment they happen — so future issues are caught, triaged and turned into findings automatically.'}</div>
        </div>
        <div className="grid grid--2 gap-16">
          <SlideStat value={data.socEvents.length} label="Events logged" tone="var(--accent-strong)" />
          <SlideStat value={open} label="Open" tone="var(--sev-high)" />
          <SlideStat value={data.socEvents.filter((e) => e.linkedFinding).length} label="Promoted to findings" />
          <SlideStat value={soc?.status ?? 'live'} label="Status" tone="var(--good)" />
        </div>
      </div>
    </Frame>
  );
}

function RoadmapSlide({ data }: { data: Dataset }) {
  const future = data.engagements.filter((e) => tense(e.status) !== 'past').sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 6);
  return (
    <Frame eyebrow="What's next" title="Roadmap">
      {future.length ? (
        <ul className="slide__list">
          {future.map((e) => <li key={e.id}><span className="row gap-12 row--wrap" style={{ alignItems: 'baseline' }}><b>{e.title}</b><Badge tone="accent" size="sm">{ENGAGEMENT_STATUS_LABEL[e.status]}</Badge><span className="muted text-sm">{ENGAGEMENT_TYPE_LABEL[e.type]} · {fmtDate(e.startDate, { month: 'short', year: 'numeric' })}</span></span></li>)}
        </ul>
      ) : <div className="slide__sub">Continue monitoring, remediate open findings, and expand coverage across the estate.</div>}
    </Frame>
  );
}

function TeamSlide({ data }: { data: Dataset }) {
  const effort = effortByMember(data).slice(0, 8);
  return (
    <Frame eyebrow="The people" title="Our security team">
      <div className="grid grid--4 gap-16">
        {effort.map((e) => (
          <div key={e.member.id} className="card card--pad center">
            <div className="avatar avatar--xl" style={{ margin: '0 auto 10px' }}>{e.member.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('')}</div>
            <b style={{ fontSize: 'clamp(14px,1.3vw,18px)' }}>{e.member.name}</b>
            <div className="text-xs muted">{e.member.role}</div>
            <div className="row gap-8 mt-8" style={{ justifyContent: 'center' }}><Badge tone="neutral" size="sm">{e.findings} findings</Badge></div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function ClosingSlide({ data }: { data: Dataset }) {
  return (
    <div className="slide slide--title" style={{ justifyContent: 'center' }}>
      <Logo size={54} />
      <h1 className="slide__title mt-24">Thank you</h1>
      <div className="slide__sub mt-16">{data.org.presentation?.footer ?? `${data.org.name} Security Team — questions & next steps.`}</div>
      <div className="row gap-24 mt-32">
        <BigStat value={data.findings.filter((f) => f.status === 'fixed' || f.status === 'verified').length} label="Issues resolved" />
        <BigStat value={data.engagements.filter((e) => e.status === 'completed').length} label="Engagements completed" />
        <BigStat value={data.builds.length} label="Tools delivered" />
      </div>
    </div>
  );
}

function MarkdownSlide({ spec }: { spec: SlideSpec }) {
  return <Frame eyebrow="Note" title={spec.title}><div className="slide__body--center"><Markdown wide>{spec.body}</Markdown></div></Frame>;
}
