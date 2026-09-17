/**
 * ARK STUDIOS Security Dashboard — authoring & ingest server (optional).
 *
 * Lets the UI write findings/tasks/etc straight to content/*.json, upload
 * evidence, and exposes a token-authed /api/ingest endpoint for the SOC bot.
 * The dashboard works fully static without this; the server just enables
 * authoring from the browser and live SOC ingestion.
 *
 *   npm run server           # http://localhost:8787
 *   INGEST_TOKEN=... npm run server
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join, extname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { CONTENT, ROOT, loadDataset, saveRecord, deleteRecord, validateDataset, KIND_FOLDER, sanitize } from './content.js';

const PORT = process.env.PORT || 8787;
const INGEST_TOKEN = process.env.INGEST_TOKEN || 'ark-dev-token';
const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));

// --- Server-Sent Events: notify the UI when content changes ---
const clients = new Set();
function broadcast(type) { for (const res of clients) res.write(`data: ${JSON.stringify({ type, at: Date.now() })}\n\n`); }

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ark-security-dashboard', version: 1, ingest: '/api/ingest' }));

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders?.();
  res.write('data: {"type":"hello"}\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/api/content', (_req, res) => res.json(loadDataset()));

app.get('/api/validate', (_req, res) => {
  const errors = validateDataset(loadDataset());
  res.status(errors.length ? 422 : 200).json({ ok: !errors.length, errors });
});

// Serve evidence & report files
app.use('/content-files', express.static(CONTENT, { fallthrough: true, maxAge: '5m' }));

// CRUD for every record kind
app.put('/api/:kind/:id', (req, res) => {
  const { kind, id } = req.params;
  if (!KIND_FOLDER[kind]) return res.status(400).json({ ok: false, error: `unknown kind ${kind}` });
  const record = { ...req.body, id };
  try {
    const path = saveRecord(kind, record);
    broadcast(`${kind}:saved`);
    res.json({ ok: true, id, path });
  } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e) }); }
});

app.delete('/api/:kind/:id', (req, res) => {
  const { kind, id } = req.params;
  if (!KIND_FOLDER[kind]) return res.status(400).json({ ok: false, error: `unknown kind ${kind}` });
  const removed = deleteRecord(kind, id);
  broadcast(`${kind}:deleted`);
  res.json({ ok: true, removed });
});

// --- Evidence upload ---
const uploadDir = join(CONTENT, 'evidence');
mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, _file, cb) => { const sub = sanitize(req.body.folder || 'evidence').replace(/^evidence\/?/, ''); const dir = join(uploadDir, sub); mkdirSync(dir, { recursive: true }); cb(null, dir); },
  filename: (_req, file, cb) => { const safe = sanitize(file.originalname.replace(extname(file.originalname), '')).slice(0, 40); cb(null, `${Date.now()}-${safe}${extname(file.originalname).toLowerCase()}`); },
});
const upload = multer({ storage, limits: { fileSize: 12 * 1024 * 1024 } });
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'no file' });
  const rel = req.file.path.replace(ROOT + '/', '').replace(/\\/g, '/');
  broadcast('evidence:uploaded');
  res.json({ ok: true, path: rel, url: `/content-files/${rel.replace(/^content\//, '')}` });
});

// --- SOC bot ingest (token-authed) ---
// The always-on SOC bot POSTs events here; high-severity ones can auto-create findings.
app.post('/api/ingest', (req, res) => {
  const token = req.get('X-Ingest-Token') || req.query.token;
  if (token !== INGEST_TOKEN) return res.status(401).json({ ok: false, error: 'invalid ingest token' });
  const body = req.body || {};
  const events = Array.isArray(body.events) ? body.events : [body];
  const created = [];
  const ds = loadDataset();
  let seq = ds.socEvents.length;
  for (const e of events) {
    if (!e || (!e.title && !e.message)) continue;
    const id = e.id || `ARK-S-${new Date().getFullYear()}-${String(++seq).padStart(4, '0')}`;
    const event = {
      id,
      timestamp: e.timestamp || new Date().toISOString(),
      source: e.source || 'soc-bot',
      severity: ['critical', 'high', 'medium', 'low', 'info'].includes(e.severity) ? e.severity : 'info',
      category: e.category || 'info',
      title: e.title || e.message.slice(0, 80),
      message: e.message || e.title,
      asset: e.asset,
      rule: e.rule,
      raw: e.raw,
      status: 'new',
      source_type: 'soc-bot',
      sample: false,
    };
    saveRecord('socEvent', event);
    created.push(id);

    // auto-promote critical/high with promote flag into a finding
    if (e.promote && (event.severity === 'critical' || event.severity === 'high')) {
      const fid = `ARK-F-${new Date().getFullYear()}-${String(ds.findings.length + created.length).padStart(4, '0')}`;
      const finding = {
        id: fid, title: event.title, severity: event.severity, status: 'open',
        discovered: event.timestamp.slice(0, 10), summary: event.message,
        source: 'soc-bot', tags: e.tags || [event.category], attack: e.attack,
        affected: e.affected, assets: e.asset ? [e.asset] : undefined,
      };
      saveRecord('finding', finding);
      event.linkedFinding = fid;
      saveRecord('socEvent', event);
      created.push(fid);
    }
  }
  broadcast('soc:ingest');
  res.json({ ok: true, ingested: created.length, ids: created });
});

// Serve the built dashboard if present (single-container deploy)
const dist = join(ROOT, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/content-files).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n  ARK STUDIOS security dashboard — authoring server`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → content: ${CONTENT}`);
  console.log(`  → SOC ingest: POST /api/ingest  (X-Ingest-Token: ${INGEST_TOKEN === 'ark-dev-token' ? 'ark-dev-token [dev default — set INGEST_TOKEN]' : '****'})`);
  if (!existsSync(dist)) console.log(`  → run "npm run dev" separately for the UI (proxied), or "npm run build" to serve it here\n`);
});
