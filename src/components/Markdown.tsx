import { useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import { useStore } from '@/data/store';

export function Markdown({ children, wide, sm }: { children?: string; wide?: boolean; sm?: boolean }) {
  const { data } = useStore();
  const html = useMemo(() => renderMarkdown(children, data.evidence), [children, data.evidence]);
  if (!children) return null;
  return <div className={`md${wide ? ' md--wide' : ''}${sm ? ' md--sm' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
