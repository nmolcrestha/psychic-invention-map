import { MAX_POINTS, type ChainageInputErrors } from "@/lib/chainage";

type ChainageSettingsProps = {
  intervalRaw: string;
  startRaw: string;
  onIntervalChange: (value: string) => void;
  onStartChange: (value: string) => void;
  errors: ChainageInputErrors;
  vertexCount: number;
  /** Null when inputs are invalid. */
  pointCount: number | null;
  limitExceeded: boolean;
  totalLengthM: number;
};

const PRESETS = [10, 20, 50, 100];

const INPUT =
  "w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm aria-[invalid=true]:border-red-600 dark:border-zinc-700 dark:aria-[invalid=true]:border-red-400";
const PRESET =
  "rounded-md border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900";
const ERROR = "text-sm text-red-700 dark:text-red-400";

export default function ChainageSettings({
  intervalRaw,
  startRaw,
  onIntervalChange,
  onStartChange,
  errors,
  vertexCount,
  pointCount,
  limitExceeded,
  totalLengthM,
}: ChainageSettingsProps) {
  let message: { text: string; tone: "error" | "info" } | null = null;
  let summary: string | null = null;
  if (limitExceeded) {
    message = {
      text: `More than ${MAX_POINTS.toLocaleString("en-US")} chainage points — increase the interval`,
      tone: "error",
    };
  } else if (!errors.interval && !errors.startChainage) {
    if (vertexCount < 2) {
      message = { text: "Add at least 2 points to the alignment to generate chainage.", tone: "info" };
    } else if (pointCount !== null) {
      summary = `Length ${totalLengthM.toFixed(2)} m (${(totalLengthM / 1000).toFixed(2)} km), ${pointCount} chainage ${pointCount === 1 ? "point" : "points"}.`;
    }
  }
  const announced = message;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="chainage-interval" className="text-sm">
          Interval (m)
        </label>
        <input
          id="chainage-interval"
          type="text"
          inputMode="numeric"
          className={INPUT}
          value={intervalRaw}
          onChange={(e) => onIntervalChange(e.target.value)}
          aria-invalid={errors.interval ? true : undefined}
          aria-describedby={errors.interval ? "chainage-interval-error" : undefined}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Interval presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={PRESET}
              aria-pressed={intervalRaw.trim() === String(p)}
              onClick={() => onIntervalChange(String(p))}
            >
              {p}
            </button>
          ))}
        </div>
        {errors.interval && (
          <p id="chainage-interval-error" className={ERROR}>
            {errors.interval}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="chainage-start" className="text-sm">
          Start chainage (m)
        </label>
        <input
          id="chainage-start"
          type="text"
          inputMode="decimal"
          className={INPUT}
          value={startRaw}
          onChange={(e) => onStartChange(e.target.value)}
          aria-invalid={errors.startChainage ? true : undefined}
          aria-describedby={errors.startChainage ? "chainage-start-error" : undefined}
        />
        {errors.startChainage && (
          <p id="chainage-start-error" className={ERROR}>
            {errors.startChainage}
          </p>
        )}
      </div>

      {/* Only the limit and hint messages are announced; the summary changes on
          nearly every keystroke, so it sits outside the live region. */}
      <p
        aria-live="polite"
        className={
          message?.tone === "error"
            ? ERROR
            : "text-sm text-zinc-500 dark:text-zinc-400"
        }
      >
        {announced?.text}
      </p>
      {summary && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{summary}</p>
      )}
    </div>
  );
}
