import { useMemo, useState } from 'react';
import type { Finding, Severity, FindingStatus } from '@/types';
import { SEVERITIES, FINDING_STATUSES } from '@/types';
import { Field, Button, Badge, Modal } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useStore } from '@/data/store';
import { nextId, ID_PREFIX } from '@/lib/ids';
import { todayISO } from '@/lib/format';
import { SEVERITY_LABEL, STATUS_LABEL, severityFromCvss } from '@/lib/severity';
import { classifyFinding } from '@/sim/classify';
import { classLabel } from '@/sim/engine';
import { AttackSimulation } from '@/components/AttackSimulation';

const ATTACK_CLASSES = ['auto', 'sql-injection', 'command-injection', 'xss', 'csrf', 'ssrf', 'idor', 'auth-bypass', 'privilege-escalation', 'secrets-exposure', 'rce', 'misconfiguration', 'outdated-component', 'weak-crypto', 'business-logic', 'race-condition', 'dos', 'resource-exhaustion', 'reentrancy', 'access-control-contract', 'oracle-manipulation', 'flash-loan', 'signature-replay', 'mitm', 'cleartext-traffic', 'open-port', 'phishing', 'supply-chain', 'generic'] as const;

/** Create / edit a finding. Saves to the authoring server when available, else a local draft. */
export function FindingForm({ initial, onClose, onSaved }: { initial?: Partial<Finding>; onClose: () => void; onSaved?: (f: Finding) => void }) {
  const { data, save, online, toast, upload } = useStore();
  const editing = !!initial?.id;
  const [f, setF] = useState<Finding>(() => ({
    id: initial?.id ?? nextId(ID_PREFIX.finding, data.findings.map((x) => x.id)),
    title: '', severity: 'medium', status: 'open', discovered: todayISO(), summary: '',
    source: 'manual', ...initial,
  } as Finding));
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Finding>(k: K, v: Finding[K]) => setF((p) => ({ ...p, [k]: v }));

  const engType = f.engagement ? data.engagements.find((e) => e.id === f.engagement)?.type : undefined;
  const cls = useMemo(() => classifyFinding(f, engType), [f, engType]);
  const canSim = f.title.length > 3 && f.summary.length > 3;

  const submit = async () => {
    if (!f.title.trim()) { toast('A title is required', 'bad'); return; }
    if (!f.summary.trim()) { toast('A plain-English summary is required', 'bad'); return; }
    const clean: Finding = { ...f, cwe: f.cwe?.filter(Boolean), tags: f.tags?.filter(Boolean) };
    const where = await save('finding', clean);
    toast(where === 'server' ? `Saved ${clean.id} to the repository` : `Saved ${clean.id} as a local draft`, 'good');
    onSaved?.(clean);
    onClose();
  };

  const onFile = async (file: File) => {
    setUploading(true);
    const path = await upload(file, 'evidence');
    setUploading(false);
    if (path) {
      const rel = path.replace(/^.*evidence\//, '');
      set('evidence', [...(f.evidence ?? []), { type: 'screenshot', title: file.name, path: rel }]);
      toast('Screenshot uploaded', 'good');
    } else toast('Upload needs the authoring server (npm run server)', 'bad');
  };

  return (
    <Modal title={editing ? `Edit ${f.id}` : 'Log a new finding'} onClose={onClose} size="lg"
      footer={<>
        <span className="flex-1 text-xs muted row gap-4"><Icon name={online ? 'save' : 'edit'} size={13} />{online ? 'Writes to content/findings/' : 'Saved locally until the authoring server runs'}</span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={submit}>{editing ? 'Save changes' : 'Log finding'}</Button>
      </>}>
      <div className="form-grid">
        <Field label="Title"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Reentrancy in Vault.withdraw()" autoFocus /></Field>
        <Field label="Finding ID"><input className="input mono" value={f.id} onChange={(e) => set('id', e.target.value)} disabled={editing} /></Field>
      </div>
      <Field label="Plain-English summary" help="One paragraph a non-technical reader can understand — this drives the attack simulation.">
        <textarea className="textarea" value={f.summary} onChange={(e) => set('summary', e.target.value)} placeholder="What is the problem, in ordinary words?" />
      </Field>

      <div className="form-grid form-grid--3 mt-12">
        <Field label="Severity">
          <select className="select" value={f.severity} onChange={(e) => set('severity', e.target.value as Severity)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value as FindingStatus)}>
            {FINDING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="CVSS score" hint={<span className="text-xs muted">0–10</span>}>
          <input className="input num" type="number" min={0} max={10} step={0.1} value={f.cvss?.score ?? ''} onChange={(e) => { const score = e.target.value ? Number(e.target.value) : undefined; set('cvss', score === undefined ? undefined : { ...f.cvss, score }); if (score !== undefined && !editing) set('severity', severityFromCvss(score)); }} />
        </Field>
      </div>

      <div className="form-grid form-grid--3 mt-12">
        <Field label="Engagement">
          <select className="select" value={f.engagement ?? ''} onChange={(e) => set('engagement', e.target.value || undefined)}>
            <option value="">— none —</option>
            {data.engagements.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </Field>
        <Field label="Reporter">
          <select className="select" value={f.reporter ?? ''} onChange={(e) => set('reporter', e.target.value || undefined)}>
            <option value="">—</option>
            {data.org.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Assignee">
          <select className="select" value={f.assignee ?? ''} onChange={(e) => set('assignee', e.target.value || undefined)}>
            <option value="">—</option>
            {data.org.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="form-grid form-grid--3 mt-12">
        <Field label="Discovered"><input className="input" type="date" value={f.discovered} onChange={(e) => set('discovered', e.target.value)} /></Field>
        <Field label="CWE(s)" help="comma separated"><input className="input mono" value={(f.cwe ?? []).join(', ')} onChange={(e) => set('cwe', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="CWE-89" /></Field>
        <Field label="Tags" help="comma separated"><input className="input" value={(f.tags ?? []).join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="sqli, database" /></Field>
      </div>

      <div className="form-section">
        <div className="form-section__title">Affected component</div>
        <div className="form-grid form-grid--3">
          <Field label="Component / endpoint"><input className="input mono" value={f.affected?.component ?? f.affected?.endpoint ?? ''} onChange={(e) => set('affected', { ...f.affected, component: e.target.value })} placeholder="/api/search" /></Field>
          <Field label="File / contract"><input className="input mono" value={f.affected?.file ?? f.affected?.contract ?? ''} onChange={(e) => set('affected', { ...f.affected, file: e.target.value })} placeholder="Vault.sol" /></Field>
          <Field label="Attack class" help="Override the auto-classifier">
            <select className="select" value={f.attack?.class ?? 'auto'} onChange={(e) => set('attack', { ...f.attack, class: e.target.value as Finding['attack'] extends undefined ? never : NonNullable<Finding['attack']>['class'] })}>
              {ATTACK_CLASSES.map((c) => <option key={c} value={c}>{c === 'auto' ? 'Auto-detect' : classLabel(c)}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <Field label="Remediation recommendation" hint={undefined}>
        <textarea className="textarea" style={{ minHeight: 60 }} value={f.remediation?.recommendation ?? ''} onChange={(e) => set('remediation', { ...f.remediation, recommendation: e.target.value })} placeholder="How to fix it" />
      </Field>

      <div className="form-section">
        <div className="row row--between mb-8">
          <div className="form-section__title" style={{ margin: 0 }}>Evidence</div>
          <label className="btn btn--sm">
            <Icon name="download" size={14} />{uploading ? 'Uploading…' : 'Add screenshot'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        </div>
        {f.evidence?.length ? (
          <div className="chips">{f.evidence.map((ev, i) => <span key={i} className="chip"><Icon name="file" size={12} />{ev.title ?? ev.type}<Icon name="x" size={12} className="clickable" onClick={() => set('evidence', f.evidence!.filter((_, j) => j !== i))} /></span>)}</div>
        ) : <div className="text-xs muted">No evidence attached yet. Add screenshots, or edit the JSON to add code snippets and PoCs.</div>}
      </div>

      <div className="form-section">
        <div className="row gap-8 mb-8">
          <Icon name="crosshair" size={15} style={{ color: 'var(--attacker)' }} />
          <b className="text-sm">Live attack preview</b>
          <Badge tone="neutral" size="sm">{classLabel(cls.cls)}</Badge>
          <span className="text-xs muted">— {cls.reason}</span>
        </div>
        {canSim ? <AttackSimulation finding={f} engagementType={engType} layout="stacked" /> : <div className="empty text-sm">Add a title and summary to preview how this finding could be exploited.</div>}
      </div>
    </Modal>
  );
}
