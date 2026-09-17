import { Icon } from './Icon';

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon name="search" size={15} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} />
      <input className="input input--sm" style={{ paddingLeft: 30, minWidth: 190 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, all = 'All' }: { value: T | ''; onChange: (v: T | '') => void; options: { value: T; label: string }[]; all?: string }) {
  return (
    <select className="select select--sm" value={value} onChange={(e) => onChange(e.target.value as T | '')}>
      <option value="">{all}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
