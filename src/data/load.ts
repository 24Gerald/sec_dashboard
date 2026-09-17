/**
 * Bundles everything under /content into a Dataset at build time.
 * Any JSON file may hold one record or an array of records; the folder decides the kind.
 */
import type { Dataset, Org, Engagement, Finding, Task, Asset, SocEvent, Report, Build, Deck } from '@/types';

// Sample seed lives under content/_sample/ and is excluded from the live bundle.
const jsonMods = import.meta.glob(['/content/**/*.json', '!/content/evidence/**', '!/content/_sample/**'], { eager: true, import: 'default' }) as Record<string, unknown>;
const mdMods = import.meta.glob(['/content/**/*.md', '!/content/_sample/**'], { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const evidenceMods = import.meta.glob('/content/evidence/**/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const FOLDER_KIND: Record<string, keyof Omit<Dataset, 'org' | 'markdown' | 'evidence'>> = {
  engagements: 'engagements',
  findings: 'findings',
  tasks: 'tasks',
  assets: 'assets',
  'soc-events': 'socEvents',
  reports: 'reports',
  builds: 'builds',
  decks: 'decks',
};

export const DEFAULT_ORG: Org = {
  name: 'ARK STUDIOS',
  unit: 'Security Team',
  tagline: 'Security Operations',
  sampleData: false,
  team: [],
};

function asArray(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === 'object') return [v as Record<string, unknown>];
  return [];
}

export function loadBundledDataset(): Dataset {
  const ds: Dataset = {
    org: DEFAULT_ORG,
    engagements: [], findings: [], tasks: [], assets: [], socEvents: [], reports: [], builds: [], decks: [],
    markdown: {}, evidence: {},
  };
  for (const [path, mod] of Object.entries(jsonMods)) {
    const rel = path.replace(/^\/content\//, '');
    if (rel === 'org.json') { ds.org = { ...DEFAULT_ORG, ...(mod as Org) }; continue; }
    const folder = rel.split('/')[0];
    const kind = FOLDER_KIND[folder];
    if (!kind) continue;
    for (const rec of asArray(mod)) {
      if (!rec.id) { console.warn(`[content] ${path}: record without id skipped`); continue; }
      (ds[kind] as unknown[]).push(rec);
    }
  }
  for (const [path, body] of Object.entries(mdMods)) ds.markdown[path.replace(/^\/content\//, '')] = body;
  for (const [path, url] of Object.entries(evidenceMods)) ds.evidence[path.replace(/^\/content\/evidence\//, '')] = url;
  return sortDataset(ds);
}

const ts = (s?: string) => (s ? new Date(s).getTime() || 0 : 0);

export function sortDataset(ds: Dataset): Dataset {
  ds.findings = [...ds.findings].sort((a: Finding, b: Finding) => ts(b.discovered) - ts(a.discovered));
  ds.engagements = [...ds.engagements].sort((a: Engagement, b: Engagement) => ts(b.startDate) - ts(a.startDate));
  ds.tasks = [...ds.tasks].sort((a: Task, b: Task) => ts(b.created) - ts(a.created));
  ds.socEvents = [...ds.socEvents].sort((a: SocEvent, b: SocEvent) => ts(b.timestamp) - ts(a.timestamp));
  ds.reports = [...ds.reports].sort((a: Report, b: Report) => ts(b.date) - ts(a.date));
  ds.builds = [...ds.builds].sort((a: Build, b: Build) => ts(b.started) - ts(a.started));
  ds.assets = [...ds.assets].sort((a: Asset, b: Asset) => a.name.localeCompare(b.name));
  ds.decks = [...ds.decks].sort((a: Deck, b: Deck) => ts(b.date) - ts(a.date));
  return ds;
}

/** The server returns the same shape; evidence urls there point at /content-files/. */
export function normaliseServerDataset(raw: Partial<Dataset>): Dataset {
  return sortDataset({
    org: { ...DEFAULT_ORG, ...(raw.org ?? {}) },
    engagements: raw.engagements ?? [], findings: raw.findings ?? [], tasks: raw.tasks ?? [], assets: raw.assets ?? [],
    socEvents: raw.socEvents ?? [], reports: raw.reports ?? [], builds: raw.builds ?? [], decks: raw.decks ?? [],
    markdown: raw.markdown ?? {}, evidence: raw.evidence ?? {},
  });
}
