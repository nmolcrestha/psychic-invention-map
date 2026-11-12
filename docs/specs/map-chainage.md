# Map Chainage Tool (MVP)

## Goal

Give road/civil engineers and surveyors a quick, no-login web tool: draw an alignment on an OpenStreetMap map (Leaflet), generate chainage points along it at a chosen interval, and export a PDF chainage report with a map snapshot, summary details, and a chainage table (including elevation).

This is a first version (MVP). It runs entirely in the browser with no backend and no stored data.

## User-facing behaviour

Single page (`/`) with a full-height map and a side panel.

### Map
- Leaflet map using OpenStreetMap standard tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) with the required OSM attribution.
- **Place search**: a search box in the panel queries Nominatim (`https://nominatim.openstreetmap.org/search?format=json&q=...`). Results appear as a short list, and picking one pans/zooms the map there. Requests are debounced or submit-on-enter only (max 1 request/second, per the Nominatim usage policy). Shows "No results" or an error message when appropriate.

### Drawing the alignment
- "Draw alignment" mode: each map click adds a vertex to a polyline.
- Vertices can be dragged to edit the line, and **Undo last point** removes the most recent vertex.
- **Finish** ends drawing mode, and **Clear** removes the alignment (with a confirm if it has points).
- Only one alignment exists at a time.

### Chainage settings
- **Interval (m)**: whole-number input, min 1, default 100. Presets 10 / 20 / 50 / 100 available.
- **Start chainage (m)**: number ≥ 0, default 0.
- Chainage points are generated at: the start of the line, every interval (measured from the start chainage value, i.e. points at multiples of the interval in absolute chainage), every vertex of the polyline, and the end point. Duplicates (within 0.01 m) are merged.
- Distances use geodesic (great-circle/haversine, WGS84 mean radius 6,371,008.8 m) measurement along each segment, and intermediate points are interpolated along the great circle.
- Chainage label format: `km+mmm` with 3-digit metres, e.g. `0+000`, `1+250`, `12+005`. Fractional metres are shown with 2 dp in the table (`1+250.37`) where not an exact interval point.
- Markers show on the map for each generated chainage point (labels per the Decisions section) and update live when the line, interval or start chainage changes.
- **Limit**: if the settings would produce more than 2,000 points, no points are generated, and a message asks the user to increase the interval.

### Project details
- **Project name**: text input, required for export. It is used as the PDF title and file name (sanitised, e.g. `My Road` → `My-Road-chainage.pdf`).

### Export PDF
- **Export PDF** button is enabled when the alignment has ≥ 2 points, the project name is non-empty, and the point limit is not exceeded.
- On export:
  1. Elevation is fetched for all chainage points from the Open-Meteo Elevation API (`https://api.open-meteo.com/v1/elevation?latitude=..&longitude=..`, batches of ≤ 100 coordinates). On any failure or timeout (~10 s per batch), show a non-blocking warning ("Elevation unavailable; exported without it") and use `—` in the elevation column.
  2. A map snapshot is captured showing the alignment and chainage markers (fit to the alignment bounds).
  3. An A4 portrait PDF is generated client-side (jsPDF + jspdf-autotable) and downloaded.
- A loading state is shown during export, and the button is disabled to prevent double export.

### PDF layout (A4)
- **Page 1**:
  - Title (project name) and generated date/time.
  - Summary: total length (m and km, 2 dp), interval, start chainage, end chainage, number of chainage points, start and end coordinates.
  - Map snapshot image scaled to the page width.
  - Attribution line: "Map data © OpenStreetMap contributors", plus "Elevation: Open-Meteo" when used.
- **Following pages**: chainage table with a header repeated on each page. Columns: `#`, `Chainage`, `Latitude`, `Longitude` (6 dp), `Distance from previous (m)` (2 dp), `Bearing (°)` (forward azimuth of the segment the point lies on, 1 dp, 0–360), `Elevation (m)` (1 dp or `—`).
- Page numbers "Page X of Y" in the footer.

## Decisions (from planning Q&A)

