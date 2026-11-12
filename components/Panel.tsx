import type { AlignmentAction, AlignmentState } from "@/lib/alignment/reducer";
import DrawControls from "./panel/DrawControls";
import ChainageSettings from "./panel/ChainageSettings";
import ProjectExport from "./panel/ProjectExport";
import PlaceSearch from "./panel/PlaceSearch";
import type { PlaceResult } from "@/lib/services/nominatim";
import type { ComponentProps } from "react";

type PanelProps = {
  alignment: AlignmentState;
  dispatch: (action: AlignmentAction) => void;
  chainage: ComponentProps<typeof ChainageSettings>;
  onPlacePick: (place: PlaceResult) => void;
  exportProps: ComponentProps<typeof ProjectExport>;
};

export default function Panel({
  alignment,
  dispatch,
  chainage,
  onPlacePick,
  exportProps,
}: PanelProps) {
  return (
    <aside className="flex max-h-[40dvh] w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-zinc-200 p-4 md:max-h-none md:w-80 md:border-b-0 md:border-r dark:border-zinc-800">
      <h1 className="text-lg font-semibold tracking-tight">Map Chainage Tool</h1>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Search</h2>
        <PlaceSearch onPick={onPlacePick} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Alignment</h2>
        <DrawControls state={alignment} dispatch={dispatch} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Chainage settings</h2>
        <ChainageSettings {...chainage} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Project & export</h2>
        <ProjectExport {...exportProps} />
      </section>
    </aside>
  );
}
