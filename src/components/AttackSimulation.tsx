import { useEffect, useMemo, useRef, useState } from 'react';
import type { Finding } from '@/types';
import { simulate } from '@/sim/engine';
import type { Simulation } from '@/sim/types';
import { AttackFlow } from './AttackFlow';
import { DamagePanel } from './DamagePanel';
import { Icon } from './Icon';
import { Badge, Button, ConfBar } from './ui';
import { SEVERITY_LABEL } from '@/lib/severity';

export function useSimulation(finding: Finding, engagementType?: string): Simulation {
  return useMemo(() => simulate(finding, engagementType), [finding, engagementType]);
}

interface Props {
  finding: Finding;
  engagementType?: string;
  /** stacked = narration under the canvas (narrow contexts) */
  layout?: 'split' | 'stacked';
  autoPlay?: boolean;
  present?: boolean;
  /** hide the header row (used in presentation where the slide has its own title) */
  hideHeader?: boolean;
  onStageChange?: (stage: number, total: number) => void;
}

const STAGE_MS = 3600;

/** The auto-generated attack simulation: animated kill-chain + plain-English narration + damage model. */
export function AttackSimulation({ finding, engagementType, layout = 'split', autoPlay = false, present = false, hideHeader = false, onStageChange }: Props) {
  const sim = useSimulation(finding, engagementType);
  const total = sim.stages.length;
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { setStage(0); setPlaying(autoPlay); }, [finding.id, autoPlay]);
  useEffect(() => { onStageChange?.(stage, total); }, [stage, total, onStageChange]);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setTimeout(() => {
      setStage((s) => {
        if (s >= total - 1) { setPlaying(false); return s; }
        return s + 1;
      });
    }, STAGE_MS);
    return () => window.clearTimeout(timer.current);
  }, [playing, stage, total]);

  const cur = sim.stages[stage];
  const atEnd = stage >= total - 1;

  const next = () => { setPlaying(false); setStage((s) => Math.min(total - 1, s + 1)); };
  const prev = () => { setPlaying(false); setStage((s) => Math.max(0, s - 1)); };
  const replay = () => { setStage(0); setPlaying(true); };
  const toggle = () => { if (atEnd && !playing) replay(); else setPlaying((p) => !p); };

  return (
    <div className={`sim${present ? ' sim--present' : ''}`}>
      {!hideHeader && (
        <div className="sim__head">
          <div className="sim__title">
            <Icon name="crosshair" size={18} style={{ color: 'var(--attacker)' }} />
            Attack simulation
            <Badge tone={finding.severity} dot size="sm">{SEVERITY_LABEL[finding.severity]}</Badge>
            <Badge tone="neutral" size="sm">{sim.classLabel}</Badge>
          </div>
          <div className="sim__controls">
            <span className="hide-mobile"><ConfBar value={sim.confidence} /></span>
            <div className="btn-group">
              <Button icon="chevron-left" size="sm" onClick={prev} disabled={stage === 0} aria-label="Previous stage" />
              <Button size="sm" onClick={toggle} icon={playing ? 'pause' : atEnd ? 'refresh' : 'play'}>{playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}</Button>
              <Button icon="chevron-right" size="sm" onClick={next} disabled={atEnd} aria-label="Next stage" />
            </div>
          </div>
        </div>
      )}

      <div className="sim__analogy">
        <Icon name="sparkle" size={16} style={{ color: 'var(--accent)', flex: '0 0 auto', marginTop: 2 }} />
        <div><b>In plain terms:</b> {sim.headline} {sim.analogy}</div>
      </div>

      <div className={`sim__body${layout === 'stacked' ? ' sim__body--stacked' : ''}`}>
        <div>
          <div className="sim__canvas">
            <AttackFlow sim={sim} stage={stage} compact={layout === 'stacked'} />
          </div>
          <div className="sim__stepper">
            {sim.stages.map((s, i) => (
              <button key={i} className={`sim__step${i <= stage ? ' sim__step--done' : ''}`} onClick={() => { setPlaying(false); setStage(i); }} title={`${s.phase}: ${s.title}`} aria-label={`Stage ${i + 1}: ${s.phase}`}>
                <span style={{ width: i < stage ? '100%' : i === stage ? '100%' : '0%', transition: i === stage && playing ? `width ${STAGE_MS}ms linear` : 'width .3s' }} />
              </button>
            ))}
          </div>
        </div>

        <div className="sim__side">
          <div className="sim__narr">
            <div className="sim__stage-label">
              <span>{cur.phase}</span>
              <span className="muted">· step {stage + 1} of {total}</span>
            </div>
            <div className="sim__stage-title">{cur.title}</div>
            <div className="sim__stage-text" dangerouslySetInnerHTML={{ __html: emphasise(cur.narrative) }} />
            {cur.technique && (
              <div className="sim__tech">
                <span className="upper">How it's done</span>
                {cur.technique}{cur.mitre && cur.mitre !== 'n/a' && <> <Badge tone="outline" size="sm">{cur.mitre}</Badge></>}
              </div>
            )}
            {cur.defence && (
              <div className="sim__defend">
                <b><Icon name="shield-check" size={13} style={{ verticalAlign: -2 }} /> Defence:</b> {cur.defence}
              </div>
            )}
          </div>
          <DamagePanel sim={sim} revealed={stage > 0 || total === 1} />
        </div>
      </div>

      {atEnd && (
        <div className="sim__verdict">
          <div>
            <div className="verdict-score" style={{ color: sim.impactScore >= 70 ? 'var(--crit)' : sim.impactScore >= 45 ? 'var(--serious)' : 'var(--warn)' }}>{sim.impactScore}<small>/100</small></div>
            <div className="text-xs muted">Impact score</div>
          </div>
          <div className="flex-1" style={{ minWidth: 200 }}>
            <div className="text-sm"><b>Blast radius:</b> {sim.blastRadius}</div>
            <div className="text-sm mt-4 row gap-4" style={{ color: 'var(--accent-strong)' }}><Icon name="key" size={14} /> <span><b>Key control:</b> {sim.keyControl}</span></div>
          </div>
          <div className="col gap-4" style={{ minWidth: 160 }}>
            <span className="upper muted">Who's affected</span>
            {sim.affects.slice(0, 3).map((a, i) => <span key={i} className="text-xs row gap-4"><Icon name="chevron-right" size={11} style={{ color: 'var(--attacker)' }} />{a}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Bold key nouns already wrapped in **…** by the templates (safe: no user HTML). */
function emphasise(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
