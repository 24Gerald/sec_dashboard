import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Button, SeverityBadge, Empty, Segmented, Tabs, Modal } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SearchInput, Select } from '@/components/Filters';
import { FindingTableRow } from '@/components/FindingRow';
import { AttackSimulation } from '@/components/AttackSimulation';
import { EvidenceViewer, CodeBlock } from '@/components/Evidence';
import { Markdown } from '@/components/Markdown';
import { FindingForm } from './FindingForm';
import type { Finding, Severity, FindingStatus } from '@/types';
import { SEVERITIES, FINDING_STATUSES } from '@/types';
import { SEVERITY_LABEL, STATUS_LABEL, STATUS_TONE, SEVERITY_ORDER, ENGAGEMENT_TYPE_LABEL } from '@/lib/severity';
import { isOpen, isOverdue, dueDate, severityCounts } from '@/lib/metrics';
import { DEFAULT_WINDOW_DAYS, isActiveIn, lastActivity } from '@/lib/activity';
import { OUTCOME_LABEL } from '@/lib/intake/match';
import { fmtDate, fmtMoney, relTime } from '@/lib/format';

type Sort = 'severity' | 'recent' | 'activity' | 'due' | 'cvss';
type View = 'all' | 'open' | 'critical' | 'recent';

export function Findings() {
  const { data } = useStore();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [sev, setSev] = useState<Severity | ''>((params.get('severity') as Severity) || '');
  const [status, setStatus] = useState<FindingStatus | ''>('');
  const [eng, setEng] = useState(params.get('engagement') ?? '');
  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<Sort>('severity');
  const [form, setForm] = useState(false);

  const filtered = useMemo(() => {
    let list = data.findings;
    if (view === 'open') list = list.filter(isOpen);
    if (view === 'critical') list = list.filter((f) => f.severity === 'critical' || f.severity === 'high');
    if (view === 'recent') list = list.filter((f) => isActiveIn(f, DEFAULT_WINDOW_DAYS));
    if (sev) list = list.filter((f) => f.severity === sev);
    if (status) list = list.filter((f) => f.status === status);
    if (eng) list = list.filter((f) => f.engagement === eng);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((f) => (f.title + f.summary + f.id + (f.tags ?? []).join(' ') + (f.cwe ?? []).join(' ')).toLowerCase().includes(s));
    }
    const sorters: Record<Sort, (a: Finding, b: Finding) => number> = {
      severity: (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (b.cvss?.score ?? 0) - (a.cvss?.score ?? 0),
      recent: (a, b) => +new Date(b.discovered) - +new Date(a.discovered),
      activity: (a, b) => lastActivity(b).localeCompare(lastActivity(a)),
      due: (a, b) => +new Date(dueDate(a)) - +new Date(dueDate(b)),
      cvss: (a, b) => (b.cvss?.score ?? 0) - (a.cvss?.score ?? 0),
    };
    return [...list].sort(sorters[sort]);
  }, [data.findings, view, sev, status, eng, q, sort]);

  const counts = severityCounts(data.findings);

  return (
    <div className="page">
      <PageHeader eyebrow="Findings register" title="Findings" sub="Every vulnerability and issue the team has logged, with dates — click one to see how it can be exploited."
        actions={<>
          <Button icon="inbox" onClick={() => nav('/intake')}>Log from a report</Button>
          <Button variant="primary" icon="plus" onClick={() => setForm(true)}>Log finding</Button>
        </>} />

      <div className="grid grid--5 mb-16">
        {SEVERITIES.map((s) => (
          <button key={s} className="stat clickable" style={{ textAlign: 'left', border: sev === s ? '1px solid var(--accent)' : undefined }} onClick={() => setSev(sev === s ? '' : s)}>
            <span className="stat__bar" style={{ background: `var(--sev-${s})` }} />
            <div className="stat__label"><span className="badge__dot" style={{ background: `var(--sev-${s})`, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />{SEVERITY_LABEL[s]}</div>
            <div className="stat__value num">{counts[s]}</div>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <Segmented value={view} onChange={setView} options={[
          { value: 'all', label: `All ${data.findings.length}` },
          { value: 'open', label: 'Open' },
          { value: 'critical', label: 'Crit/High' },
          { value: 'recent', label: `Last ${DEFAULT_WINDOW_DAYS}d` },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search findings…" />
        <Select value={status} onChange={setStatus} options={FINDING_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} all="Any status" />
        <Select value={eng} onChange={(v) => setEng(v)} options={data.engagements.map((e) => ({ value: e.id, label: e.title }))} all="Any engagement" />
        <div className="toolbar__spacer" />
        <label className="text-xs muted row gap-4">Sort
          <select className="select select--sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ minWidth: 110 }}>
            <option value="severity">Severity</option><option value="recent">Newest</option><option value="activity">Last activity</option><option value="due">Due date</option><option value="cvss">CVSS</option>
          </select>
        </label>
        <span className="toolbar__count">{filtered.length} shown</span>
      </div>

      {filtered.length ? (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Severity</th><th>Finding</th><th>Status</th><th>Logged</th><th className="num">CVSS</th><th>Assignee</th><th>Due</th></tr></thead>
              <tbody>{filtered.map((f) => <FindingTableRow key={f.id} f={f} onNav={() => nav(`/findings/${f.id}`)} />)}</tbody>
            </table>
          </div>
        </Card>
      ) : <Empty title="No findings match" >Adjust the filters, or log a new finding.</Empty>}

      {form && <FindingForm onClose={() => setForm(false)} onSaved={(f) => nav(`/findings/${f.id}`)} />}
    </div>
  );
}

export function FindingDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { index, isDraft, remove, save, toast } = useStore();
  const [tab, setTab] = useState<'sim' | 'detail' | 'evidence' | 'remediation'>('sim');
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const f = id ? index.findingById.get(id) : undefined;
  if (!f) return <div className="page"><Empty title="Finding not found"><Link to="/findings">Back to findings</Link></Empty></div>;
  const eng = f.engagement ? index.engagementById.get(f.engagement) : undefined;
  const overdue = isOverdue(f);
  const draft = isDraft('finding', f.id);

  const quickStatus = async (status: FindingStatus) => {
    const upd: Finding = { ...f, status, ...(status === 'fixed' || status === 'verified' ? { fixedAt: f.fixedAt ?? new Date().toISOString().slice(0, 10) } : {}) };
    await save('finding', upd);
    toast(`Marked ${STATUS_LABEL[status]}`, 'good');
  };

  return (
    <div className="page">
      <div className="row gap-8 mb-12 text-sm muted">
        <Link to="/findings" className="row gap-4"><Icon name="chevron-left" size={14} />Findings</Link>
        <span>/</span><span className="mono">{f.id}</span>
        {draft && <span className="draft-tag">draft</span>}
      </div>

      <PageHeader
        eyebrow={eng ? ENGAGEMENT_TYPE_LABEL[eng.type] : 'Finding'}
        title={<span className="row gap-12 row--wrap"><SeverityBadge severity={f.severity} size="lg" />{f.title}</span>}
        sub={f.summary}
        actions={<>
          <Button icon="edit" onClick={() => setEdit(true)}>Edit</Button>
          <div className="btn-group">
            <Button size="sm" onClick={() => quickStatus('in-remediation')} title="Mark in remediation"><Icon name="wrench" size={14} /></Button>
            <Button size="sm" onClick={() => quickStatus('fixed')} title="Mark fixed"><Icon name="check" size={14} /></Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDel(true)} title="Delete"><Icon name="trash" size={14} /></Button>
          </div>
        </>}
      />

      <div className="row row--wrap gap-8 mb-16">
        <Badge tone={STATUS_TONE[f.status]} dot>{STATUS_LABEL[f.status]}</Badge>
        {f.cvss && <Badge tone="neutral"><Icon name="gauge" size={12} /> CVSS {f.cvss.score} {f.cvss.version && `v${f.cvss.version}`}</Badge>}
        {(f.cwe ?? []).map((c) => <Badge key={c} tone="outline">{c}</Badge>)}
        {f.owasp && <Badge tone="outline">{f.owasp}</Badge>}
        {f.attack?.financialExposure ? <Badge tone="high"><Icon name="coins" size={12} />{fmtMoney(f.attack.financialExposure)} exposure</Badge> : null}
        {overdue && <Badge tone="crit"><Icon name="clock" size={12} />Overdue · was due {fmtDate(dueDate(f))}</Badge>}
        {f.source === 'soc-bot' && <Badge tone="accent"><Icon name="robot" size={12} />Auto-logged by SOC bot</Badge>}
        {f.source === 'report-intake' && <Badge tone="accent"><Icon name="inbox" size={12} />Logged from a report{f.intake?.fileName ? ` · ${f.intake.fileName}` : ''}</Badge>}
        {f.retests?.length ? <Badge tone="warn"><Icon name="repeat" size={12} />Re-tested {f.retests.length}× · last {fmtDate(f.retests[f.retests.length - 1].date)}</Badge> : null}
        {(f.tags ?? []).map((t) => <span key={t} className="chip">{t}</span>)}
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'sim', label: 'Attack simulation', icon: 'crosshair' },
        { id: 'detail', label: 'Details', icon: 'file' },
        { id: 'evidence', label: 'Evidence', icon: 'eye', count: f.evidence?.length },
        { id: 'remediation', label: 'Remediation', icon: 'shield-check' },
      ]} />

      {tab === 'sim' && (
        <div className="col gap-16">
          <AttackSimulation finding={f} engagementType={eng?.type} autoPlay />
          <div className="text-xs muted row gap-8"><Icon name="sparkle" size={13} />This simulation is generated automatically from the finding's classification. It illustrates a plausible exploitation path and impact — not a guarantee of exploitability.</div>
        </div>
      )}

      {tab === 'detail' && (
        <div className="grid grid--detail">
          <div className="col gap-16">
            {f.description && <Card title="Description"><Markdown>{f.description}</Markdown></Card>}
            {f.impact && <Card title="Impact"><Markdown>{f.impact}</Markdown></Card>}
            {f.stepsToReproduce?.length ? (
              <Card title="Steps to reproduce">
                <ol className="md" style={{ paddingLeft: 20 }}>{f.stepsToReproduce.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </Card>
            ) : null}
            {!f.description && !f.impact && !f.stepsToReproduce?.length && <Empty title="No extended write-up" >Add a description, impact and reproduction steps by editing this finding.</Empty>}
          </div>
          <div className="col gap-16">
            <Card title="Details">
              <dl className="detail-key">
                <dt>Discovered</dt><dd>{fmtDate(f.discovered)}</dd>
                {f.reported && <><dt>Reported</dt><dd>{fmtDate(f.reported)}</dd></>}
                <dt>Last activity</dt><dd>{fmtDate(lastActivity(f))}</dd>
                <dt>Due</dt><dd style={{ color: overdue ? 'var(--crit)' : undefined }}>{fmtDate(dueDate(f))}</dd>
                {f.fixedAt && <><dt>Fixed</dt><dd>{fmtDate(f.fixedAt)}</dd></>}
                {f.reporter && <><dt>Reporter</dt><dd>{index.memberById.get(f.reporter)?.name ?? f.reporter}</dd></>}
                {f.assignee && <><dt>Assignee</dt><dd>{index.memberById.get(f.assignee)?.name ?? f.assignee}</dd></>}
                {eng && <><dt>Engagement</dt><dd><Link to={`/engagements/${eng.id}`}>{eng.title}</Link></dd></>}
                {f.affected?.component && <><dt>Component</dt><dd className="mono">{f.affected.component}</dd></>}
                {f.affected?.endpoint && <><dt>Endpoint</dt><dd className="mono">{f.affected.endpoint}</dd></>}
                {f.affected?.file && <><dt>File</dt><dd className="mono">{f.affected.file}</dd></>}
                {f.affected?.contract && <><dt>Contract</dt><dd className="mono">{f.affected.contract}</dd></>}
              </dl>
            </Card>
            {f.assets?.length ? (
              <Card title="Affected assets">
                <div className="chips">{f.assets.map((a) => { const asset = index.assetById.get(a); return <Link key={a} to="/assets" className="chip"><Icon name="layers" size={12} />{asset?.name ?? a}</Link>; })}</div>
              </Card>
            ) : null}
            {f.retests?.length ? (
              <Card title="Re-tests" sub="Each time this same issue was tested again">
                <div className="col gap-8">
                  {[...f.retests].reverse().map((r, i) => (
                    <div key={i} className="list__item" style={{ paddingTop: i ? 10 : 0 }}>
                      <span className="list__icon" style={{ width: 26, height: 26 }}><Icon name="repeat" size={13} /></span>
                      <div className="list__body">
                        <div className="row gap-8 row--wrap">
                          <b className="text-sm">{fmtDate(r.date)}</b>
                          <Badge tone={r.outcome === 'resolved' ? 'good' : r.outcome === 'still-present' ? 'crit' : 'warn'} size="sm">{OUTCOME_LABEL[r.outcome]}</Badge>
                          {r.by && <span className="text-xs muted">{index.memberById.get(r.by)?.name ?? r.by}</span>}
                        </div>
                        {r.note && <div className="text-xs muted mt-4">{r.note}</div>}
                        {r.reportId && <Link to={`/reports/${r.reportId}`} className="text-xs row gap-4 mt-4"><Icon name="file" size={11} />{r.reportId}</Link>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
            {f.timeline?.length ? (
              <Card title="Lifecycle">
                <div className="timeline">
                  {f.timeline.map((t, i) => (
                    <div className="timeline__item" key={i}>
                      <span className={`timeline__dot ${t.type === 'fixed' || t.type === 'verified' ? 'timeline__dot--good' : t.type === 'discovered' || t.type === 'reopened' ? 'timeline__dot--crit' : 'timeline__dot--accent'}`} />
                      <div className="timeline__date">{fmtDate(t.date)}</div>
                      <div className="timeline__title" style={{ textTransform: 'capitalize' }}>{t.type.replace('-', ' ')}</div>
                      {t.note && <div className="timeline__note">{t.note}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
            {f.references?.length ? (
              <Card title="References">
                <div className="col gap-4">{f.references.map((r, i) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="row gap-4"><Icon name="external" size={12} />{r.title}</a>)}</div>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'evidence' && (f.evidence?.length ? <EvidenceViewer items={f.evidence} /> : <Empty icon="eye" title="No evidence attached" >Add screenshots, code snippets, requests or PoCs to this finding.</Empty>)}

      {tab === 'remediation' && (
        f.remediation ? (
          <div className="grid grid--detail">
            <Card title="Recommendation">
              <Markdown>{f.remediation.recommendation}</Markdown>
              {f.remediation.verification && <><div className="section-title">Verification</div><Markdown sm>{f.remediation.verification}</Markdown></>}
              {f.remediation.patch && <><div className="section-title">Suggested fix</div><CodeBlock code={f.remediation.patch} language={f.remediation.patchLanguage} title="patch" /></>}
            </Card>
            <Card title="Remediation status">
              <dl className="detail-key">
                {f.remediation.status && <><dt>Status</dt><dd><Badge tone={f.remediation.status === 'done' || f.remediation.status === 'verified' ? 'good' : 'warn'} size="sm">{f.remediation.status}</Badge></dd></>}
                {f.remediation.effort && <><dt>Effort</dt><dd>{f.remediation.effort}</dd></>}
                {f.remediation.owner && <><dt>Owner</dt><dd>{index.memberById.get(f.remediation.owner)?.name ?? f.remediation.owner}</dd></>}
                {f.remediation.eta && <><dt>ETA</dt><dd>{fmtDate(f.remediation.eta)}</dd></>}
              </dl>
            </Card>
          </div>
        ) : <Empty icon="shield-check" title="No remediation recorded" ><Button size="sm" icon="edit" onClick={() => setEdit(true)}>Add remediation</Button></Empty>
      )}

      {edit && <FindingForm initial={f} onClose={() => setEdit(false)} />}
      {confirmDel && (
        <Modal title="Delete finding?" onClose={() => setConfirmDel(false)} footer={<>
          <Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancel</Button>
          <Button variant="danger" icon="trash" onClick={async () => { await remove('finding', f.id); toast('Finding deleted'); nav('/findings'); }}>Delete {f.id}</Button>
        </>}>
          <p>This removes <b>{f.title}</b> ({f.id}). {draft ? 'This is a local draft.' : 'On the authoring server this deletes the JSON file.'}</p>
        </Modal>
      )}
      <span hidden>{relTime(f.discovered)}</span>
    </div>
  );
}
