import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Dataset, RecordKind, Finding, Engagement, Task, Asset, SocEvent, Report, Build, Deck, TeamMember } from '@/types';
import { loadBundledDataset, normaliseServerDataset, sortDataset } from './load';

type AnyRecord = Finding | Engagement | Task | Asset | SocEvent | Report | Build | Deck;
type Drafts = Record<RecordKind, AnyRecord[]>;
const KIND_KEY: Record<RecordKind, keyof Omit<Dataset, 'org' | 'markdown' | 'evidence'>> = {
  finding: 'findings', engagement: 'engagements', task: 'tasks', asset: 'assets', socEvent: 'socEvents', report: 'reports', build: 'builds', deck: 'decks',
};
const EMPTY_DRAFTS: Drafts = { finding: [], engagement: [], task: [], asset: [], socEvent: [], report: [], build: [], deck: [] };
const DRAFT_KEY = 'ark.drafts.v1';
const THEME_KEY = 'ark.theme';

export interface Toast { id: number; text: string; tone?: 'good' | 'bad' | 'neutral' }

export interface Index {
  engagementById: Map<string, Engagement>;
  findingById: Map<string, Finding>;
  assetById: Map<string, Asset>;
  taskById: Map<string, Task>;
  memberById: Map<string, TeamMember>;
  findingsByEngagement: Map<string, Finding[]>;
  tasksByEngagement: Map<string, Task[]>;
  reportById: Map<string, Report>;
  buildById: Map<string, Build>;
}

export interface Store {
  data: Dataset;
  index: Index;
  drafts: Drafts;
  online: boolean;
  live: boolean;
  loading: boolean;
  lastSync?: string;
  refresh: () => Promise<void>;
  save: (kind: RecordKind, record: AnyRecord) => Promise<'server' | 'draft'>;
  remove: (kind: RecordKind, id: string) => Promise<void>;
  discardDraft: (kind: RecordKind, id: string) => void;
  discardAllDrafts: () => void;
  isDraft: (kind: RecordKind, id: string) => boolean;
  upload: (file: File, folder: string) => Promise<string | null>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
  memberName: (id?: string) => string;
}

const StoreCtx = createContext<Store | null>(null);

function readDrafts(): Drafts {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFTS;
    return { ...EMPTY_DRAFTS, ...(JSON.parse(raw) as Partial<Drafts>) };
  } catch { return EMPTY_DRAFTS; }
}
function writeDrafts(d: Drafts) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage unavailable */ } }

function mergeDrafts(base: Dataset, drafts: Drafts): Dataset {
  const out: Dataset = { ...base };
  (Object.keys(KIND_KEY) as RecordKind[]).forEach((kind) => {
    const key = KIND_KEY[kind];
    const list = drafts[kind];
    if (!list?.length) return;
    const ids = new Set(list.map((r) => r.id));
    (out[key] as AnyRecord[]) = [...(base[key] as AnyRecord[]).filter((r) => !ids.has(r.id)), ...list];
  });
  return sortDataset(out);
}

