import { Link } from 'react-router-dom';
import type { Finding } from '@/types';
import { SeverityBadge, Badge } from './ui';
import { Icon } from './Icon';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/severity';
import { fmtDate } from '@/lib/format';
import { isOverdue, dueDate } from '@/lib/metrics';
import { lastActivity } from '@/lib/activity';
import { useStore } from '@/data/store';

export function FindingListItem({ f }: { f: Finding }) {
  const { memberName, isDraft } = useStore();
  const overdue = isOverdue(f);
  return (
    <Link to={`/findings/${f.id}`} className="list__item list__item--link">
      <span className="list__icon" style={{ background: `var(--sev-${f.severity}-soft)`, color: `var(--sev-${f.severity})` }}>
        <Icon name={f.source === 'soc-bot' ? 'robot' : 'bug'} size={16} />
      </span>
      <div className="list__body">
        <div className="list__title row gap-8">{f.title}{isDraft('finding', f.id) && <span className="draft-tag">draft</span>}</div>
        <div className="list__meta">
          <span className="mono">{f.id}</span>
          <Badge tone={STATUS_TONE[f.status]} size="sm">{STATUS_LABEL[f.status]}</Badge>
          {f.cvss && <span className="cvss">CVSS {f.cvss.score}</span>}
          {f.assignee && <span className="row gap-4"><Icon name="users" size={11} />{memberName(f.assignee)}</span>}
          {overdue && <Badge tone="crit" size="sm">Overdue</Badge>}
        </div>
      </div>
      <div className="list__aside">
        <SeverityBadge severity={f.severity} size="sm" />
        <div className="text-xs muted mt-4">{fmtDate(f.discovered)}</div>
      </div>
    </Link>
  );
}

export function FindingTableRow({ f, onNav }: { f: Finding; onNav?: () => void }) {
  const { memberName } = useStore();
  const overdue = isOverdue(f);
  const retests = f.retests?.length ?? 0;
  const touched = lastActivity(f);
  return (
    <tr className="row--link" onClick={onNav}>
      <td><SeverityBadge severity={f.severity} size="sm" /></td>
      <td>
        <div className="table__title">{f.title}</div>
        <div className="table__sub mono">{f.id}{f.cwe?.length ? ` · ${f.cwe[0]}` : ''}</div>
      </td>
      <td>
        <Badge tone={STATUS_TONE[f.status]} size="sm">{STATUS_LABEL[f.status]}</Badge>
        {retests > 0 && <div className="table__sub row gap-4" title={`Re-tested ${retests}×, last on ${fmtDate(f.retests![retests - 1].date)}`}><Icon name="repeat" size={11} />{retests}×</div>}
      </td>
      <td className="nowrap">
        {fmtDate(f.discovered, { day: 'numeric', month: 'short', year: '2-digit' })}
        {touched !== f.discovered && <div className="table__sub">active {fmtDate(touched, { day: 'numeric', month: 'short' })}</div>}
      </td>
      <td className="num">{f.cvss?.score ?? '—'}</td>
      <td>{f.assignee ? memberName(f.assignee) : <span className="muted">—</span>}</td>
      <td className="nowrap" style={{ color: overdue ? 'var(--crit)' : undefined }}>{fmtDate(dueDate(f), { day: 'numeric', month: 'short' })}</td>
    </tr>
  );
}
