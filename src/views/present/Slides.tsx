import React from 'react';
import type { Dataset, SlideSpec } from '@/types';
import { Icon } from '@/components/Icon';
import { Badge } from '@/components/ui';
import { Logo } from '@/components/Layout';
import { Donut, Gauge, BarChart } from '@/components/charts';
import { AttackSimulation } from '@/components/AttackSimulation';
import { Markdown } from '@/components/Markdown';
import { isOpen, severityCounts, riskIndex, riskLabel, remediationRate } from '@/lib/metrics';
import { SEVERITY_LABEL, STATUS_LABEL } from '@/lib/severity';
import { fmtDate, plural } from '@/lib/format';
import { OUTCOME_LABEL } from '@/lib/intake/match';
import { briefFinding } from '@/lib/present/brief';
import type { WindowActivity } from '@/lib/activity';

/** Auto-deck slides are window-scoped via `scope`. Custom decks may omit it. */
export function Slide({ spec, data, active, scope }: { spec: SlideSpec; data: Dataset; active: boolean; scope?: WindowActivity }) {
  switch (spec.kind) {
    case 'title': return <TitleSlide spec={spec} data={data} scope={scope} />;
    case 'agenda': return <AgendaSlide scope={scope} />;
    case 'activity': return <ActivitySlide data={data} scope={scope} />;
    case 'exec-summary': return <ExecSlide data={data} scope={scope} />;
    case 'kpis': return <ExecSlide data={data} scope={scope} />;
    case 'severity': return <SeveritySlide data={data} scope={scope} />;
    case 'finding': return <FindingSlide spec={spec} data={data} />;
    case 'engagements': return <SeveritySlide data={data} scope={scope} />;
    case 'simulation': return <SimulationSlide spec={spec} data={data} active={active} />;
    case 'remediation': return <RemediationSlide data={data} scope={scope} />;
    case 'builds':
    case 'soc':
    case 'roadmap':
    case 'team':
      return <ActivitySlide data={data} scope={scope} />;
    case 'closing': return <ClosingSlide data={data} scope={scope} />;
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

function scopedFindings(data: Dataset, scope?: WindowActivity) {
  return scope?.findings ?? data.findings;
}

function TitleSlide({ spec, data, scope }: { spec: SlideSpec; data: Dataset; scope?: WindowActivity }) {
  const findings = scopedFindings(data, scope);
  const open = findings.filter(isOpen).length;
  const label = scope?.label ?? 'Security review';
  return (
    <div className="slide slide--title">
      <div className="row gap-16 mb-24">
        <Logo size={54} />
        <div>
          <div className="brand__name" style={{ fontSize: 20, letterSpacing: '0.16em' }}>{data.org.name}</div>
          <div className="brand__sub" style={{ fontSize: 14 }}>Security operations</div>
        </div>
      </div>
      <h1 className="slide__title">{spec.title ?? `${data.org.name} — ${label}`}</h1>
      <div className="slide__sub mt-16">
        What was found, why it matters, how it was proved, and where remediation stands — {label.toLowerCase()}.
      </div>
      <div className="row gap-24 mt-32">
        <BigStat value={findings.length} label="Findings in scope" />
        <BigStat value={open} label="Still open" />
        <BigStat value={scope?.retested.length ?? 0} label="Re-tested" />
        <BigStat value={scope?.resolved.length ?? 0} label="Confirmed fixed" />
      </div>
    </div>
  );
}

function BigStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 'clamp(30px,3.6vw,52px)', fontWeight: 800, color: 'var(--accent-strong)', lineHeight: 1 }}>{value}</div>
      <div className="text-sm muted upper" style={{ marginTop: 6 }}>{label}</div>
    </div>
  );
}

