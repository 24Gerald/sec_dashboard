import React from 'react';
import { Icon } from './Icon';
import type { Severity } from '@/types';
import { SEVERITY_LABEL } from '@/lib/severity';

export function Badge({ tone = 'neutral', children, dot, size, className = '' }: { tone?: string; children: React.ReactNode; dot?: boolean; size?: 'sm' | 'lg'; className?: string }) {
  return <span className={`badge badge--${tone}${size ? ` badge--${size}` : ''} ${className}`}>{dot && <span className="badge__dot" />}{children}</span>;
}

export function SeverityBadge({ severity, size, showLabel = true }: { severity: Severity; size?: 'sm' | 'lg'; showLabel?: boolean }) {
  return <Badge tone={severity} size={size} dot>{showLabel ? SEVERITY_LABEL[severity] : ''}</Badge>;
}

export function Chip({ children, mono, onClick, title }: { children: React.ReactNode; mono?: boolean; onClick?: () => void; title?: string }) {
  return <span className={`chip${mono ? ' chip--mono' : ''}`} onClick={onClick} title={title} style={onClick ? { cursor: 'pointer' } : undefined}>{children}</span>;
}

export function Avatar({ name, size, color }: { name?: string; size?: 'lg' | 'xl'; color?: string }) {
  const initials = (name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <span className={`avatar${size ? ` avatar--${size}` : ''}`} style={color ? { background: color, color: '#fff' } : undefined} title={name}>{initials}</span>;
}

export function Stat({ label, value, hint, tone, icon, delta, spark, bar }: {
  label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; tone?: 'critical' | 'high' | 'accent' | 'good';
  icon?: string; delta?: { dir: 'up' | 'down' | 'flat'; text: string; good?: boolean }; spark?: React.ReactNode; bar?: string;
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      {bar && <span className="stat__bar" style={{ background: bar }} />}
      <div className="stat__label">{icon && <Icon name={icon} size={13} />}{label}</div>
      <div className="stat__value num">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
      {delta && (
        <div className="stat__hint">
          <span className={`stat__delta stat__delta--${delta.dir}`}><Icon name={delta.dir === 'up' ? 'arrow-up' : delta.dir === 'down' ? 'arrow-down' : 'arrow-right'} size={12} /> {delta.text}</span>
        </div>
      )}
      {spark && <div className="stat__spark">{spark}</div>}
    </div>
  );
}

export function Card({ title, sub, actions, children, className = '', pad = true, footer, accent }: {
  title?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean; footer?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`card${accent ? ' card--accent' : ''} ${className}`}>
      {(title || actions) && (
        <div className="card__header">
          <div style={{ minWidth: 0 }}>{title && <div className="card__title">{title}</div>}{sub && <div className="card__sub">{sub}</div>}</div>
          {actions && <div className="row gap-4">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'card__body' : ''} style={pad ? undefined : { flex: 1, minWidth: 0 }}>{children}</div>
      {footer && <div className="card__footer">{footer}</div>}
    </div>
  );
}

export function Empty({ icon = 'search', title, children, action }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} strokeWidth={1.4} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
      <div className="empty__title">{title}</div>
      {children && <div className="text-sm">{children}</div>}
      {action && <div className="mt-12">{action}</div>}
    </div>
  );
}

export function Button({ icon, children, variant, size, active, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string; variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'lg'; active?: boolean }) {
  const cls = ['btn', variant && `btn--${variant}`, size && `btn--${size}`, active && 'btn--active', !children && 'btn--icon'].filter(Boolean).join(' ');
  return <button className={cls} {...rest}>{icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}{children}</button>;
}

export function Meter({ value, color = 'var(--accent)', max = 100 }: { value: number; color?: string; max?: number }) {
  return <div className="meter"><div className="meter__fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={`seg__item${o.value === value ? ' seg__item--active' : ''}`} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ label, help, error, children, hint }: { label?: React.ReactNode; help?: React.ReactNode; error?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}{hint}</span>}
      {children}
      {help && !error && <span className="field__help">{help}</span>}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: React.ReactNode }) {
  return (
    <label className="row gap-8 clickable" style={{ userSelect: 'none' }}>
      <button type="button" className={`switch${on ? ' switch--on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={typeof label === 'string' ? label : 'toggle'} />
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, footer, size }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; size?: 'lg' }) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className={`modal${size ? ` modal--${size}` : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head"><h3>{title}</h3><Button icon="x" variant="ghost" size="sm" onClick={onClose} aria-label="Close" /></div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: React.ReactNode; count?: number; icon?: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} className={`tab${t.id === active ? ' tab--active' : ''}`} onClick={() => onChange(t.id)} role="tab" aria-selected={t.id === active}>
          {t.icon && <Icon name={t.icon} size={15} />}{t.label}{t.count !== undefined && <span className="nav__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Severity distribution as a single stacked bar with a table-view fallback (dataviz relief rule). */
export function SeverityStack({ counts, showZero = false }: { counts: Record<Severity, number>; showZero?: boolean }) {
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const total = order.reduce((s, k) => s + counts[k], 0);
  if (!total) return <span className="muted text-sm">No findings</span>;
  return (
    <div title={order.map((s) => `${SEVERITY_LABEL[s]}: ${counts[s]}`).join(' · ')}>
      <div className="progress">
        {order.map((s) => counts[s] > 0 && <span key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: `var(--sev-${s})` }} title={`${SEVERITY_LABEL[s]}: ${counts[s]}`} />)}
      </div>
      <div className="row row--wrap gap-8 mt-8 text-xs">
        {order.filter((s) => showZero || counts[s] > 0).map((s) => (
          <span key={s} className="legend__item"><span className="swatch" style={{ background: `var(--sev-${s})` }} />{SEVERITY_LABEL[s]} <b className="num">{counts[s]}</b></span>
        ))}
      </div>
    </div>
  );
}

export function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return <span className="row gap-4" title={`Classifier confidence ${pct}%`}><span className="meter" style={{ width: 48 }}><span className="meter__fill" style={{ width: `${pct}%`, background: value > 0.7 ? 'var(--good)' : value > 0.4 ? 'var(--warn)' : 'var(--ink-4)' }} /></span><span className="text-xs num">{pct}%</span></span>;
}
