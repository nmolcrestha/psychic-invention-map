"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_POINTS, type ChainagePoint, type LatLng } from "@/lib/chainage";
import { runExport, type ElevationStatus } from "@/lib/export/runExport";
import { fetchElevations } from "@/lib/services/elevation";
import { hasUnsupportedChars } from "@/lib/pdf/format";

export type ProjectExportProps = {
  vertices: LatLng[];
  points: ChainagePoint[];
  /** Null when the chainage settings are invalid. */
  interval: number | null;
  limitExceeded: boolean;
};

const INPUT =
  "w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";
const NOTE = "text-sm text-zinc-500 dark:text-zinc-400";

export default function ProjectExport({
  vertices,
  points,
  interval,
  limitExceeded,
}: ProjectExportProps) {
  const [name, setName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [elevationStatus, setElevationStatus] = useState<ElevationStatus | null>(
    null,
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const trimmed = name.trim();
  let disabledReason: string | null = null;
  if (vertices.length < 2) disabledReason = "Add at least 2 points to the alignment.";
  else if (interval === null) disabledReason = "Fix the chainage settings.";
  else if (limitExceeded)
    disabledReason = `More than ${MAX_POINTS.toLocaleString("en-US")} points; increase the interval.`;
  else if (points.length === 0) disabledReason = "No chainage points to export.";
  else if (!trimmed) disabledReason = "Enter a project name.";
  const disabled = disabledReason !== null || exporting;

  async function handleExport() {
    if (runningRef.current || disabledReason !== null || interval === null) return;
    runningRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setExporting(true);
    setError(null);
    setElevationStatus(null);
    setBannerDismissed(false);
    try {
      const result = await runExport(
        { name, points, vertices, interval, signal: controller.signal },
        {
          fetchElevations,
          loadBuildPdf: () =>
            import("@/lib/pdf/buildReport").then((m) => m.buildChainagePdf),
          save: (doc, fileName) => doc.save(fileName),
          now: () => new Date(),
        },
      );
      if (!controller.signal.aborted) setElevationStatus(result.elevationStatus);
    } catch {
      if (!controller.signal.aborted) {
        setError("Export failed. Please try again.");
      }
    } finally {
      runningRef.current = false;
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  const warning =
    elevationStatus === "failed"
      ? "Elevation unavailable; exported without it"
      : elevationStatus === "partial"
        ? "Some elevations unavailable; those values are shown as —"
        : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="project-name" className="text-sm">
          Project name (required)
        </label>
        <input
          id="project-name"
          type="text"
          required
          className={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={
            hasUnsupportedChars(name) ? "project-name-hint" : undefined
          }
        />
        {hasUnsupportedChars(name) && (
          <p id="project-name-hint" className="text-sm text-amber-700 dark:text-amber-400">
            Some characters can&apos;t be shown in the PDF (Latin only)
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={disabled}
        aria-describedby={disabledReason ? "export-hint" : undefined}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {exporting ? "Exporting…" : "Export PDF"}
      </button>
      {disabledReason && !exporting && (
        <p id="export-hint" className={NOTE}>
          {disabledReason}
        </p>
      )}

      <div aria-live="polite">
        {warning && !bannerDismissed && (
          <div className="flex items-start justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <span>{warning}</span>
            <button
              type="button"
              className="shrink-0 underline"
              onClick={() => setBannerDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
