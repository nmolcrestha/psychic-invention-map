"use client";

import { useCallback, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import type L from "leaflet";
import {
  alignmentReducer,
  initialAlignmentState,
} from "@/lib/alignment/reducer";
import type { LatLng } from "@/lib/chainage";
import Panel from "./Panel";

const MapView = dynamic(() => import("./map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
      Loading map...
    </div>
  ),
});

export default function ChainageApp() {
  const [alignment, dispatch] = useReducer(
    alignmentReducer,
    initialAlignmentState,
  );
  // Kept for later milestones (markers, search, snapshot). Null while unmounted.
  const [, setMap] = useState<L.Map | null>(null);

  const handleMapClick = useCallback(
    (vertex: LatLng) => dispatch({ type: "addVertex", vertex }),
    [],
  );
  const handleVertexMove = useCallback(
    (index: number, vertex: LatLng) =>
      dispatch({ type: "moveVertex", index, vertex }),
    [],
  );

  return (
    <div className="flex h-dvh w-full flex-col md:flex-row">
      <Panel alignment={alignment} dispatch={dispatch} />
      <main className="relative isolate min-h-0 flex-1">
        <MapView
          vertices={alignment.vertices}
          mode={alignment.mode}
          onMapClick={handleMapClick}
          onVertexMove={handleVertexMove}
          onReady={setMap}
        />
      </main>
    </div>
  );
}
