# Map Chainage Tool

A no-login web tool for road/civil engineers and surveyors. Draw an alignment on an OpenStreetMap map, generate chainage points along it at a chosen interval, and export an A4 PDF report with a map snapshot, summary details and a chainage table (including elevation). Everything runs in the browser: there is no backend and no stored data, so a page refresh clears the alignment.

## How to use

1. **Draw**: press "Draw alignment" and click the map to add vertices. Drag a vertex to edit it, use "Undo last point" to remove the last one, "Finish" to stop drawing ("Continue drawing" appends more points), and "Clear" to start over.
2. **Settings**: set the interval in whole metres (presets 10 / 20 / 50 / 100) and the start chainage (>= 0). Points are placed at the start, every interval, every vertex and the end, and update live on the map. More than 2,000 points is blocked: increase the interval.
3. **Search**: type a place name and press Enter or "Search" to find it with Nominatim, then pick a result to move the map there.
4. **Export**: enter a project name (used as the title and file name, e.g. `My Road` becomes `My-Road-chainage.pdf`) and press "Export PDF". It needs at least 2 points. If elevation or the map image cannot be fetched, the PDF is still produced with a warning.

## Commands

Requires Node.js >= 22.12.

```bash
npm install
npm run dev        # development server on http://localhost:3000
npm test           # unit tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # production build
```

## Usage policies

- **OpenStreetMap tiles** (`tile.openstreetmap.org`) are used under the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Attribution is shown on the map and in the PDF. Do not use this app for heavy or bulk tile loading.
- **Nominatim** search is limited to 1 request per second (see the [usage policy](https://operations.osmfoundation.org/policies/nominatim/)). Searches run only on Enter or the Search button.
- **Open-Meteo** elevation uses the free API, which is for non-commercial use only. Commercial use needs a paid plan or another elevation source.
