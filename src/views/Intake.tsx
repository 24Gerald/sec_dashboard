/**
 * Report intake — the fast path for logging work.
 *
 * Drop a report (txt, markdown, PDF or Word) or paste it, and the dashboard
 * reads out the finding itself: severity, CVSS, CWE, affected component,
 * reproduction steps, remediation. If the report is the same issue as something
 * already logged it is recorded as a re-test of that finding instead of a
 * duplicate — resolving the original when the report says the fix worked, and
 * always stamping today's date so the work shows up.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Evidence, Finding, Report, RetestOutcome, Severity } from '@/types';
import { RETEST_OUTCOMES, SEVERITIES } from '@/types';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, Field, SeverityBadge } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FindingForm } from './FindingForm';
import { ACCEPT_ATTR, extractText, type IntakeFileType } from '@/lib/intake/extract';
import { fileToDataUrl, isImageFile, prepareShot, revokeShot, type PreparedShot } from '@/lib/intake/images';
import { parseReport, type Candidate, type ParsedReport } from '@/lib/intake/parse';
import { applyRetest, findingFromDraft, matchExisting, MATCH_THRESHOLD, OUTCOME_LABEL, type FindingMatch } from '@/lib/intake/match';
import { nextId, ID_PREFIX } from '@/lib/ids';
import { fmtDate, todayISO } from '@/lib/format';
import { SEVERITY_LABEL, STATUS_LABEL } from '@/lib/severity';

interface Decision {
  mode: 'new' | 'retest' | 'skip';
  matchId?: string;
  outcome: RetestOutcome;
  title: string;
  severity: Severity;
  date: string;
}

const REPORT_TYPE: Record<string, Report['type']> = {
  'smart-contract-audit': 'audit', 'penetration-test': 'pentest', 'load-test': 'load-test',
  'incident-response': 'incident', 'vulnerability-assessment': 'assessment', 'code-review': 'assessment',
};

export function Intake() {
  const { data, index, save, saveReportBody, upload, online, toast, memberName } = useStore();
  const nav = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedReport | null>(null);
  const [matches, setMatches] = useState<FindingMatch[][]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [shots, setShots] = useState<PreparedShot[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [pasting, setPasting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [shotDragging, setShotDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fullForm, setFullForm] = useState<Partial<Finding> | null>(null);
  const [reporter, setReporter] = useState('');
  const shotInput = useRef<HTMLInputElement>(null);

  const engagementType = useCallback((id?: string) => (id ? index.engagementById.get(id)?.type : undefined), [index]);

  const ingest = useCallback((text: string, meta: { type: IntakeFileType; fileName?: string }) => {
    const report = parseReport(text, { engagements: data.engagements, assets: data.assets, team: data.org.team }, meta);
    const perCandidate = report.candidates.map((c) => matchExisting(c.draft, data.findings, { engagementType }));
    setParsed(report);
    setMatches(perCandidate);
    setDecisions(report.candidates.map((c, i) => defaultDecision(c, perCandidate[i])));
    setReporter(report.candidates.find((c) => c.draft.reporter)?.draft.reporter ?? '');
    setExpanded(report.candidates.length === 1 ? 0 : null);
  }, [data.engagements, data.assets, data.org.team, data.findings, engagementType]);

  const onFile = useCallback(async (file: File) => {
    setReading(true);
    try {
      const { text, type, warnings } = await extractText(file);
      if (!text.trim()) {
        toast(warnings[0] ?? 'Nothing readable in that file', 'bad');
        setPasting(true);
        return;
      }
      setSourceFile(file);
      setPasteText('');
      ingest(text, { type, fileName: file.name });
      if (warnings.length) toast(warnings[0], 'neutral');
    } catch (e) {
      toast(`Couldn’t read that file: ${String((e as Error).message ?? e)}`, 'bad');
    } finally { setReading(false); }
  }, [ingest, toast]);

  const clearShots = useCallback((list: PreparedShot[]) => { list.forEach(revokeShot); }, []);
  const reset = () => {
    clearShots(shots);
    setParsed(null); setMatches([]); setDecisions([]); setSourceFile(null); setShots([]);
    setPasteText(''); setPasting(false);
  };

  const addShots = useCallback(async (files: File[]) => {
    const images = files.filter(isImageFile);
    if (!images.length) { toast('Drop a PNG, JPG, GIF or WebP screenshot', 'neutral'); return; }
    try {
      const prepared = await Promise.all(images.map((f) => prepareShot(f)));
      setShots((prev) => [...prev, ...prepared]);
      toast(prepared.length === 1 ? 'Screenshot attached' : `${prepared.length} screenshots attached`, 'good');
    } catch (e) {
      toast(`Couldn’t attach image: ${String((e as Error).message ?? e)}`, 'bad');
    }
  }, [toast]);

  const removeShot = (id: string) => {
    setShots((prev) => {
      const gone = prev.find((s) => s.id === id);
      if (gone) revokeShot(gone);
      return prev.filter((s) => s.id !== id);
    });
  };

  // Paste screenshots from the clipboard while reviewing a report (Cmd/Ctrl+V).
  useEffect(() => {
    if (!parsed) return;
    const onPaste = (e: globalThis.ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) return;
      const files = [...(e.clipboardData?.files ?? [])].filter(isImageFile);
      if (!files.length) return;
      e.preventDefault();
      void addShots(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [parsed, addShots]);

  const setDecision = (i: number, patch: Partial<Decision>) =>
    setDecisions((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const submit = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const active = decisions.map((d, i) => ({ d, i })).filter(({ d }) => d.mode !== 'skip');
      if (!active.length) { toast('Nothing selected to log', 'bad'); return; }

      // One report record per submitted document, shared by every finding it touched.
      const reportId = nextId(ID_PREFIX.report, data.reports.map((r) => r.id));
      const file = await saveReportBody(reportId, reportMarkdown(parsed, reporter, memberName));
      // Keep the document the analyst actually wrote, not just the parsed text.
      const originalPath = sourceFile ? await upload(sourceFile, 'reports') : null;
      const original = originalPath
        ? [{ type: 'file' as const, title: sourceFile?.name ?? 'Submitted report', description: 'The document submitted through report intake', path: originalPath.replace(/^.*evidence\//, '') }]
        : [];

      // Screenshots: upload when the authoring server is up; otherwise keep an inline data URL.
      const shotEvidence: Evidence[] = [];
      for (const shot of shots) {
        const uploaded = await upload(shot.file, 'screenshots');
        if (uploaded) {
          shotEvidence.push({
            type: 'screenshot',
            title: shot.name,
            description: 'Attached during report intake',
            path: uploaded.replace(/^.*evidence\//, ''),
          });
        } else {
          shotEvidence.push({
            type: 'screenshot',
            title: shot.name,
            description: online ? 'Upload failed — kept inline' : 'Attached during report intake (local draft)',
            url: await fileToDataUrl(shot.file),
          });
        }
      }
      const extras: Evidence[] = [...original, ...shotEvidence];

      const takenIds = data.findings.map((f) => f.id);
      const savedIds: string[] = [];
      let firstFinding: string | undefined;

      for (const { d, i } of active) {
        const candidate = parsed.candidates[i];
        if (d.mode === 'retest' && d.matchId) {
          const existing = index.findingById.get(d.matchId);
          if (!existing) { toast(`${d.matchId} is no longer available`, 'bad'); continue; }
          const match = matches[i].find((m) => m.finding.id === d.matchId);
          const updated = applyRetest(existing, {
            outcome: d.outcome,
            date: d.date,
            by: reporter || undefined,
            note: retestNote(parsed, candidate, d),
            reportId: file ? reportId : undefined,
            confidence: match ? Number(match.score.toFixed(2)) : undefined,
          });
          await save('finding', mergeEvidence(updated, [...(candidate.draft.evidence ?? []), ...extras]));
          firstFinding ??= updated.id;
          savedIds.push(updated.id);
        } else {
          const id = nextId(ID_PREFIX.finding, [...takenIds, ...savedIds]);
          const bundled = [...(candidate.draft.evidence ?? []), ...extras];
          const finding = findingFromDraft(
            {
              ...candidate.draft, title: d.title, severity: d.severity, discovered: d.date,
              reporter: reporter || candidate.draft.reporter,
              evidence: bundled.length ? bundled : undefined,
            },
            id,
            { fileName: parsed.fileName, fileType: parsed.type, importedAt: new Date().toISOString(), extracted: candidate.extracted },
            file ? reportId : undefined,
          );
          if (!file) finding.description = appendSource(finding.description, candidate.body);
          await save('finding', finding);
          firstFinding ??= id;
          savedIds.push(id);
        }
      }

      if (file) {
        const eng = parsed.candidates[active[0].i].draft.engagement;
        const report: Report = {
          id: reportId,
          title: parsed.documentTitle.slice(0, 120),
          date: parsed.date,
          author: reporter || undefined,
          type: REPORT_TYPE[engagementType(eng) ?? ''] ?? 'assessment',
          path: file,
          engagement: eng,
          finding: firstFinding,
          findings: savedIds,
          summary: parsed.candidates.length > 1
            ? `${parsed.candidates.length} findings from one report — ${parsed.candidates.map((c) => c.draft.title).filter(Boolean).slice(0, 4).join('; ')}${parsed.candidates.length > 4 ? '…' : ''}`
            : parsed.candidates[0]?.draft.summary?.slice(0, 400),
          tags: [
            'intake',
            ...(originalPath ? ['original-attached'] : []),
            ...(shotEvidence.length ? ['screenshots'] : []),
            ...(savedIds.length > 1 ? ['multi-finding'] : []),
          ],
          intake: { fileName: parsed.fileName, fileType: parsed.type, importedAt: new Date().toISOString() },
        };
        await save('report', report);
      }

      const retested = active.filter(({ d }) => d.mode === 'retest').length;
      const created = active.length - retested;
          toast(
        [created && `logged ${created} new finding${created > 1 ? 's' : ''}`, retested && `recorded ${retested} re-test${retested > 1 ? 's' : ''}`, shotEvidence.length && `${shotEvidence.length} screenshot${shotEvidence.length > 1 ? 's' : ''}`]
          .filter(Boolean).join(' · ')
          .replace(/^./, (c) => c.toUpperCase()) + (file ? ` · report ${reportId}` : ''),
        'good',
      );
      reset();
      nav(savedIds.length === 1 && firstFinding ? `/findings/${firstFinding}` : '/findings');
    } finally { setSaving(false); }
  };

  const dropHandlers = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void onFile(file);
    },
  };

  const summary = useMemo(() => {
    const retests = decisions.filter((d) => d.mode === 'retest').length;
    const news = decisions.filter((d) => d.mode === 'new').length;
    return { retests, news };
  }, [decisions]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Report intake"
        title="Log a report"
        sub="Drop the report you wrote — text, markdown, PDF or Word — and the dashboard reads the finding out of it. Re-tests of something already logged are recognised and folded into the original finding."
        actions={parsed ? <Button icon="x" variant="ghost" onClick={reset}>Start over</Button> : undefined}
      />

      {!parsed && (
        <>
          <div
            className={`dropzone${dragging ? ' dropzone--over' : ''}`}
            {...dropHandlers}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click(); }}
          >
            <Icon name={reading ? 'hourglass' : 'inbox'} size={34} strokeWidth={1.3} />
            <div className="dropzone__title">{reading ? 'Reading the report…' : 'Drop your report here'}</div>
            <div className="text-sm muted">or click to choose a file — <span className="mono">.md</span> <span className="mono">.txt</span> <span className="mono">.pdf</span> <span className="mono">.docx</span></div>
            <div className="text-xs muted mt-8">Everything is read in your browser; the document is only stored if you log it.</div>
            <input ref={fileInput} type="file" accept={ACCEPT_ATTR} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
          </div>

          <div className="row row--between mt-16 mb-8">
            <button className="btn btn--ghost btn--sm" onClick={() => setPasting((p) => !p)}>
              <Icon name={pasting ? 'chevron-down' : 'chevron-right'} size={14} />Paste the text instead
            </button>
            <span className="text-xs muted">Or keep using the <a href="/findings">manual form</a> when you prefer.</span>
          </div>
          {pasting && (
            <Card className="card--pad">
              <Field label="Paste the report" help="Anything goes — a full write-up, an email, or a few lines of notes.">
                <textarea className="textarea" style={{ minHeight: 200 }} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'Title: Reentrancy in Vault.withdraw()\nSeverity: Critical\nCVSS: 9.1\nCWE-841\n\nSummary: ...'} />
              </Field>
              <div className="row row--end mt-12">
                <Button variant="primary" icon="check" disabled={pasteText.trim().length < 20}
                  onClick={() => ingest(pasteText, { type: 'paste' })}>Read this report</Button>
              </div>
            </Card>
          )}
        </>
      )}

      {parsed && (
        <>
          <Card className="card--pad mb-16" accent>
            <div className="row row--between row--wrap gap-8">
              <div className="row gap-12">
                <span className="list__icon"><Icon name="file" size={16} /></span>
                <div>
                  <div className="list__title">{parsed.documentTitle}</div>
                  <div className="text-xs muted">
                    {parsed.fileName ? <span className="mono">{parsed.fileName}</span> : 'Pasted text'} · {fmtDate(parsed.date)} · {parsed.candidates.length === 1 ? '1 finding' : `${parsed.candidates.length} findings`} read
                  </div>
                </div>
              </div>
              <Field label="Logged by">
                <select className="select select--sm" value={reporter} onChange={(e) => setReporter(e.target.value)} style={{ minWidth: 170 }}>
                  <option value="">— not recorded —</option>
                  {data.org.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
            </div>
            {parsed.warnings.map((w, i) => <div key={i} className="text-sm mt-8 row gap-8" style={{ color: 'var(--warn)' }}><Icon name="alert" size={13} />{w}</div>)}
            {!online && <div className="text-sm mt-8 row gap-8 muted"><Icon name="alert" size={13} />The authoring server isn’t running, so this is saved as a local draft and the original document isn’t archived.</div>}
          </Card>

          <Card className="card--pad mb-16">
            <div className="row row--between row--wrap gap-8 mb-12">
              <div>
                <div className="list__title row gap-8"><Icon name="eye" size={15} />Screenshots</div>
                <div className="text-xs muted mt-4">Drop images here, click to browse, or paste (⌘V / Ctrl+V). Attached to every finding you log from this report.</div>
              </div>
              <Button size="sm" variant="ghost" icon="download" onClick={() => shotInput.current?.click()}>Add images</Button>
              <input
                ref={shotInput}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                hidden
                onChange={(e) => { const list = [...(e.target.files ?? [])]; if (list.length) void addShots(list); e.target.value = ''; }}
              />
            </div>
            <div
              className={`shots${shotDragging ? ' shots--over' : ''}${shots.length ? ' shots--filled' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setShotDragging(true); }}
              onDragLeave={() => setShotDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setShotDragging(false);
                const list = [...(e.dataTransfer.files ?? [])];
                if (list.length) void addShots(list);
              }}
              onClick={() => { if (!shots.length) shotInput.current?.click(); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') shotInput.current?.click(); }}
            >
              {shots.length ? (
                <div className="shots__grid" onClick={(e) => e.stopPropagation()}>
                  {shots.map((s) => (
                    <figure key={s.id} className="shots__item">
                      <img src={s.preview} alt={s.name} />
                      <figcaption className="truncate" title={s.name}>{s.name}</figcaption>
                      <button type="button" className="shots__x" aria-label={`Remove ${s.name}`} onClick={() => removeShot(s.id)}>
                        <Icon name="x" size={12} />
                      </button>
                    </figure>
                  ))}
                  <button type="button" className="shots__add" onClick={() => shotInput.current?.click()}>
                    <Icon name="plus" size={16} />Add more
                  </button>
                </div>
              ) : (
                <div className="shots__empty">
                  <Icon name="eye" size={22} strokeWidth={1.4} />
                  <span>Drop proof screenshots here</span>
                </div>
              )}
            </div>
          </Card>

          <div className="col gap-16">
            {parsed.candidates.map((candidate, i) => (
              <CandidateCard
                key={i}
                idx={i}
                candidate={candidate}
                decision={decisions[i]}
                matches={matches[i]}
                findingById={index.findingById}
                expanded={expanded === i}
                onToggle={() => setExpanded(expanded === i ? null : i)}
                onChange={(patch) => setDecision(i, patch)}
                onFullForm={() => setFullForm({ ...candidate.draft, reporter: reporter || candidate.draft.reporter })}
              />
            ))}
          </div>

          <div className="row row--between row--wrap gap-8 mt-16">
            <span className="text-sm muted">
              {summary.news ? `${summary.news} new finding${summary.news > 1 ? 's' : ''}` : 'No new findings'}
              {summary.retests ? ` · ${summary.retests} re-test${summary.retests > 1 ? 's' : ''} folded into existing findings` : ''}
            </span>
            <div className="row gap-8">
              <Button variant="ghost" onClick={reset}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={saving || decisions.every((d) => d.mode === 'skip')} onClick={submit}>
                {saving ? 'Logging…' : 'Log this report'}
              </Button>
            </div>
          </div>
        </>
      )}

      {fullForm && <FindingForm initial={fullForm} onClose={() => setFullForm(null)} onSaved={(f) => { reset(); nav(`/findings/${f.id}`); }} />}
    </div>
  );
}

// --------------------------------------------------------------- candidate card

function CandidateCard({ idx, candidate, decision, matches, findingById, expanded, onToggle, onChange, onFullForm }: {
  idx: number;
  candidate: Candidate;
  decision: Decision;
  matches: FindingMatch[];
  findingById: Map<string, Finding>;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Decision>) => void;
  onFullForm: () => void;
}) {
  const suggested = matches[0];
  const draft = candidate.draft;
  const target = decision.matchId ? findingById.get(decision.matchId) : undefined;

  return (
    <Card
      title={<span className="row gap-8"><SeverityBadge severity={decision.severity} size="sm" />{decision.mode === 'retest' ? 'Re-test' : 'New finding'}</span>}
      sub={decision.mode === 'retest' && target ? `Folds into ${target.id} — ${target.title}` : 'Logged as a new entry in the findings register'}
      actions={<Button size="sm" variant="ghost" icon={expanded ? 'chevron-down' : 'chevron-right'} onClick={onToggle}>{expanded ? 'Hide' : 'Details'}</Button>}
    >
      <div className="form-grid form-grid--3">
        <Field label="Title"><input className="input" value={decision.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
        <Field label="Severity">
          <select className="select" value={decision.severity} onChange={(e) => onChange({ severity: e.target.value as Severity })}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label={decision.mode === 'retest' ? 'Re-tested on' : 'Discovered'}>
          <input className="input" type="date" value={decision.date} onChange={(e) => onChange({ date: e.target.value })} />
        </Field>
      </div>

      <div className="chips mt-12">
        {candidate.extracted.map((f) => <span key={f} className="chip"><Icon name="check" size={11} />{f}</span>)}
        {!candidate.extracted.length && <span className="text-xs muted">Only a title and summary could be read — fill in the rest after logging.</span>}
      </div>

      <div className="intel mt-12">
        <div className="row gap-8 mb-8">
          <Icon name="sparkle" size={15} style={{ color: 'var(--accent-strong)' }} />
          <b className="text-sm">What this looks like</b>
          {suggested && <Badge tone={suggested.score >= MATCH_THRESHOLD ? 'accent' : 'neutral'} size="sm">{Math.round(suggested.score * 100)}% match to {suggested.finding.id}</Badge>}
          {candidate.retest.outcome && <Badge tone={candidate.retest.outcome === 'resolved' ? 'good' : 'warn'} size="sm">{OUTCOME_LABEL[candidate.retest.outcome]}</Badge>}
        </div>

        {suggested ? (
          <div className="col gap-8">
            {matches.slice(0, 3).map((m) => (
              <label key={m.finding.id} className={`intel__option${decision.mode === 'retest' && decision.matchId === m.finding.id ? ' intel__option--on' : ''}`}>
                <input type="radio" name={`match-${idx}`} checked={decision.mode === 'retest' && decision.matchId === m.finding.id}
                  onChange={() => onChange({ mode: 'retest', matchId: m.finding.id })} />
                <div className="flex-1">
                  <div className="row gap-8 row--wrap">
                    <b className="text-sm">{m.finding.id}</b>
                    <span className="text-sm truncate">{m.finding.title}</span>
                    <Badge tone="neutral" size="sm">{STATUS_LABEL[m.finding.status]}</Badge>
                    <span className="text-xs muted">last touched {fmtDate(m.finding.lastActivity ?? m.finding.discovered)}</span>
                  </div>
                  <div className="text-xs muted mt-4">{m.reasons.join(' · ')}</div>
                </div>
              </label>
            ))}
            <label className={`intel__option${decision.mode === 'new' ? ' intel__option--on' : ''}`}>
              <input type="radio" name={`match-${idx}`} checked={decision.mode === 'new'} onChange={() => onChange({ mode: 'new', matchId: undefined })} />
              <div className="flex-1"><b className="text-sm">This is a different issue</b><div className="text-xs muted mt-4">Log it as a brand-new finding.</div></div>
            </label>
          </div>
        ) : (
          <div className="text-sm muted">Nothing already logged looks like this — it will be logged as a new finding.</div>
        )}

        {decision.mode === 'retest' && target && (
          <div className="mt-12">
            <div className="form-grid">
              <Field label="Re-test result" help="What the report says about the issue this time.">
                <select className="select" value={decision.outcome} onChange={(e) => onChange({ outcome: e.target.value as RetestOutcome })}>
                  {RETEST_OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
                </select>
              </Field>
              <div className="field">
                <span className="field__label">What will change</span>
                <div className="text-sm">{outcomePreview(target, decision)}</div>
              </div>
            </div>
            {candidate.retest.evidence && <div className="text-xs muted mt-8">Read from the report: “{candidate.retest.evidence}”</div>}
          </div>
        )}
      </div>

      {expanded && (
        <div className="form-section">
          <div className="form-section__title">What the parser read</div>
          <dl className="detail-key">
            <dt>Summary</dt><dd>{draft.summary}</dd>
            {draft.cvss && <><dt>CVSS</dt><dd className="mono">{draft.cvss.score}{draft.cvss.vector ? ` · ${draft.cvss.vector}` : ''}</dd></>}
            {draft.cwe?.length ? <><dt>CWE</dt><dd className="mono">{draft.cwe.join(', ')}</dd></> : null}
            {draft.affected && <><dt>Affected</dt><dd className="mono">{Object.entries(draft.affected).map(([k, v]) => `${k}: ${v}`).join(' · ')}</dd></>}
            {draft.stepsToReproduce?.length ? <><dt>Steps</dt><dd>{draft.stepsToReproduce.length} step(s) read</dd></> : null}
            {draft.remediation && <><dt>Remediation</dt><dd>{draft.remediation.recommendation.slice(0, 240)}</dd></>}
            {draft.references?.length ? <><dt>References</dt><dd>{draft.references.length} link(s)</dd></> : null}
            {draft.evidence?.length ? <><dt>Evidence</dt><dd>{draft.evidence.length} code / request block(s)</dd></> : null}
          </dl>
          <div className="row gap-8 mt-12">
            {decision.mode === 'new' && <Button size="sm" icon="edit" onClick={onFullForm}>Open the full form</Button>}
            <Button size="sm" variant="ghost" icon={decision.mode === 'skip' ? 'plus' : 'trash'}
              onClick={() => onChange({ mode: decision.mode === 'skip' ? 'new' : 'skip' })}>
              {decision.mode === 'skip' ? 'Include again' : 'Skip this one'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// -------------------------------------------------------------------- helpers

function defaultDecision(candidate: Candidate, matches: FindingMatch[]): Decision {
  const best = matches[0];
  const isRetest = !!best && best.score >= MATCH_THRESHOLD;
  const status = candidate.draft.status;
  const outcome: RetestOutcome = candidate.retest.outcome
    ?? (status === 'fixed' || status === 'verified' ? 'resolved' : 'still-present');
  return {
    mode: isRetest ? 'retest' : 'new',
    matchId: isRetest ? best.finding.id : undefined,
    outcome,
    title: candidate.draft.title,
    severity: candidate.draft.severity,
    // The parser falls back to today, so this is "the day the work happened".
    date: candidate.draft.discovered,
  };
}

function outcomePreview(target: Finding, d: Decision): string {
  const when = fmtDate(d.date);
  switch (d.outcome) {
    case 'resolved':
      return `${target.id} becomes Verified (fix confirmed ${when}), and a re-test is logged on ${when}.`;
    case 'still-present':
      return target.status === 'fixed' || target.status === 'verified'
        ? `${target.id} is re-opened, and a re-test is logged on ${when}.`
        : `${target.id} stays ${STATUS_LABEL[target.status]}, with a re-test logged on ${when}.`;
    case 'partially-fixed':
      return `${target.id} moves to In remediation, with a re-test logged on ${when}.`;
    default:
      return `A re-test is logged on ${when}; ${target.id} keeps its current status.`;
  }
}

function retestNote(parsed: ParsedReport, candidate: Candidate, d: Decision): string {
  const source = parsed.fileName ? `“${parsed.fileName}”` : 'a pasted report';
  const detail = candidate.retest.evidence ? ` — the report says: “${candidate.retest.evidence}”` : '';
  return `${OUTCOME_LABEL[d.outcome]} on re-test from ${source}${detail}`;
}

/** Keep evidence gathered by the new report alongside the original finding's. */
function mergeEvidence(finding: Finding, fresh: Evidence[]): Finding {
  if (!fresh.length) return finding;
  const seen = new Set((finding.evidence ?? []).map((e) => (e.content ?? e.path ?? e.url ?? '').slice(0, 120)));
  const add = fresh.filter((e) => !seen.has((e.content ?? e.path ?? e.url ?? '').slice(0, 120)));
  return add.length ? { ...finding, evidence: [...(finding.evidence ?? []), ...add] } : finding;
}

function appendSource(description: string | undefined, body: string): string {
  const quoted = body.trim().slice(0, 6000);
  return `${description ? `${description}\n\n` : ''}## Submitted report\n\n${quoted}`;
}

/** The markdown archived under content/reports for the submitted document. */
function reportMarkdown(parsed: ParsedReport, reporter: string, memberName: (id?: string) => string): string {
  const head = [
    `# ${parsed.documentTitle}`,
    '',
    `*Logged through report intake on ${fmtDate(todayISO())}${reporter ? ` by ${memberName(reporter)}` : ''}*`,
    parsed.fileName ? `*Source document: ${parsed.fileName}*` : '*Source: pasted text*',
    '',
    '---',
    '',
  ].join('\n');
  return head + parsed.body;
}
