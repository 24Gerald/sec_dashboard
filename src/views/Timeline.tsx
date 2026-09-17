import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Empty, Segmented } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { LineChart, seriesColor } from '@/components/charts';
import { activityFeed, findingsByMonth } from '@/lib/metrics';
import { fmtDate, fmtMonth } from '@/lib/format';
import { ENGAGEMENT_STATUS_TONE, ENGAGEMENT_STATUS_LABEL, tense } from '@/lib/severity';

const KIND_ICON: Record<string, string> = { finding: 'bug', fix: 'shield-check', task: 'check', engagement: 'target', soc: 'radar', build: 'wrench', report: 'file', retest: 'repeat' };
const KIND_COLOR: Record<string, string> = { finding: 'crit', fix: 'good', task: 'accent', engagement: 'warn', soc: 'accent', build: 'good', report: 'accent', retest: 'warn' };

export function Timeline() {
  const { data } = useStore();
  const [range, setRange] = useState<'12' | '24' | 'all'>('12');
  const months = Number(range === 'all' ? 36 : range);
  const feed = useMemo(() => activityFeed(data, 200), [data]);
  const trend = useMemo(() => findingsByMonth(data.findings, months), [data.findings, months]);

  // group feed by month
  const grouped = useMemo(() => {
    const g = new Map<string, typeof feed>();
    for (const it of feed) { const k = it.date.slice(0, 7); if (!g.has(k)) g.set(k, []); g.get(k)!.push(it); }
    return [...g.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [feed]);

  const roadmap = data.engagements.filter((e) => tense(e.status) !== 'past').sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="page">
      <PageHeader eyebrow="History & plan" title="Timeline" sub="Everything the team has done and will do — findings, fixes, engagements, builds and SOC events over time."
        actions={<Segmented value={range} onChange={setRange} options={[{ value: '12', label: '12m' }, { value: '24', label: '24m' }, { value: 'all', label: 'All' }]} />} />

      <div className="grid grid--main mb-16">
        <Card title="Activity trend" sub="Findings discovered vs resolved" accent>
          <LineChart data={trend.map((m) => ({ label: m.label, Discovered: m.discovered, Resolved: m.resolved }))} series={[{ key: 'Discovered', label: 'Discovered', color: seriesColor(0) }, { key: 'Resolved', label: 'Resolved', color: seriesColor(2) }]} height={200} area />
        </Card>
        <Card title="Upcoming & active" sub="Planned and in-progress work">
          {roadmap.length ? roadmap.map((e) => (
            <Link key={e.id} to={`/engagements/${e.id}`} className="list__item list__item--link">
              <span className="list__icon"><Icon name="target" size={14} /></span>
              <div className="list__body"><div className="list__title text-sm">{e.title}</div><div className="list__meta"><Badge tone={ENGAGEMENT_STATUS_TONE[e.status]} size="sm">{ENGAGEMENT_STATUS_LABEL[e.status]}</Badge><span>{fmtDate(e.startDate, { month: 'short', year: '2-digit' })}</span></div></div>
            </Link>
          )) : <Empty title="Nothing planned" />}
        </Card>
      </div>

      {grouped.length ? grouped.map(([month, items]) => (
        <div key={month} className="mb-16">
          <div className="section-title">{fmtMonth(month + '-01')}<Badge tone="neutral" size="sm">{items.length}</Badge></div>
          <Card pad>
            <div className="timeline">
              {items.map((it) => (
                <div className="timeline__item" key={it.id}>
                  <span className={`timeline__dot timeline__dot--${KIND_COLOR[it.kind] === 'crit' ? 'crit' : KIND_COLOR[it.kind] === 'good' ? 'good' : KIND_COLOR[it.kind] === 'warn' ? 'warn' : 'accent'}`} />
                  <div className="row row--between">
                    <div>
                      <div className="timeline__title row gap-8"><Icon name={KIND_ICON[it.kind]} size={13} />{it.href ? <Link to={it.href}>{it.title}</Link> : it.title}{it.severity && <Badge tone={it.severity} size="sm" dot>{it.severity}</Badge>}</div>
                      <div className="timeline__note">{it.detail}</div>
                    </div>
                    <div className="timeline__date">{fmtDate(it.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )) : <Empty title="No activity recorded yet" />}
    </div>
  );
}
