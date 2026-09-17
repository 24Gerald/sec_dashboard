#!/usr/bin/env node
// Scaffold a new content record from the terminal.
// Usage: npm run new -- finding "Reentrancy in Vault" --severity critical
import { loadDataset, saveRecord, KIND_FOLDER } from '../server/content.js';

const [kind, title, ...rest] = process.argv.slice(2);
if (!kind || !KIND_FOLDER[kind]) { console.error(`Usage: npm run new -- <kind> "<title>" [--flag value]\n  kinds: ${Object.keys(KIND_FOLDER).join(', ')}`); process.exit(1); }
const flags = {};
for (let i = 0; i < rest.length; i += 2) if (rest[i]?.startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1];

const ds = loadDataset();
const year = new Date().getFullYear();
const prefix = { finding: 'ARK-F', engagement: 'ARK-E', task: 'ARK-T', asset: 'ARK-A', socEvent: 'ARK-S', report: 'ARK-R', build: 'ARK-B', deck: 'ARK-D' }[kind];
const key = { finding: 'findings', engagement: 'engagements', task: 'tasks', asset: 'assets', socEvent: 'socEvents', report: 'reports', build: 'builds', deck: 'decks' }[kind];
const nums = ds[key].map((r) => Number((r.id || '').match(new RegExp(`${prefix}-${year}-(\\d+)`))?.[1] || 0));
const id = `${prefix}-${year}-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
const today = new Date().toISOString().slice(0, 10);

const templates = {
  finding: { id, title: title || 'Untitled finding', severity: flags.severity || 'medium', status: 'open', discovered: today, summary: flags.summary || '', source: 'manual', tags: [], remediation: { recommendation: '' } },
  engagement: { id, title: title || 'Untitled engagement', type: flags.type || 'penetration-test', status: 'planned', startDate: today, summary: '', scope: [], team: [] },
  task: { id, title: title || 'Untitled task', status: 'todo', priority: flags.priority || 'p2', created: today },
  asset: { id, name: title || 'Untitled asset', type: flags.type || 'service', criticality: flags.criticality || 'medium' },
  socEvent: { id, timestamp: new Date().toISOString(), source: flags.source || 'manual', severity: flags.severity || 'info', category: 'info', title: title || '', message: flags.message || '', status: 'new' },
  report: { id, title: title || 'Untitled report', date: today, type: flags.type || 'summary', path: `${id}.md` },
  build: { id, title: title || 'Untitled build', kind: flags.kind || 'tool', status: 'building', description: '' },
};
const path = saveRecord(kind, templates[kind]);
console.log(`✓ Created ${id} → ${path}`);
