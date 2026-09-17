import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/data/store';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { Slide } from './present/Slides';
import { autoDeck, SLIDE_TITLES } from './present/buildDeck';
import type { Deck } from '@/types';

export function Present() {
  const { data } = useStore();
  const nav = useNavigate();
  const decks = useMemo<Deck[]>(() => [autoDeck(data), ...data.decks], [data]);
  const [deckId, setDeckId] = useState(decks[0]?.id ?? 'auto');
  const deck = decks.find((d) => d.id === deckId) ?? decks[0];
  const [idx, setIdx] = useState(0);
  const [overview, setOverview] = useState(false);
  const [notes, setNotes] = useState(false);
  const total = deck.slides.length;
  const cur = deck.slides[idx];

  const go = useCallback((n: number) => setIdx(() => Math.max(0, Math.min(total - 1, n))), [total]);
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); nav('/'); }, [nav]);

  useEffect(() => { setIdx(0); }, [deckId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(idx + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(total - 1);
      else if (e.key === 'Escape') { if (overview) setOverview(false); else exit(); }
      else if (e.key === 'o' || e.key === 'g') setOverview((o) => !o);
      else if (e.key === 'n' || e.key === 's') setNotes((n) => !n);
      else if (e.key === 'f') toggleFs();
      else if (/^[1-9]$/.test(e.key)) go(Number(e.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, total, go, exit, overview]);

  const toggleFs = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen().catch(() => {}); };

  return (
    <div className="deck">
      <div className="deck__stage">
        <Slide spec={cur} data={data} active={!overview} />
      </div>

      <div className="slide__progress" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      <div className="slide__foot">
        <div className="row gap-8">
          <button className="btn btn--ghost btn--sm" onClick={exit}><Icon name="x" size={14} />Exit</button>
          {decks.length > 1 && (
            <select className="select select--sm" value={deckId} onChange={(e) => setDeckId(e.target.value)} style={{ minWidth: 160 }}>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.id === 'auto' ? '⚡ Auto deck (live)' : d.title}</option>)}
            </select>
          )}
        </div>
        <div className="row gap-8" style={{ fontSize: 12 }}>
          <span className="upper muted">{SLIDE_TITLES[cur.kind] ?? cur.kind}</span>
        </div>
        <div className="deck__controls">
          <button className="btn btn--ghost btn--sm" onClick={() => setNotes((n) => !n)} title="Presenter notes (n)"><Icon name="file" size={14} /></button>
          <button className="btn btn--ghost btn--sm" onClick={() => setOverview((o) => !o)} title="Overview (o)"><Icon name="grid" size={14} /></button>
          <button className="btn btn--ghost btn--sm" onClick={toggleFs} title="Fullscreen (f)"><Icon name="external" size={14} /></button>
          <div className="btn-group">
            <button className="btn btn--sm" onClick={() => go(idx - 1)} disabled={idx === 0}><Icon name="chevron-left" size={15} /></button>
            <button className="btn btn--sm num" style={{ minWidth: 62 }}>{idx + 1} / {total}</button>
            <button className="btn btn--sm" onClick={() => go(idx + 1)} disabled={idx === total - 1}><Icon name="chevron-right" size={15} /></button>
          </div>
        </div>
      </div>

      {notes && (
        <div className="deck__notes">
          <div className="row row--between mb-8"><h4 className="upper">Presenter notes</h4><Icon name="x" size={14} className="clickable" onClick={() => setNotes(false)} /></div>
          <div className="text-sm">{cur.notes ?? <span className="muted">No notes for this slide. Next: {deck.slides[idx + 1] ? (SLIDE_TITLES[deck.slides[idx + 1].kind] ?? deck.slides[idx + 1].kind) : 'end'}.</span>}</div>
          <div className="text-xs muted mt-12" style={{ borderTop: '1px solid var(--line-1)', paddingTop: 8 }}>
            <b>Keys:</b> <span className="kbd">→</span> next · <span className="kbd">←</span> back · <span className="kbd">o</span> overview · <span className="kbd">f</span> fullscreen · <span className="kbd">n</span> notes · <span className="kbd">esc</span> exit
          </div>
        </div>
      )}

      {overview && (
        <div className="deck__overview" onClick={() => setOverview(false)}>
          <div className="row row--between mb-16" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: 'var(--ink-1)' }}>{deck.title} — {total} slides</h2>
            <Button icon="x" variant="ghost" onClick={() => setOverview(false)} />
          </div>
          <div className="deck__thumbs" onClick={(e) => e.stopPropagation()}>
            {deck.slides.map((s, i) => (
              <button key={i} className={`deck__thumb${i === idx ? ' deck__thumb--active' : ''}`} onClick={() => { go(i); setOverview(false); }}>
                <span className="text-xs muted num">{i + 1}</span>
                <b>{SLIDE_TITLES[s.kind] ?? s.kind}</b>
                {s.ref && <span className="text-xs muted truncate">{data.findings.find((f) => f.id === s.ref)?.title ?? s.ref}</span>}
                {s.kind === 'simulation' && <span className="badge badge--crit badge--sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}><Icon name="crosshair" size={11} />Attack</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
