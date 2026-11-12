"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: L.LatLngTuple = [27.7172, 85.324];
const DEFAULT_ZOOM = 13;

type MapViewProps = {
  onReady?: (map: L.Map) => void;
};

export default function MapView({ onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  });

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

    onReadyRef.current?.(map);

    // StrictMode runs this effect twice; remove() fully tears down the first map.
    return () => {
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
