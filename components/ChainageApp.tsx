"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import type L from "leaflet";
import {
  alignmentReducer,
  initialAlignmentState,
} from "@/lib/alignment/reducer";
import {
  generateChainage,
  segmentLengths,
  validateChainageInputs,
  type ChainagePoint,
  type LatLng,
} from "@/lib/chainage";
import type { PlaceResult } from "@/lib/services/nominatim";
import Panel from "./Panel";

const MapView = dynamic(() => import("./map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
      Loading map...
    </div>
  ),
});

const NO_POINTS: ChainagePoint[] = [];

export default function ChainageApp() {
  const [alignment, dispatch] = useReducer(
    alignmentReducer,
    initialAlignmentState,
  );
  // Null while unmounted.
  const [map, setMap] = useState<L.Map | null>(null);

  const [intervalRaw, setIntervalRaw] = useState("100");
  const [startRaw, setStartRaw] = useState("0");
  const { vertices } = alignment;

  const inputs = useMemo(
    () => validateChainageInputs(intervalRaw, startRaw),
    [intervalRaw, startRaw],
  );
  const interval = inputs.ok ? inputs.interval : null;
  const startChainage = inputs.ok ? inputs.startChainage : null;
  const result = useMemo(
    () =>
      interval !== null && startChainage !== null
        ? generateChainage(vertices, interval, startChainage)
        : null,
    [interval, startChainage, vertices],
  );
  const points = result?.points ?? NO_POINTS;
  const totalLengthM = useMemo(
    () => segmentLengths(vertices).reduce((a, b) => a + b, 0),
    [vertices],
  );

  const handleMapClick = useCallback(
    (vertex: LatLng) => dispatch({ type: "addVertex", vertex }),
    [],
  );
  const handleVertexMove = useCallback(
    (index: number, vertex: LatLng) =>
      dispatch({ type: "moveVertex", index, vertex }),
    [],
  );

  const handlePlacePick = useCallback(
    (place: PlaceResult) => {
      if (!map) return;
      if (place.bounds) map.fitBounds(place.bounds);
      else map.setView([place.lat, place.lng], 16);
    },
    [map],
  );

  return (
    <div className="flex h-dvh w-full flex-col md:flex-row">
      <Panel
        alignment={alignment}
        dispatch={dispatch}
        onPlacePick={handlePlacePick}
        chainage={{
          intervalRaw,
          startRaw,
          onIntervalChange: setIntervalRaw,
          onStartChange: setStartRaw,
          errors: inputs.ok ? {} : inputs.errors,
          vertexCount: vertices.length,
          pointCount: result ? points.length : null,
          limitExceeded: result?.limitExceeded ?? false,
          totalLengthM,
        }}
      />
      <main className="relative isolate min-h-0 flex-1">
        <MapView
          vertices={vertices}
          chainagePoints={points}
          mode={alignment.mode}
          onMapClick={handleMapClick}
          onVertexMove={handleVertexMove}
          onReady={setMap}
        />
      </main>
    </div>
  );
}
