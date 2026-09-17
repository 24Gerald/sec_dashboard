import { useStore } from '@/data/store';
import { Icon } from './Icon';

export function Toasts() {
  const { toasts } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === 'good' ? ' toast--good' : t.tone === 'bad' ? ' toast--bad' : ''}`}>
          <Icon name={t.tone === 'good' ? 'check' : t.tone === 'bad' ? 'alert' : 'bell'} size={16} style={{ color: t.tone === 'good' ? 'var(--good)' : t.tone === 'bad' ? 'var(--crit)' : 'var(--accent)' }} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
