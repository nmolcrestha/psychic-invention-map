import type { AlignmentAction, AlignmentState } from "@/lib/alignment/reducer";

type DrawControlsProps = {
  state: AlignmentState;
  dispatch: (action: AlignmentAction) => void;
};

const BUTTON =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const PRIMARY =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export default function DrawControls({ state, dispatch }: DrawControlsProps) {
  const { vertices, mode } = state;
  const count = vertices.length;
  const hasPoints = count > 0;
  const drawing = mode === "drawing";

  const hint = drawing
    ? "Click on the map to add points"
    : hasPoints
      ? "Drag points to edit, or continue drawing"
      : "Press Draw alignment, then click on the map";

  function handleClear() {
    if (hasPoints && !window.confirm("Clear the alignment and all its points?")) {
      return;
    }
    dispatch({ type: "clear" });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {!hasPoints && (
          <button
            type="button"
            className={PRIMARY}
            disabled={drawing}
            onClick={() => dispatch({ type: "startDrawing" })}
          >
            Draw alignment
          </button>
        )}
        {hasPoints && !drawing && (
          <button
            type="button"
            className={PRIMARY}
            onClick={() => dispatch({ type: "startDrawing" })}
          >
            Continue drawing
          </button>
        )}
        {drawing && (
          <button
            type="button"
            className={PRIMARY}
            onClick={() => dispatch({ type: "finish" })}
          >
            Finish
          </button>
        )}
        {hasPoints && (
          <button
            type="button"
            className={BUTTON}
            onClick={() => dispatch({ type: "undo" })}
          >
            Undo last point
          </button>
        )}
        <button type="button" className={BUTTON} onClick={handleClear}>
          Clear
        </button>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {count} {count === 1 ? "point" : "points"}. {hint}.
      </p>
    </div>
  );
}