function buildIndex(d: Dataset): Index {
  const findingsByEngagement = new Map<string, Finding[]>();
  for (const f of d.findings) {
    if (!f.engagement) continue;
    if (!findingsByEngagement.has(f.engagement)) findingsByEngagement.set(f.engagement, []);
    findingsByEngagement.get(f.engagement)!.push(f);
  }
  const tasksByEngagement = new Map<string, Task[]>();
  for (const t of d.tasks) {
    if (!t.engagement) continue;
    if (!tasksByEngagement.has(t.engagement)) tasksByEngagement.set(t.engagement, []);
    tasksByEngagement.get(t.engagement)!.push(t);
  }
  return {
    engagementById: new Map(d.engagements.map((e) => [e.id, e])),
    findingById: new Map(d.findings.map((f) => [f.id, f])),
    assetById: new Map(d.assets.map((a) => [a.id, a])),
    taskById: new Map(d.tasks.map((t) => [t.id, t])),
    memberById: new Map(d.org.team.map((m) => [m.id, m])),
    reportById: new Map(d.reports.map((r) => [r.id, r])),
    buildById: new Map(d.builds.map((b) => [b.id, b])),
    findingsByEngagement,
    tasksByEngagement,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const bundled = useMemo(loadBundledDataset, []);
  const [base, setBase] = useState<Dataset>(bundled);
  const [drafts, setDrafts] = useState<Drafts>(readDrafts);
  const [online, setOnline] = useState(false);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  const toastId = useRef(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'neutral') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setBase(normaliseServerDataset(json));
      setOnline(true); setLive(true); setLastSync(new Date().toISOString());
    } catch {
      setOnline(false); setLive(false);
      setBase(bundled);
    } finally { setLoading(false); }
  }, [bundled]);

  // Detect the authoring server, then keep in sync via SSE (falls back to polling).
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: number | undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/health', { headers: { accept: 'application/json' } });
        if (!r.ok || cancelled) return;
        const j = await r.json();
        if (!j?.ok) return;
        await refresh();
        if (cancelled) return;
        try {
          es = new EventSource('/api/events');
          es.onmessage = () => { void refresh(); };
          es.onerror = () => { es?.close(); es = null; poll = window.setInterval(() => void refresh(), 20000); };
        } catch { poll = window.setInterval(() => void refresh(), 20000); }
      } catch { /* static hosting — stay with the bundled dataset */ }
    })();
    return () => { cancelled = true; es?.close(); if (poll) clearInterval(poll); };
  }, [refresh]);

  const persistDrafts = useCallback((next: Drafts) => { setDrafts(next); writeDrafts(next); }, []);

  const save = useCallback(async (kind: RecordKind, record: AnyRecord): Promise<'server' | 'draft'> => {
    if (online) {
      try {
        const r = await fetch(`/api/${kind}/${encodeURIComponent(record.id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(record) });
        if (r.ok) {
          // A server save supersedes any local draft of the same id.
          const next = { ...drafts, [kind]: drafts[kind].filter((x) => x.id !== record.id) };
          persistDrafts(next);
          await refresh();
          return 'server';
        }
      } catch { /* fall through to draft */ }
    }
    const next = { ...drafts, [kind]: [...drafts[kind].filter((x) => x.id !== record.id), record] };
    persistDrafts(next);
    return 'draft';
  }, [online, drafts, persistDrafts, refresh]);

  const remove = useCallback(async (kind: RecordKind, id: string) => {
    if (online) {
      try { await fetch(`/api/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refresh(); } catch { /* ignore */ }
    }
    persistDrafts({ ...drafts, [kind]: drafts[kind].filter((x) => x.id !== id) });
  }, [online, drafts, persistDrafts, refresh]);

  const discardDraft = useCallback((kind: RecordKind, id: string) => {
    persistDrafts({ ...drafts, [kind]: drafts[kind].filter((x) => x.id !== id) });
  }, [drafts, persistDrafts]);
  const discardAllDrafts = useCallback(() => persistDrafts(EMPTY_DRAFTS), [persistDrafts]);
  const isDraft = useCallback((kind: RecordKind, id: string) => drafts[kind].some((x) => x.id === id), [drafts]);

  const upload = useCallback(async (file: File, folder: string): Promise<string | null> => {
    if (!online) return null;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!r.ok) return null;
      const j = await r.json();
      await refresh();
      return j.path as string;
    } catch { return null; }
  }, [online, refresh]);

  const data = useMemo(() => mergeDrafts(base, drafts), [base, drafts]);
  const index = useMemo(() => buildIndex(data), [data]);
  const memberName = useCallback((id?: string) => (id ? index.memberById.get(id)?.name ?? id : '—'), [index]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const value: Store = {
    data, index, drafts, online, live, loading, lastSync, refresh, save, remove, discardDraft, discardAllDrafts, isDraft, upload,
    theme, toggleTheme, toasts, toast, memberName,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
