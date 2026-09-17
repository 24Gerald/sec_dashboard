import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Empty, SeverityBadge, Field } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { AttackSimulation } from '@/components/AttackSimulation';
import type { Finding, Severity } from '@/types';
import { SEVERITIES } from '@/types';
import { SEVERITY_LABEL, sortBySeverity } from '@/lib/severity';
import { classLabel } from '@/sim/engine';
import { classifyFinding } from '@/sim/classify';

/** Attack simulator: pick a real finding, or compose a hypothetical scenario, and watch it play out. */
export function Simulator() {
  const { data, index } = useStore();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<'finding' | 'compose'>(params.get('finding') ? 'finding' : 'finding');
  const [pickId, setPickId] = useState<string>(params.get('finding') ?? data.findings[0]?.id ?? '');
  const [scratch, setScratch] = useState<Finding>({ id: 'SIM', title: 'Unauthenticated admin API allows account takeover', severity: 'critical', status: 'open', discovered: '2026-01-01', summary: 'An internal admin API can be reached without logging in, letting anyone change other users\' roles and passwords.' });

  const picked = mode === 'finding' ? index.findingById.get(pickId) : scratch;
  const engType = picked?.engagement ? index.engagementById.get(picked.engagement)?.type : undefined;
  const cls = useMemo(() => picked ? classifyFinding(picked, engType) : null, [picked, engType]);

  const byClass = useMemo(() => {
    const groups = new Map<string, Finding[]>();
    for (const f of sortBySeverity(data.findings)) {
      const c = classLabel(classifyFinding(f, index.engagementById.get(f.engagement ?? '')?.type).cls);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(f);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [data.findings, index]);

  return (
    <div className="page">
      <PageHeader eyebrow="Analysis" title="Attack simulator"
        sub="See how any finding could be exploited and what damage it could cause — an at-a-glance story for technical and non-technical audiences alike."
        actions={<div className="seg">
          <button className={`seg__item${mode === 'finding' ? ' seg__item--active' : ''}`} onClick={() => setMode('finding')}>From a finding</button>
          <button className={`seg__item${mode === 'compose' ? ' seg__item--active' : ''}`} onClick={() => setMode('compose')}>Compose scenario</button>
        </div>}
      />

      <div className="grid grid--detail">
        <div>
          {picked ? (
            <AttackSimulation key={mode + (picked.id) + picked.severity + (picked.attack?.class ?? '')} finding={picked} engagementType={engType} autoPlay />
          ) : <Empty title="Select a finding to simulate" />}
        </div>

        <div className="col gap-16">
          {mode === 'finding' ? (
            <Card title="Choose a finding" sub={`${data.findings.length} logged`}>
              <div className="col gap-8" style={{ maxHeight: 520, overflowY: 'auto' }}>
                {byClass.map(([cName, list]) => (
                  <div key={cName}>
                    <div className="upper muted mb-8" style={{ marginTop: 6 }}>{cName} · {list.length}</div>
                    {list.map((f) => (
                      <button key={f.id} className="list__item list__item--link w-100" style={{ textAlign: 'left', border: 0, background: pickId === f.id ? 'var(--accent-soft)' : 'transparent' }}
                        onClick={() => { setPickId(f.id); setParams({ finding: f.id }); }}>
                        <SeverityBadge severity={f.severity} size="sm" showLabel={false} />
                        <div className="list__body"><div className="text-sm" style={{ fontWeight: pickId === f.id ? 650 : 500 }}>{f.title}</div><div className="text-xs muted mono">{f.id}</div></div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card title="Compose a scenario" sub="Describe a hypothetical issue">
              <div className="col gap-12">
                <Field label="Title"><input className="input" value={scratch.title} onChange={(e) => setScratch({ ...scratch, title: e.target.value })} /></Field>
                <Field label="What's the problem?" help="Plain words — this drives the classification."><textarea className="textarea" value={scratch.summary} onChange={(e) => setScratch({ ...scratch, summary: e.target.value })} /></Field>
                <Field label="Severity">
                  <select className="select" value={scratch.severity} onChange={(e) => setScratch({ ...scratch, severity: e.target.value as Severity })}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
                  </select>
                </Field>
                {cls && <div className="text-sm"><span className="muted">Detected as</span> <Badge tone="neutral">{classLabel(cls.cls)}</Badge> <span className="text-xs muted">— {cls.reason}</span></div>}
                <div className="chips">
                  <span className="text-xs muted w-100 mb-8">Quick presets:</span>
                  {PRESETS.map((p) => <button key={p.title} className="chip clickable" onClick={() => setScratch({ ...scratch, ...p })}><Icon name="zap" size={12} />{p.label}</button>)}
                </div>
              </div>
            </Card>
          )}
          <div className="text-xs muted row gap-8"><Icon name="sparkle" size={13} /><span>Simulations are generated locally and deterministically from the finding's classification — no data leaves the browser.</span></div>
        </div>
      </div>
    </div>
  );
}

const PRESETS: (Partial<Finding> & { label: string })[] = [
  { label: 'SQL injection', title: 'SQL injection in search API', summary: 'User input is concatenated into a database query, letting an attacker read the whole database.', severity: 'critical' },
  { label: 'Reentrancy', title: 'Reentrancy in staking contract', summary: 'The contract sends funds before updating balances, allowing repeated withdrawals to drain it.', severity: 'critical', affected: { contract: 'Staking.sol' } },
  { label: 'Phishing', title: 'Staff vulnerable to phishing', summary: 'A simulated phishing email captured employee credentials to the corporate login.', severity: 'high' },
  { label: 'Exposed secret', title: 'API key committed to repository', summary: 'A live cloud API key was found hardcoded in the public git history.', severity: 'critical' },
  { label: 'DDoS / load', title: 'Service falls over under load', summary: 'Above 500 concurrent users the connection pool is exhausted and the service times out for everyone.', severity: 'high' },
  { label: 'IDOR', title: 'Users can read others\' invoices', summary: 'Changing the invoice id in the URL returns another user\'s document with no ownership check.', severity: 'high' },
];
