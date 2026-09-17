import { useMemo } from 'react';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Empty, Stat, Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { BarChart, StackedBars, seriesColor } from '@/components/charts';
import { effortByMember, totalHours, coverage } from '@/lib/metrics';
import { ENGAGEMENT_TYPE_LABEL } from '@/lib/severity';
import { fmtNum } from '@/lib/format';

export function Team() {
  const { data } = useStore();
  const effort = useMemo(() => effortByMember(data), [data]);
  const cov = useMemo(() => coverage(data), [data]);
  const hours = totalHours(data);
  const active = data.org.team.filter((m) => m.active !== false).length;

  return (
    <div className="page">
      <PageHeader eyebrow={`${data.org.name} security team`} title="Team & effort" sub="Who did what — findings, engagements and hours across the team, and where our effort has gone." />

      <div className="grid grid--4 mb-16">
        <Stat label="Team members" value={data.org.team.length} icon="users" hint={`${active} active`} />
        <Stat label="Engagements run" value={data.engagements.length} icon="target" />
        <Stat label="Findings logged" value={data.findings.length} icon="bug" />
        <Stat label="Effort logged" value={fmtNum(hours)} icon="clock" hint="hours" />
      </div>

      {data.org.team.length ? (
        <>
          <div className="grid grid--main mb-16">
            <Card title="Contribution by member" sub="Findings reported + tasks completed">
              <BarChart data={effort.filter((e) => e.findings + e.tasksDone > 0).map((e) => ({ label: e.member.name, value: e.findings + e.tasksDone, sub: 'Findings + tasks' }))} />
            </Card>
            <Card title="Effort coverage" sub="Engagements by type">
              <StackedBars
                rows={cov.map((c) => ({ label: ENGAGEMENT_TYPE_LABEL[c.type], values: { done: c.done, active: c.active, planned: c.planned } }))}
                keys={['done', 'active', 'planned']}
                colors={{ done: seriesColor(2), active: seriesColor(0), planned: 'var(--ink-4)' }}
                labels={{ done: 'Completed', active: 'Active', planned: 'Planned' }}
              />
              <div className="legend mt-12">
                <span className="legend__item"><span className="swatch" style={{ background: seriesColor(2) }} />Completed</span>
                <span className="legend__item"><span className="swatch" style={{ background: seriesColor(0) }} />Active</span>
                <span className="legend__item"><span className="swatch" style={{ background: 'var(--ink-4)' }} />Planned</span>
              </div>
            </Card>
          </div>

          <div className="grid grid--auto">
            {effort.map((e) => (
              <Card key={e.member.id} className="card--pad">
                <div className="row gap-12 mb-12">
                  <Avatar name={e.member.name} size="lg" />
                  <div className="flex-1">
                    <div className="list__title">{e.member.name}{e.member.active === false && <Badge tone="neutral" size="sm" className="mt-4">inactive</Badge>}</div>
                    <div className="text-xs muted">{e.member.role}</div>
                    {e.member.handle && <div className="text-xs muted mono">{e.member.handle}</div>}
                  </div>
                </div>
                {e.member.bio && <p className="text-sm dim mb-12">{e.member.bio}</p>}
                <div className="grid grid--2 gap-8">
                  <MiniStat icon="bug" label="Findings" value={e.findings} />
                  <MiniStat icon="fire" label="Crit/High" value={e.critical} tone="var(--sev-high)" />
                  <MiniStat icon="target" label="Engagements" value={e.engagements} sub={e.led ? `${e.led} led` : undefined} />
                  <MiniStat icon="check" label="Tasks done" value={e.tasksDone} />
                </div>
                {e.hours > 0 && <div className="row row--between text-xs muted mt-12" style={{ borderTop: '1px solid var(--line-1)', paddingTop: 8 }}><span>Effort logged</span><b className="num">{fmtNum(e.hours)}h</b></div>}
                {e.member.skills?.length ? <div className="chips mt-8">{e.member.skills.slice(0, 6).map((s) => <span key={s} className="chip">{s}</span>)}</div> : null}
              </Card>
            ))}
          </div>
        </>
      ) : <Empty icon="users" title="No team members yet" >Add your team under <span className="mono">content/org.json</span>.</Empty>}
    </div>
  );
}

function MiniStat({ icon, label, value, tone, sub }: { icon: string; label: string; value: number; tone?: string; sub?: string }) {
  return (
    <div className="stat" style={{ padding: '8px 10px', boxShadow: 'none', border: '1px solid var(--line-1)', background: 'var(--bg-2)' }}>
      <div className="stat__label" style={{ fontSize: 10.5 }}><Icon name={icon} size={12} />{label}</div>
      <div className="stat__value num" style={{ fontSize: 20, color: tone }}>{value}{sub && <small style={{ fontSize: 11 }}> {sub}</small>}</div>
    </div>
  );
}
