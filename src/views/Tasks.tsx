import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Empty, Segmented, Stat, Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SearchInput } from '@/components/Filters';
import type { Task, TaskStatus } from '@/types';
import { TASK_STATUSES } from '@/types';
import { TASK_STATUS_LABEL, PRIORITY_LABEL } from '@/lib/severity';
import { fmtDate, plural } from '@/lib/format';

const COLS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' }, { status: 'todo', label: 'To do' }, { status: 'in-progress', label: 'In progress' },
  { status: 'review', label: 'Review' }, { status: 'blocked', label: 'Blocked' }, { status: 'done', label: 'Done' },
];

export function TasksView() {
  const { data, save, toast, memberName } = useStore();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<TaskStatus | null>(null);

  const tasks = useMemo(() => {
    let l = data.tasks;
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter((t) => (t.title + (t.description ?? '') + (t.tags ?? []).join(' ')).toLowerCase().includes(s)); }
    return l;
  }, [data.tasks, q]);

  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);
  const active = data.tasks.filter((t) => t.status !== 'done').length;
  const blocked = data.tasks.filter((t) => t.status === 'blocked').length;
  const done = data.tasks.filter((t) => t.status === 'done').length;

  const move = async (t: Task, status: TaskStatus) => {
    if (t.status === status) return;
    await save('task', { ...t, status, ...(status === 'done' ? { completed: t.completed ?? new Date().toISOString().slice(0, 10) } : {}) });
    toast(`Moved to ${TASK_STATUS_LABEL[status]}`, 'good');
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Operations" title="Tasks & work" sub="What the team is working on — remediation, follow-ups and internal projects. Drag cards to update status."
        actions={<Segmented value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'list', label: 'List' }]} />} />

      <div className="grid grid--4 mb-16">
        <Stat label="Active tasks" value={active} icon="kanban" />
        <Stat label="In progress" value={byStatus('in-progress').length} tone="accent" icon="activity" />
        <Stat label="Blocked" value={blocked} tone={blocked ? 'high' : undefined} icon="alert" />
        <Stat label="Completed" value={done} tone="good" icon="check" />
      </div>

      <div className="toolbar"><SearchInput value={q} onChange={setQ} placeholder="Search tasks…" /><div className="toolbar__spacer" /><span className="toolbar__count">{plural(tasks.length, 'task')}</span></div>

      {view === 'board' ? (
        <div className="kanban">
          {COLS.map((col) => {
            const items = byStatus(col.status);
            return (
              <div key={col.status} className="kanban__col">
                <div className="kanban__head"><span>{col.label}</span><span className="nav__count">{items.length}</span></div>
                <div className={`kanban__body${dropCol === col.status ? ' drop-target' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDropCol(col.status); }}
                  onDragLeave={() => setDropCol((c) => (c === col.status ? null : c))}
                  onDrop={() => { const t = data.tasks.find((x) => x.id === dragId); if (t) move(t, col.status); setDragId(null); setDropCol(null); }}>
                  {items.map((t) => (
                    <div key={t.id} className={`kanban__card${dragId === t.id ? ' kanban__card--dragging' : ''}`} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setDropCol(null); }}>
                      <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
                        <span className={`prio prio--${t.priority}`}>{t.priority.toUpperCase().replace('P', '')}</span>
                        <div className="kanban__title flex-1">{t.title}</div>
                      </div>
                      <div className="kanban__meta">
                        {t.assignee && <Avatar name={memberName(t.assignee)} />}
                        {t.due && <span><Icon name="clock" size={11} /> {fmtDate(t.due, { month: 'short', day: 'numeric' })}</span>}
                        {t.finding && <Link to={`/findings/${t.finding}`} className="mono text-xs">{t.finding}</Link>}
                        {t.tags?.slice(0, 1).map((tag) => <span key={tag} className="chip">{tag}</span>)}
                      </div>
                    </div>
                  ))}
                  {!items.length && <div className="text-xs muted center" style={{ padding: 12 }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Priority</th><th>Task</th><th>Status</th><th>Assignee</th><th>Due</th><th>Linked</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td><span className={`prio prio--${t.priority}`} title={PRIORITY_LABEL[t.priority]}>{t.priority.toUpperCase().replace('P', '')}</span></td>
                    <td><div className="table__title">{t.title}</div>{t.description && <div className="table__sub truncate" style={{ maxWidth: 360 }}>{t.description}</div>}</td>
                    <td>
                      <select className="select select--sm" value={t.status} onChange={(e) => move(t, e.target.value as TaskStatus)}>
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td>{t.assignee ? memberName(t.assignee) : <span className="muted">—</span>}</td>
                    <td className="nowrap">{t.due ? fmtDate(t.due, { month: 'short', day: 'numeric' }) : '—'}</td>
                    <td>{t.finding ? <Link to={`/findings/${t.finding}`} className="mono text-xs">{t.finding}</Link> : t.engagement ? <Link to={`/engagements/${t.engagement}`} className="mono text-xs">{t.engagement}</Link> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {!tasks.length && <Empty icon="kanban" title="No tasks yet" />}
    </div>
  );
}
