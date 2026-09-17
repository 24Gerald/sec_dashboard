// Shared content-repository helpers used by the authoring server and CLI tools.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const CONTENT = join(ROOT, 'content');

export const KIND_FOLDER = {
  finding: 'findings', engagement: 'engagements', task: 'tasks', asset: 'assets',
  socEvent: 'soc-events', report: 'reports', build: 'builds', deck: 'decks',
};
const FOLDER_KEY = {
  engagements: 'engagements', findings: 'findings', tasks: 'tasks', assets: 'assets',
  'soc-events': 'socEvents', reports: 'reports', builds: 'builds', decks: 'decks',
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function loadDataset() {
  const ds = { org: { name: 'ARK STUDIOS', unit: 'Security Team', sampleData: false, team: [] }, engagements: [], findings: [], tasks: [], assets: [], socEvents: [], reports: [], builds: [], decks: [], markdown: {}, evidence: {} };
  const orgPath = join(CONTENT, 'org.json');
  if (existsSync(orgPath)) ds.org = { ...ds.org, ...readJson(orgPath) };
  for (const [folder, key] of Object.entries(FOLDER_KEY)) {
    const dir = join(CONTENT, folder);
    for (const file of walk(dir).filter((f) => f.endsWith('.json'))) {
      const data = readJson(file);
      for (const rec of Array.isArray(data) ? data : [data]) if (rec && rec.id) ds[key].push(rec);
    }
  }
  for (const file of walk(join(CONTENT, 'reports')).filter((f) => f.endsWith('.md'))) {
    ds.markdown[relative(CONTENT, file).replace(/\\/g, '/')] = readFileSync(file, 'utf8');
    ds.markdown[basename(file)] = readFileSync(file, 'utf8');
  }
  for (const file of walk(join(CONTENT, 'evidence'))) {
    const rel = relative(join(CONTENT, 'evidence'), file).replace(/\\/g, '/');
    ds.evidence[rel] = `/content-files/evidence/${rel}`;
  }
  return ds;
}

export function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

/** Path a record is stored at (one file per record, named by id). */
export function recordPath(kind, id) {
  const folder = KIND_FOLDER[kind];
  if (!folder) throw new Error(`Unknown kind: ${kind}`);
  return join(CONTENT, folder, `${sanitize(id)}.json`);
}

export function saveRecord(kind, record) {
  if (!record.id) throw new Error('record needs an id');
  const p = recordPath(kind, record.id);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(record, null, 2) + '\n');
  return relative(ROOT, p).replace(/\\/g, '/');
}

export function deleteRecord(kind, id) {
  const p = recordPath(kind, id);
  if (existsSync(p)) { unlinkSync(p); return true; }
  // record may live inside a multi-record array file — rewrite that file
  const folder = KIND_FOLDER[kind];
  for (const file of walk(join(CONTENT, folder)).filter((f) => f.endsWith('.json'))) {
    const data = readJson(file);
    if (Array.isArray(data)) {
      const filtered = data.filter((r) => r.id !== id);
      if (filtered.length !== data.length) { writeFileSync(file, JSON.stringify(filtered, null, 2) + '\n'); return true; }
    }
  }
  return false;
}

export function sanitize(id) { return String(id).replace(/[^A-Za-z0-9._-]/g, '_'); }

export function validateDataset(ds) {
  const errors = [];
  const ids = new Set();
  const check = (arr, kind, req) => {
    for (const r of arr) {
      const where = `${kind} ${r.id ?? '(no id)'}`;
      if (!r.id) { errors.push(`${kind}: record without id`); continue; }
      if (ids.has(r.id)) errors.push(`${where}: duplicate id`);
      ids.add(r.id);
      for (const f of req) if (r[f] === undefined || r[f] === '') errors.push(`${where}: missing "${f}"`);
    }
  };
  check(ds.engagements, 'engagement', ['title', 'type', 'status', 'startDate', 'summary']);
  check(ds.findings, 'finding', ['title', 'severity', 'status', 'discovered', 'summary']);
  check(ds.tasks, 'task', ['title', 'status', 'priority', 'created']);
  check(ds.assets, 'asset', ['name', 'type', 'criticality']);
  check(ds.socEvents, 'socEvent', ['timestamp', 'source', 'severity', 'category', 'title', 'message', 'status']);
  check(ds.reports, 'report', ['title', 'date', 'type', 'path']);
  check(ds.builds, 'build', ['title', 'kind', 'status', 'description']);
  // referential integrity
  const engIds = new Set(ds.engagements.map((e) => e.id));
  for (const f of ds.findings) if (f.engagement && !engIds.has(f.engagement)) errors.push(`finding ${f.id}: unknown engagement "${f.engagement}"`);
  const sevs = ['critical', 'high', 'medium', 'low', 'info'];
  for (const f of ds.findings) if (f.severity && !sevs.includes(f.severity)) errors.push(`finding ${f.id}: invalid severity "${f.severity}"`);
  return errors;
}

export { walk };
