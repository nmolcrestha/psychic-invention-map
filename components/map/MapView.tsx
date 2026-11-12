"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AlignmentMode } from "@/lib/alignment/reducer";
import type { LatLng } from "@/lib/chainage";

const DEFAULT_CENTER: L.LatLngTuple = [27.7172, 85.324];
const DEFAULT_ZOOM = 13;

const LINE_STYLE: L.PolylineOptions = { color: "#2563eb", weight: 4 };

const HANDLE_ICON = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;box-sizing:border-box;border-radius:50%;background:#fff;border:3px solid #2563eb;box-shadow:0 0 2px rgba(0,0,0,.5);cursor:move"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

type MapViewProps = {
  vertices: LatLng[];
  mode: AlignmentMode;
  onMapClick: (vertex: LatLng) => void;
  onVertexMove: (index: number, vertex: LatLng) => void;
  /** Called with the map once created, and with null when it is removed. */
  onReady?: (map: L.Map | null) => void;
};

export default function MapView({
  vertices,
  mode,
  onMapClick,
  onVertexMove,
  onReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Latest props for handlers registered once on the map.
  const modeRef = useRef(mode);
  const onReadyRef = useRef(onReady);
  const onMapClickRef = useRef(onMapClick);
  const onVertexMoveRef = useRef(onVertexMove);

  useLayoutEffect(() => {
    modeRef.current = mode;
    onReadyRef.current = onReady;
    onMapClickRef.current = onMapClick;
    onVertexMoveRef.current = onVertexMove;
  });

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Handle markers register a click listener (see below), so their clicks are
    // targeted at the marker and never reach the map; only real map clicks land here.
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (modeRef.current !== "drawing") return;
      onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    lineRef.current = L.polyline([], LINE_STYLE).addTo(map);
    markersRef.current = [];

    onReadyRef.current?.(map);

    // StrictMode runs this effect twice; remove() fully tears down the first map.
    return () => {
      onReadyRef.current?.(null);
      map.remove();
      mapRef.current = null;
      lineRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // Sync vertices: reuse markers by index, add or remove only the difference.
  useEffect(() => {
    const map = mapRef.current;
    const line = lineRef.current;
    if (!map || !line) return;
    const markers = markersRef.current;

    vertices.forEach((v, i) => {
      const existing = markers[i];
      if (existing) {
        const pos = existing.getLatLng();
        if (pos.lat !== v.lat || pos.lng !== v.lng) existing.setLatLng([v.lat, v.lng]);
        return;
      }
      const marker = L.marker([v.lat, v.lng], {
        icon: HANDLE_ICON,
        draggable: true,
        keyboard: false,
      }).addTo(map);
      // Leaflet only treats a layer as a click target if it listens for click;
      // without this the click falls through to the map and adds a vertex.
      marker.on("click", L.DomEvent.stopPropagation);
      marker.on("drag", () => {
        line.setLatLngs(markersRef.current.map((m) => m.getLatLng()));
      });
      marker.on("dragend", () => {
        const index = markersRef.current.indexOf(marker);
        if (index < 0) return;
        const pos = marker.getLatLng();
        onVertexMoveRef.current(index, { lat: pos.lat, lng: pos.lng });
      });
      markers.push(marker);
    });

    while (markers.length > vertices.length) {
      markers.pop()?.remove();
    }

    line.setLatLngs(vertices.map((v) => [v.lat, v.lng] as L.LatLngTuple));
  }, [vertices]);

  // Crosshair cursor while drawing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const drawing = mode === "drawing";
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [mode]);

  return <div ref={containerRef} className="h-full w-full" />;
}
