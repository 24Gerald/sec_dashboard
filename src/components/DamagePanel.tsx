import type { Simulation } from '@/sim/types';
import { Icon } from './Icon';
import { fmtMoney } from '@/lib/format';

const DIM_ICON: Record<string, string> = {
  confidentiality: 'eye', integrity: 'edit', availability: 'gauge', financial: 'coins', reputation: 'users', compliance: 'book', safety: 'alert',
};
function tone(v: number) { return v >= 75 ? 'var(--crit)' : v >= 50 ? 'var(--serious)' : v >= 25 ? 'var(--warn)' : 'var(--good)'; }

export function DamagePanel({ sim, revealed = true }: { sim: Simulation; revealed?: boolean }) {
  const dims = [...sim.damage].sort((a, b) => b.score - a.score);
  return (
    <div className="sim__damage">
      <div className="sim__damage-title"><span>Potential damage</span><span className="num">{sim.impactScore}/100 impact</span></div>
      {dims.map((d) => (
        <div className="damage-row" key={d.dim} title={d.note}>
          <span className="damage-row__label row gap-4"><Icon name={DIM_ICON[d.dim] ?? 'alert'} size={13} />{d.label}</span>
          <span className="meter"><span className="meter__fill" style={{ width: revealed ? `${d.score}%` : '0%', background: tone(d.score) }} /></span>
          <span className="damage-row__val num" style={{ color: tone(d.score) }}>{d.score}</span>
        </div>
      ))}
      {sim.financialExposure ? (
        <div className="row row--between mt-8" style={{ paddingTop: 8, borderTop: '1px solid var(--line-1)' }}>
          <span className="text-sm muted row gap-4"><Icon name="coins" size={14} />Estimated exposure</span>
          <b className="num" style={{ color: 'var(--sev-high)' }}>{fmtMoney(sim.financialExposure)}</b>
        </div>
      ) : null}
    </div>
  );
}
