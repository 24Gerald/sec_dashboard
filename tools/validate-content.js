#!/usr/bin/env node
// Validate all content files: schema, required fields, referential integrity.
// Usage: npm run validate
import { loadDataset, validateDataset } from '../server/content.js';

const ds = loadDataset();
const errors = validateDataset(ds);
const counts = { engagements: ds.engagements.length, findings: ds.findings.length, tasks: ds.tasks.length, assets: ds.assets.length, socEvents: ds.socEvents.length, reports: ds.reports.length, builds: ds.builds.length, decks: ds.decks.length };
console.log('ARK STUDIOS content:', Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · '));
if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`);
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}
console.log('✓ All content is valid.');
