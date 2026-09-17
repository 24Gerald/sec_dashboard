import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

/** Render markdown to sanitised HTML. Reports may come from many hands; never trust raw HTML. */
export function renderMarkdown(src: string | undefined, evidence?: Record<string, string>): string {
  if (!src) return '';
  let html = marked.parse(src) as string;
  if (evidence) {
    // Rewrite relative evidence references (evidence/foo.png or ./foo.png) to bundled URLs.
    html = html.replace(/src="(?:\.\/|\/)?(?:content\/)?(?:evidence\/)?([^"]+)"/g, (m, p) => {
      const url = evidence[p];
      return url ? `src="${url}"` : m;
    });
  }
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] });
}

/** First paragraph, stripped of markdown, for previews. */
export function excerpt(src: string | undefined, max = 180): string {
  if (!src) return '';
  const text = src
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .split(/\n\s*\n/)[0]
    .trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
