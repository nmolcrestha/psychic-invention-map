import L from "leaflet";
import { formatMapLabel, type ChainagePoint } from "@/lib/chainage";

const LABEL_PANE = "chainageLabels";
const DOT_STYLE: L.CircleMarkerOptions = {
  radius: 3,
  color: "#9a3412",
  weight: 1,
  fillColor: "#fb923c",
  fillOpacity: 1,
  interactive: false,
};

export type ChainageLayer = {
  /** Replace everything drawn with the given points. */
  setPoints: (points: ChainagePoint[]) => void;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Chainage dots and labels, below the vertex handles and never interactive.
 * Dots (every point) share one canvas renderer; labels (interval points, start
 * and end only) are non-interactive divIcon markers in a pane under markerPane.
 * Plain divIcons are cheap at the 2,000 point limit, unlike tooltips, which
 * bind per-layer events and add extra DOM and layout work.
 */
export function createChainageLayer(map: L.Map): ChainageLayer {
  if (!map.getPane(LABEL_PANE)) {
    const pane = map.createPane(LABEL_PANE);
    pane.style.zIndex = "450"; // above overlayPane (400), below markerPane (600)
    pane.style.pointerEvents = "none";
  }
  const renderer = L.canvas({ padding: 0.5 });
  const group = L.layerGroup().addTo(map);

  return {
    setPoints(points) {
      group.clearLayers();
      const last = points.length - 1;
      points.forEach((p, i) => {
        const latlng: L.LatLngTuple = [p.lat, p.lng];
        L.circleMarker(latlng, { ...DOT_STYLE, renderer }).addTo(group);
        if (!p.isInterval && i !== 0 && i !== last) return;
        const label = escapeHtml(formatMapLabel(p.chainage));
        L.marker(latlng, {
          pane: LABEL_PANE,
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "",
            html: `<span style="position:absolute;left:6px;top:-18px;white-space:nowrap;font:600 11px/1 system-ui,sans-serif;color:#431407;background:rgba(255,255,255,.85);padding:1px 3px;border-radius:2px">${label}</span>`,
            iconSize: [0, 0],
          }),
        }).addTo(group);
      });
    },
  };
}
