# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `AGENTS.md` first: this Next.js version (16) has breaking changes, so check `node_modules/next/dist/docs/` before writing Next-specific code.

## What this is

A browser-only tool (no backend, no database, no persistence) where an engineer draws an alignment on an OpenStreetMap/Leaflet map, gets chainage points along it, and exports an A4 PDF report. The spec is `docs/specs/map-chainage.md`; its "Decisions" section holds the product rules (label formats, bearing rules, file name fallback, and so on). It was built one milestone at a time (M1 to M11, all done, committed per milestone on `feature/map-chainage`).

## Commands

Node >= 22.12.

```bash
npm run dev          # http://localhost:3000
npm test             # Vitest, all tests
npx vitest run lib/pdf/buildReport.test.ts   # single file
npx vitest run -t "name fragment"            # single test by name
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build
```

Vitest runs in the `node` environment and only picks up `lib/**/*.test.ts`. Component code is not unit tested.

## Architecture

- `lib/` is pure, framework-free logic, and everything testable lives here.
  - `lib/chainage`: geodesic math (`geo.ts`, haversine with R = 6,371,008.8 m), `generateChainage` (start, absolute interval multiples, vertices and end merged within 0.01 m; returns no points over `MAX_POINTS` = 2000), label formatting, input validation, `buildSummary`. Interval-point labels are `km+mmm`. Non-interval points (vertices, end, start when not on an interval) get 2 dp labels.
  - `lib/alignment/reducer.ts`: the single source of truth for drawn vertices and the draw/idle mode.
  - `lib/services`: Nominatim search and Open-Meteo elevation clients (1 request/s throttle, batches of at most 100 coordinates, per-batch timeout), with a shared abort helper.
  - `lib/export/runExport.ts`: export orchestrator (elevations, map snapshot, PDF build, save) with injected dependencies. `lib/snapshot`: off-screen canvas map image from OSM tiles.
  - `lib/pdf`: `buildChainagePdf` (jsPDF plus the `autoTable(doc, opts)` function form of jspdf-autotable), `sanitizeFileName`, `formatGeneratedAt`, `hasUnsupportedChars`. The builder is pure apart from jsPDF and takes `generatedAt` as input. Only the export handler may read `new Date()`, via the injected `now` in `lib/export/runExport.ts`.
- `components/ChainageApp.tsx` is the client root. It owns the reducer state, derives chainage points with `generateChainage` and passes them down. `components/map/*` is Leaflet and `components/panel/*` is the side panel UI. Leaflet is browser-only, so `MapView` is loaded with `next/dynamic` and `ssr: false`.
- PDF text uses built-in Helvetica (WinAnsi) only. `°`, `©`, `·` and `—` render fine, and anything else is not supported. `hasUnsupportedChars` exists so the UI can warn about the project name.
- Path alias `@/` maps to the repo root.

## Conventions

- Schema or DB changes do not apply here: there is no Prisma schema in this repo, even though `.claude/settings.json` allows some prisma commands.
- Tests sit beside the code as `*.test.ts`. To check text in a PDF test, read `doc.output()`: the content stream is uncompressed, and a WinAnsi em dash appears as the raw character `\u0097`.
- Respect the external usage policies noted in `README.md` (OSM tiles, Nominatim 1 req/s, Open-Meteo non-commercial).
