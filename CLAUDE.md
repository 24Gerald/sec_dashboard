# ARK STUDIOS Security Dashboard — working notes

Vite + React + TypeScript static dashboard for the ARK STUDIOS security team, with an
optional Express authoring/ingest server. Content is data under `content/`.

## Commands
- `npm run dev` — Vite dev server (proxies `/api` to the server on :8787).
- `npm run server` — authoring + SOC ingest server (also serves `dist/` if built).
- `npm run build` — `tsc --noEmit && vite build` → `dist/`. **Run this before committing UI changes.**
- `npm run typecheck` — type-check only.
- `npm run validate` — validate all content (schema + referential integrity). Run after editing `content/`.

## Layout
- `src/types.ts` — the content schema (source of truth for `content/` JSON).
- `src/data/` — `load.ts` bundles `content/` via `import.meta.glob`; `store.tsx` is the React store (bundled data + local drafts + optional live server via SSE).
- `src/lib/` — severity/status maps, formatting, metrics, markdown (sanitised), syntax highlight, ids.
- `src/sim/` — the attack simulator: `classify.ts` → `templates.ts` → `damage.ts`, tied together in `engine.ts`. **Add new attack classes here** (map in `classify.ts`, template in `templates.ts`, profile in `damage.ts`, label in `engine.ts`).
- `src/components/` — UI primitives, hand-rolled SVG charts, `AttackFlow`/`AttackSimulation`, evidence/code viewer.
- `src/views/` — one file per route; `present/` holds the presentation deck builder + slide renderer.
- `server/` — `content.js` (repo helpers, shared with CLI) + `index.js` (Express).
- `tools/` — `validate-content.js`, `new.js`, `soc-agent-example.js`.

## Conventions
- **Design tokens** live in `src/styles/tokens.css`; never hard-code colours in components — use the CSS vars. Data colours are validated for CVD safety and both themes.
- Charts are hand-rolled SVG in `src/components/charts.tsx` — no chart library. Severity always ships a text label (never colour alone).
- **Nested SVGs** (icons inside a chart/flow SVG): the `width:100%` stretch rules are scoped to `> svg` (direct child) so nested icon `<svg>` keep their own size. Keep that scoping.
- `noUnusedLocals`/`noUnusedParameters` are on — remove unused imports (the JSX runtime is automatic, so no `import React` unless you use `React.*`).
- IDs follow `ARK-<F|E|T|A|S|R|B|D>-<year>-<seq>` (`src/lib/ids.ts`).
- Markdown is always rendered through `src/lib/markdown.ts` (DOMPurify) — never `dangerouslySetInnerHTML` raw content.

## Attack simulator invariants
- Simulations are **deterministic** and **client-side only** (no network).
- Every finding must classify to *something* (generic fallback exists); prefer explicit `attack.class` for authored content.