- **Map snapshot**: built on an off-screen canvas. OSM tiles are loaded with `crossOrigin`, and the alignment and chainage marks are drawn on top, fitted to the alignment bounds. No DOM-screenshot library is used, and the live map is not moved. On failure, the PDF shows "Map image unavailable".
- **Label density**: on the map and in the snapshot, only interval points, the start and the end get text labels. Vertices get a dot with no label. The PDF table lists every point.
- **Editing after Finish**: vertices stay draggable after Finish. "Continue drawing" appends points to the end, and Clear starts over.
- **PDF font**: built-in Latin fonts only (MVP). If the project name has characters that cannot be rendered, show a hint.
- **Interval**: whole metres only (integer ≥ 1). Interval-point labels are always `km+mmm` with no decimals.
- **Bearing**: uses the outgoing segment, and the last point uses the incoming segment. It is `—` if both neighbouring segments have zero length.
- **Distance from previous**: `0.00` for point #1.
- **Fractional labels**: vertex and end chainages show 2 dp in the PDF table (`1+250.37`). Map labels are rounded to whole metres.
- **File name fallback**: `chainage.pdf` if the sanitised name is empty.
- **PDF date**: local time with timezone offset, e.g. `2026-11-12 14:30 (UTC+05:45)`. It is read only inside the export handler.
- **Place search**: runs on Enter or the Search button only (no autocomplete), throttled to 1 request/second, with `limit=5`.

## Data model changes

None. There is no database or persistence: all state lives in React state for the session, and a page refresh loses the alignment.

New client-side types (indicative):
- `LatLng { lat: number; lng: number }`
- `ChainagePoint { index; chainage (m); label; lat; lng; distFromPrev; bearing; elevation?: number | null }`

## Access rules

Public, no authentication. Everything runs in the user's browser. The only external calls are OSM tiles, Nominatim (search), and Open-Meteo (elevation).

## Edge cases

- Alignment with 0 or 1 points: no chainage points, and Export is disabled with a hint.
- Interval empty, non-numeric, < 1: validation message, and no points are generated.
- Start chainage negative/invalid: validation message.
- More than 2,000 points: message, no generation, and Export is disabled.
- Two consecutive identical vertices (zero-length segment): ignored for bearing, and no duplicate points.
- Line crossing the antimeridian: not specially handled (out of scope), but it must not crash.
- Nominatim fails or has no results: inline message, and the map is unchanged.
- Elevation API fails, partially fails, or times out: export continues with `—` for missing values and shows a warning.
- Map tiles not fully loaded at snapshot time: wait for tile load (or a short timeout) before capture. If capture fails, the PDF is still produced without the image and a note "Map image unavailable".
- Project name with characters invalid in file names: sanitised for the file name.
- Leaflet is browser-only: map components must be client components loaded without SSR.

## Out of scope (for now)

- Saving or loading alignments (server, database, localStorage), and accounts/login.
- Multiple alignments.
- Importing or exporting KML/GPX/GeoJSON, and road-following auto-routing.
- Manual or named chainage points (bridges, culverts, etc.).
- Imperial units and alternative chainage formats.
- Satellite or other base layers, and a chainage list panel beside the map.
- Extra project fields (client, prepared by, notes), and A3 or other paper sizes.
- Offsets, cross-sections, and CAD exports.

## Acceptance criteria

- [ ] `/` shows a Leaflet map with OSM tiles and correct attribution, with no SSR/hydration errors.
- [ ] Place search via Nominatim pans the map to a chosen result and handles no-results and errors.
- [ ] User can draw a polyline by clicking, drag vertices, undo the last point, finish, and clear.
- [ ] Interval (min 1, default 100, presets) and start chainage (default 0) inputs, with validation messages.
- [ ] Chainage points are generated at start, interval multiples, vertices and end; duplicates are merged; geodesic distances are used.
- [ ] Labels use `km+mmm` format (e.g. `1+250`), and markers with labels update live on the map.
- [ ] More than 2,000 points shows a message and blocks generation and export.
- [ ] Project name is required; Export is disabled until the alignment has ≥ 2 points and a name is set.
- [ ] Export fetches elevation from Open-Meteo in batches of ≤ 100; on failure it exports with `—` and shows a warning.
- [ ] PDF is A4 and contains the title, date, summary, map snapshot with alignment and chainage marks, and OSM attribution.
- [ ] PDF chainage table has all specified columns, the header repeats on each page, and the footer shows page numbers.
- [ ] If the map snapshot fails, the PDF is still produced with a note.
- [ ] PDF file name is derived from the sanitised project name.
- [ ] Unit tests cover the chainage math: distance, interpolation, bearing, label format, point generation, duplicate merge, and limit.
- [ ] `tsc --noEmit`, `npm run lint`, and the tests all pass.