function AgendaSlide({ scope }: { scope?: WindowActivity }) {
  const label = scope?.label?.toLowerCase() ?? 'this period';
  const items = [
    `What we logged — ${label}`,
    'The stakes — severity, exploitability and loss potential',
    'Finding by finding — impact, how it was done, work invested',
    'How an attacker would play it out',
    'Where fixes stand',
  ];
  return (
    <Frame eyebrow="Agenda" title="What this review covers">
      <ul className="slide__list">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </Frame>
  );
}

function ActivitySlide({ data, scope }: { data: Dataset; scope?: WindowActivity }) {
  if (!scope) {
    return (
      <Frame eyebrow="Recent work" title="What we did">
        <div className="slide__sub">Select a presentation window to see logged work.</div>
      </Frame>
    );
  }

  type Entry = { key: string; date: string; label: string; title: string; tone: string };
  const entries: Entry[] = [
    ...scope.logged.map((f) => ({ key: `n-${f.id}`, date: f.discovered, label: 'Logged', title: f.title, tone: `var(--sev-${f.severity})` })),
    ...scope.retested.map((r, i) => ({ key: `r-${i}`, date: r.retest.date, label: OUTCOME_LABEL[r.retest.outcome], title: r.finding.title, tone: 'var(--sev-high)' })),
    ...scope.resolved.map((f) => ({ key: `d-${f.id}`, date: f.verifiedAt ?? f.fixedAt ?? f.discovered, label: 'Resolved', title: f.title, tone: 'var(--good)' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <Frame eyebrow={scope.label} title="Work logged this period">
      <div className="grid grid--3 mb-16">
        <SlideStat value={scope.logged.length} label="Findings logged" tone="var(--accent-strong)" />
        <SlideStat value={scope.retested.length} label="Re-tests run" tone="var(--sev-high)" />
        <SlideStat value={scope.resolved.length} label="Confirmed resolved" tone="var(--good)" />
      </div>
      {entries.length ? (
        <div className="col gap-8">
          {entries.map((e) => (
            <div key={e.key} className="row gap-12" style={{ fontSize: 'clamp(13px,1.3vw,18px)' }}>
              <span className="badge__dot" style={{ background: e.tone, width: 10, height: 10 }} />
              <span className="muted num" style={{ minWidth: 110 }}>{fmtDate(e.date, { day: 'numeric', month: 'short' })}</span>
              <b style={{ minWidth: 140 }}>{e.label}</b>
              <span className="truncate">{e.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="slide__sub">Nothing logged in this window yet — {plural(data.findings.length, 'finding')} remain on the full register.</div>
      )}
    </Frame>
  );
}

function ExecSlide({ data, scope }: { data: Dataset; scope?: WindowActivity }) {
  const findings = scopedFindings(data, scope);
  const open = findings.filter(isOpen);
  const counts = severityCounts(open);
  const risk = riskIndex(open.length ? open : findings);
  const rl = riskLabel(risk);
  const rem = remediationRate(findings);
  const remPct = rem.total ? Math.round((rem.done / rem.total) * 100) : 0;
  const hours = findings.reduce((s, f) => s + (f.effortHours ?? 0), 0);
  const money = findings.reduce((s, f) => s + (f.attack?.financialExposure ?? 0), 0);
  const label = scope?.label?.toLowerCase() ?? 'this review';

  return (
    <Frame eyebrow={`Stakes · ${label}`} title="Why this work matters">
      <div className="grid grid--2 gap-24" style={{ alignItems: 'center' }}>
        <div className="col gap-16">
          <div className="row gap-16" style={{ alignItems: 'center' }}>
            <Gauge value={risk} size={170} />
            <div>
              <Badge tone={rl.tone} size="lg">{rl.label} risk</Badge>
              <div className="slide__sub mt-8" style={{ fontSize: 'clamp(14px,1.4vw,18px)' }}>
                Risk pressure from findings in {label}. Every open critical or high is an active loss path.
              </div>
            </div>
          </div>
        </div>
        <ul className="slide__list" style={{ fontSize: 'clamp(15px,1.5vw,21px)' }}>
          <li><span><b>{open.length}</b> still open{counts.critical ? <> — <b style={{ color: 'var(--sev-critical)' }}>{plural(counts.critical, 'critical')}</b></> : ''}</span></li>
          <li><span><b>{counts.critical + counts.high}</b> critical / high with a modelled exploit path</span></li>
          <li><span><b>{remPct}%</b> already remediated or formally accepted</span></li>
          {hours > 0 && <li><span><b>{hours}</b> engineer-hours invested validating these issues</span></li>}
          {money > 0 && <li><span><b>${money.toLocaleString()}</b> financial exposure on record</span></li>}
          {!hours && !money && <li><span>Each finding was hands-on validated — not a scanner dump.</span></li>}
        </ul>
      </div>
    </Frame>
  );
}

function SlideStat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  return <div className="stat"><div className="stat__value num" style={{ color: tone }}>{value}</div><div className="stat__label">{label}</div></div>;
}

function SeveritySlide({ data, scope }: { data: Dataset; scope?: WindowActivity }) {
  const findings = scopedFindings(data, scope);
  const open = findings.filter(isOpen);
  const counts = severityCounts(open.length ? open : findings);
  const chart = (['critical', 'high', 'medium', 'low', 'info'] as const)
    .filter((s) => counts[s] > 0)
    .map((s) => ({ label: SEVERITY_LABEL[s], value: counts[s], color: `var(--sev-${s})` }));
  const label = scope?.label?.toLowerCase() ?? 'this review';

  return (
    <Frame eyebrow={`Severity · ${label}`} title="Where the risk sits">
      <div className="grid grid--2 gap-24" style={{ alignItems: 'center' }}>
        <Donut
          size={230}
          thickness={30}
          data={chart}
          center={<div><div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{open.length || findings.length}</div><div className="text-sm muted">{open.length ? 'open' : 'logged'}</div></div>}
        />
        <div className="col gap-12">
          <BarChart data={chart} />
          <div className="slide__sub" style={{ fontSize: 'clamp(14px,1.3vw,18px)' }}>
            Critical and high findings are treated as active compromise paths until they are verified closed.
          </div>
        </div>
      </div>
    </Frame>
  );
}

function FindingSlide({ spec, data }: { spec: SlideSpec; data: Dataset }) {
  const f = data.findings.find((x) => x.id === spec.ref);
  if (!f) return <Frame title="Finding"><div className="empty">Finding not found</div></Frame>;
  const brief = briefFinding(f);
  return (
    <Frame eyebrow={`Finding brief · ${brief.severity}`} title={f.title}>
      <div className="slide__sub" style={{ marginBottom: 8 }}>{brief.headline}</div>
      <div className="chips mb-16">
        {brief.stakes.map((s) => <span key={s} className="chip">{s}</span>)}
        <Badge tone={f.severity} size="sm" dot>{brief.severity}</Badge>
        <Badge tone="neutral" size="sm">{brief.status}</Badge>
      </div>
      <div className="grid grid--3 gap-16" style={{ flex: 1 }}>
        <BriefCard icon="alert" title="Impact & loss" body={brief.impact} />
        <BriefCard icon="zap" title="How it was done" body={brief.how} />
        <BriefCard icon="check" title="Work invested" body={brief.work} />
      </div>
    </Frame>
  );
}

function BriefCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="card card--pad" style={{ height: '100%' }}>
      <div className="row gap-8 mb-8">
        <Icon name={icon} size={16} style={{ color: 'var(--accent-strong)' }} />
        <b style={{ fontSize: 'clamp(14px,1.3vw,18px)' }}>{title}</b>
      </div>
      <div style={{ fontSize: 'clamp(13px,1.25vw,17px)', lineHeight: 1.45, color: 'var(--ink-2)' }}>{body}</div>
    </div>
  );
}

function SimulationSlide({ spec, data, active }: { spec: SlideSpec; data: Dataset; active: boolean }) {
  const f = data.findings.find((x) => x.id === spec.ref);
  if (!f) return <Frame title="Attack walkthrough"><div className="empty">Finding not found</div></Frame>;
  const eng = f.engagement ? data.engagements.find((e) => e.id === f.engagement) : undefined;
  const lastRetest = f.retests?.[f.retests.length - 1];
  return (
    <div className="slide">
      <div className="row row--between row--wrap gap-8">
        <div>
          <div className="slide__eyebrow" style={{ color: 'var(--attacker)' }}>Attack walkthrough · how it plays out</div>
          <h1 className="slide__title" style={{ fontSize: 'clamp(22px,2.8vw,38px)' }}>{f.title}</h1>
        </div>
        <div className="row gap-8">
          {lastRetest && (
            <Badge tone="neutral" size="lg">
              <Icon name="repeat" size={14} />
              {plural(f.retests!.length, 're-test')} · {OUTCOME_LABEL[lastRetest.outcome].toLowerCase()}
            </Badge>
          )}
          <Badge tone="neutral" size="lg">{STATUS_LABEL[f.status]}</Badge>
          <Badge tone={f.severity} size="lg" dot>{SEVERITY_LABEL[f.severity]}</Badge>
        </div>
      </div>
      <div className="slide__body" style={{ marginTop: 8 }}>
        <AttackSimulation key={f.id + String(active)} finding={f} engagementType={eng?.type} autoPlay={active} present hideHeader />
      </div>
    </div>
  );
}

function RemediationSlide({ data, scope }: { data: Dataset; scope?: WindowActivity }) {
  const findings = scopedFindings(data, scope);
  const rem = remediationRate(findings);
  const pct = rem.total ? Math.round((rem.done / rem.total) * 100) : 0;
  const byStatus = ['verified', 'fixed', 'in-remediation', 'triaged', 'open', 'risk-accepted'] as const;
  const counts = byStatus
    .map((s) => ({ label: STATUS_LABEL[s], value: findings.filter((f) => f.status === s).length }))
    .filter((x) => x.value > 0)
    .map((c) => ({
      ...c,
      color: /verified|fixed/i.test(c.label) ? 'var(--good)' : /open/i.test(c.label) ? 'var(--sev-critical)' : 'var(--sev-high)',
    }));
  const label = scope?.label?.toLowerCase() ?? 'this review';

  return (
    <Frame eyebrow={`Remediation · ${label}`} title="Progress on fixes">
      <div className="grid grid--2 gap-24" style={{ alignItems: 'center' }}>
        <div className="center">
          <div className="num" style={{ fontSize: 'clamp(48px,7vw,96px)', fontWeight: 800, color: 'var(--good)', lineHeight: 1 }}>{pct}%</div>
          <div className="slide__sub">of {plural(rem.total, 'finding')} in this window remediated or formally accepted</div>
        </div>
        {counts.length ? <BarChart data={counts} /> : <div className="slide__sub">No findings in this window yet.</div>}
      </div>
    </Frame>
  );
}

function ClosingSlide({ data, scope }: { data: Dataset; scope?: WindowActivity }) {
  const findings = scopedFindings(data, scope);
  const fixed = findings.filter((f) => f.status === 'fixed' || f.status === 'verified').length;
  const open = findings.filter(isOpen).length;
  return (
    <div className="slide slide--title" style={{ justifyContent: 'center' }}>
      <Logo size={54} />
      <h1 className="slide__title mt-24">Next steps</h1>
      <div className="slide__sub mt-16">
        Close every open critical and high. Re-test to verify. Keep logging so this review stays a live record of the work.
      </div>
      <div className="row gap-24 mt-32">
        <BigStat value={findings.length} label="In this review" />
        <BigStat value={fixed} label="Closed" />
        <BigStat value={open} label="Still open" />
      </div>
    </div>
  );
}

function MarkdownSlide({ spec }: { spec: SlideSpec }) {
  return <Frame eyebrow="Note" title={spec.title}><div className="slide__body--center"><Markdown wide>{spec.body}</Markdown></div></Frame>;
}
