"use client";

import dynamic from "next/dynamic";
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
  return (
    <div className="flex h-dvh w-full flex-col md:flex-row">
      <Panel />
      <main className="relative min-h-0 flex-1">
        <MapView onReady={() => {}} />
      </main>
    </div>
  );
}
