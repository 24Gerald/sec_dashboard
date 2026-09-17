import { useState } from 'react';
import type { Evidence } from '@/types';
import { highlight } from '@/lib/highlight';
import { Icon } from './Icon';
import { useStore } from '@/data/store';
import { Badge } from './ui';

/** Syntax-highlighted code block with optional line highlighting. */
export function CodeBlock({ code, language, file, lines, highlight: hl, title, fix }: { code: string; language?: string; file?: string; lines?: [number, number]; highlight?: number[]; title?: string; fix?: number[] }) {
  const start = lines?.[0] ?? 1;
  const rows = code.replace(/\n$/, '').split('\n');
  const hlSet = new Set(hl ?? []);
  const fixSet = new Set(fix ?? []);
  return (
    <div className="code">
      <div className="code__head">
        <Icon name="code" size={13} />
        {file ? <span className="mono">{file}{lines && `:${lines[0]}-${lines[1]}`}</span> : <span>{title ?? language ?? 'code'}</span>}
        {language && <Badge tone="neutral" size="sm">{language}</Badge>}
      </div>
      <div className="code__body">
        {rows.map((line, i) => {
          const ln = start + i;
          const cls = hlSet.has(ln) ? ' code__line--hl' : fixSet.has(ln) ? ' code__line--fix' : '';
          return (
            <div key={i} className={`code__line${cls}`}>
              <span className="code__gutter">{ln}</span>
              <span className="code__text" dangerouslySetInnerHTML={{ __html: highlight(line || ' ', language ?? '') }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EvidenceViewer({ items }: { items: Evidence[] }) {
  const { data } = useStore();
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <div className="evidence">
      {items.map((ev, i) => {
        // Prefer the bundled/uploaded path; fall back to an inline url (clipboard / offline drafts).
        const url = (ev.path && data.evidence[ev.path]) || (ev.type === 'screenshot' ? ev.url : undefined);
        return (
          <div className="evidence__item" key={i}>
            <div className="evidence__head">
              <Icon name={evIcon(ev.type)} size={14} />
              <b>{ev.title ?? evLabel(ev.type)}</b>
              <Badge tone="neutral" size="sm">{ev.type}</Badge>
            </div>
            <div className="evidence__body">
              {(ev.type === 'code' || ev.type === 'request' || ev.type === 'response' || ev.type === 'log' || ev.type === 'poc' || ev.type === 'transaction') && ev.content && (
                <CodeBlock code={ev.content} language={ev.language ?? (ev.type === 'request' || ev.type === 'response' ? 'http' : ev.type === 'log' ? 'bash' : undefined)} file={ev.file} lines={ev.lines} highlight={ev.highlight} />
              )}
              {ev.type === 'screenshot' && url && <img className="evidence__img" src={url} alt={ev.title ?? 'screenshot'} onClick={() => setZoom(url)} loading="lazy" />}
              {ev.type === 'screenshot' && !url && <div className="evidence__caption"><Icon name="eye" size={13} /> Screenshot: <span className="mono">{ev.path ?? 'missing'}</span> {ev.description}</div>}
              {ev.type === 'link' && ev.url && <div className="evidence__caption"><a href={ev.url} target="_blank" rel="noreferrer"><Icon name="external" size={12} /> {ev.url}</a></div>}
              {ev.txHash && <div className="evidence__caption mono">tx: {ev.txHash} {ev.chain && <Badge tone="neutral" size="sm">{ev.chain}</Badge>}</div>}
              {ev.description && ev.type !== 'screenshot' && <div className="evidence__caption">{ev.description}</div>}
              {ev.description && ev.type === 'screenshot' && url && <div className="evidence__caption">{ev.description}</div>}
            </div>
          </div>
        );
      })}
      {zoom && <div className="lightbox" onClick={() => setZoom(null)}><img src={zoom} alt="evidence" /></div>}
    </div>
  );
}

function evIcon(t: Evidence['type']): string {
  return { screenshot: 'eye', code: 'code', request: 'arrow-right', response: 'arrow-down', log: 'list', file: 'file', link: 'external', poc: 'zap', transaction: 'coins', note: 'edit' }[t] ?? 'file';
}
function evLabel(t: Evidence['type']): string {
  return { screenshot: 'Screenshot', code: 'Code', request: 'Request', response: 'Response', log: 'Log', file: 'File', link: 'Reference', poc: 'Proof of concept', transaction: 'Transaction', note: 'Note' }[t] ?? 'Evidence';
}
